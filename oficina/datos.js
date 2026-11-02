// Capa de datos de la oficina: Firebase en producción, memoria en el modo demo (?demo=1).
import { FIREBASE, ADMINS, ETAPAS, CHAT_URL } from "./config.js";
import { leerRespuesta } from "./sse.js";

const SDK = "https://www.gstatic.com/firebasejs/12.19.0/";
const siguiente = (etapa) => ETAPAS[ETAPAS.findIndex((e) => e.id === etapa) + 1]?.id || "listo";
const ahora = () => new Date().toISOString();
const titulo = (texto) => { const t = texto.replace(/\s+/g, " ").trim(); return t.length > 48 ? t.slice(0, 47) + "…" : t; };
const evento = (usuario, etapa, accion) => ({ quien: usuario.nombre, correo: usuario.correo, etapa, accion, cuando: ahora() });

/* ---------------------------------------------------------------------
   Firebase
   --------------------------------------------------------------------- */
async function crearFirebase() {
  const [{ initializeApp }, auth, fs] = await Promise.all([
    import(SDK + "firebase-app.js"),
    import(SDK + "firebase-auth.js"),
    import(SDK + "firebase-firestore.js"),
  ]);
  const app = initializeApp(FIREBASE);
  const A = auth.getAuth(app);
  const db = fs.getFirestore(app);
  let usuario = null;

  const col = (n) => fs.collection(db, n);
  const ref = (n, id) => fs.doc(db, n, id);

  return {
    demo: false,
    alCambiarSesion(cb) {
      auth.onAuthStateChanged(A, async (u) => {
        if (!u) { usuario = null; return cb(null); }
        const correo = (u.email || "").toLowerCase();
        let miembro = null;
        try {
          const s = await fs.getDoc(ref("equipo", correo));
          if (s.exists()) miembro = s.data();
        } catch (e) { /* sin permiso: no es del equipo */ }
        const esAdmin = ADMINS.includes(correo) || miembro?.rol === "admin";
        usuario = { correo, nombre: miembro?.nombre || u.displayName || correo, esAdmin, acceso: esAdmin || !!miembro, foto: u.photoURL };
        cb(usuario);
      });
    },
    entrar: () => auth.signInWithPopup(A, new auth.GoogleAuthProvider()),
    salir: () => auth.signOut(A),

    escucharProductos(cb, alError) {
      return fs.onSnapshot(fs.query(col("productos"), fs.orderBy("creadoEn", "desc")),
        (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), alError);
    },
    escucharEquipo(cb) {
      return fs.onSnapshot(col("equipo"), (s) => cb(s.docs.map((d) => ({ correo: d.id, ...d.data() }))), () => cb([]));
    },

    crearProducto({ nombre, pais }) {
      return fs.addDoc(col("productos"), {
        nombre, pais, etapa: "investigacion", estado: "pendiente", responsable: null,
        expedientes: {}, creadoPor: usuario.correo, creadoEn: ahora(), actualizadoEn: ahora(),
        historial: [evento(usuario, "investigacion", "creó el producto")],
      });
    },
    tomarTurno(p) {
      return fs.updateDoc(ref("productos", p.id), {
        estado: "en_curso", responsable: { correo: usuario.correo, nombre: usuario.nombre }, actualizadoEn: ahora(),
        historial: fs.arrayUnion(evento(usuario, p.etapa, "tomó el turno")),
      });
    },
    soltarTurno(p) {
      return fs.updateDoc(ref("productos", p.id), {
        estado: "pendiente", responsable: null, actualizadoEn: ahora(),
        historial: fs.arrayUnion(evento(usuario, p.etapa, "soltó el turno")),
      });
    },
    guardarExpediente(p, texto) {
      return fs.updateDoc(ref("productos", p.id), { ["expedientes." + p.etapa]: texto, actualizadoEn: ahora() });
    },
    entregar(p, texto) {
      return fs.updateDoc(ref("productos", p.id), {
        ["expedientes." + p.etapa]: texto, etapa: siguiente(p.etapa), estado: "pendiente", responsable: null, actualizadoEn: ahora(),
        historial: fs.arrayUnion(evento(usuario, p.etapa, "entregó su turno")),
      });
    },
    eliminarProducto: (p) => fs.deleteDoc(ref("productos", p.id)),
    guardarMiembro: (correo, datos) => fs.setDoc(ref("equipo", correo.toLowerCase()), datos),
    quitarMiembro: (correo) => fs.deleteDoc(ref("equipo", correo)),

    // Conversaciones con los agentes: una sola escucha para toda la oficina.
    escucharConversaciones(cb, alError) {
      return fs.onSnapshot(fs.query(col("conversaciones"), fs.orderBy("actualizadoEn", "desc"), fs.limit(300)),
        (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), alError);
    },
    escucharMensajes(convId, cb, alError) {
      return fs.onSnapshot(fs.query(fs.collection(db, "conversaciones", convId, "mensajes"), fs.orderBy("creadoEn")),
        (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), alError);
    },
    // Guarda el mensaje, pide la respuesta al servidor del chat (Cloudflare) y la va
    // guardando mientras llega, para que todo el equipo la vea escribirse.
    async enviarMensaje({ conv, agente, producto, texto, alCrear }) {
      if (!CHAT_URL) throw new Error("Falta la dirección del servidor del chat en config.js");
      let convId = conv.id;
      if (!convId) {
        convId = (await fs.addDoc(col("conversaciones"), {
          agente: agente.id, productoId: producto?.id || null, titulo: conv.titulo || titulo(texto),
          creadoPor: usuario.correo, creadoEn: ahora(), actualizadoEn: ahora(), escribiendo: false,
        })).id;
        alCrear?.(convId);
      }
      const refC = ref("conversaciones", convId);
      const mensajes = fs.collection(db, "conversaciones", convId, "mensajes");
      await fs.addDoc(mensajes, { rol: "persona", quien: usuario.nombre, correo: usuario.correo, texto, estado: "listo", creadoEn: ahora() });
      const resp = await fs.addDoc(mensajes, { rol: "agente", texto: "", estado: "escribiendo", creadoEn: ahora() });
      await fs.updateDoc(refC, { escribiendo: true, actualizadoEn: ahora(), ultimo: { quien: usuario.nombre, texto: texto.slice(0, 140) } });
      if (producto && producto.etapa === agente.etapa && producto.estado !== "en_curso") {
        await fs.updateDoc(ref("productos", producto.id), {
          estado: "en_curso", responsable: { correo: usuario.correo, nombre: usuario.nombre }, actualizadoEn: ahora(),
          historial: fs.arrayUnion(evento(usuario, agente.etapa, "tomó el turno")),
        }).catch(() => {});
      }
      let ultimo = 0, guardando = Promise.resolve(), final = null;
      try {
        const r = await fetch(CHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await A.currentUser.getIdToken()) },
          body: JSON.stringify({ conversacionId: convId }),
        });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "El chat no respondió (" + r.status + ")");
        final = await leerRespuesta(r.body, {
          alTexto(t) {
            if (Date.now() - ultimo < 800) return;
            ultimo = Date.now();
            guardando = guardando.then(() => fs.updateDoc(resp, { texto: t })).catch(() => {});
          },
        });
        let t = final.texto;
        if (final.fin === "refusal") t += "\n\n(El agente no pudo continuar con esta solicitud. Prueba a reformularla.)";
        if (final.fin === "max_tokens") t += "\n\n(La respuesta se cortó por largo. Escribe \"continúa\" para seguir.)";
        final.texto = t;
        await guardando;
        await fs.updateDoc(resp, { texto: t, estado: "listo", uso: final.uso });
      } catch (e) {
        await guardando;
        await fs.updateDoc(resp, { estado: "error", error: e.message }).catch(() => {});
        throw e;
      } finally {
        await fs.updateDoc(refC, {
          escribiendo: false, actualizadoEn: ahora(),
          ...(final ? { ultimo: { quien: agente.nombre, texto: final.texto.replace(/=== ARCHIVO[\s\S]*?(=== FIN ARCHIVO ===|$)/g, "📄 ").slice(0, 140) } } : {}),
        }).catch(() => {});
      }
      return convId;
    },
    renombrarConversacion: (id, titulo) => fs.updateDoc(ref("conversaciones", id), { titulo }),
    async leerConocimiento(ag) {
      const k = (await fs.getDoc(ref("conocimiento", ag.id))).data();
      if (k || !ag.etapa) return k?.texto || "";
      return (await fs.getDoc(ref("conocimiento", ag.etapa))).data()?.texto || "";   // versión anterior
    },
    guardarConocimiento: (ag, texto) => fs.setDoc(ref("conocimiento", ag.id), { texto, actualizadoEn: ahora(), por: usuario.correo }),
  };
}

// Respuestas de ejemplo del modo demo (no llaman a Claude).
function respuestaDemo(p, etapa, ag) {
  if (!p) return `¡Hola! Soy ${ag.nombre}. Miré el tablero: hay ${"{n}"} productos en marcha. Esta es una respuesta de ejemplo del modo demo; con el servidor conectado te respondo de verdad.\n\n**Puedo ayudarte con:**\n- ${ag.sugerencias.join("\n- ")}`;
  if (etapa === "producto") {
    return `¡Listo! Armé la primera versión de la app de "${p.nombre}" para ${p.pais}.\n\n**Lo que cambié frente al original:** plan de 21 días en 3 semanas, rutinas express de 10 minutos y una paleta cálida pensada para mujeres de 35 a 55 años.\n\n=== ARCHIVO: index.html ===\n<!doctype html><html lang="es"><meta charset="utf-8"><title>${p.nombre}</title><body style="font-family:sans-serif;padding:24px"><h1>${p.nombre}</h1><p>App de ejemplo del modo demo.</p></body></html>\n=== FIN ARCHIVO ===\n\n=== ARCHIVO: manifest.webmanifest ===\n{"name":"${p.nombre}","short_name":"Reto","start_url":".","display":"standalone","background_color":"#fff7ef","theme_color":"#e8735a","icons":[{"src":"icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icon-512.png","sizes":"512x512","type":"image/png"}]}\n=== FIN ARCHIVO ===\n\n=== ARCHIVO: icon.svg ===\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#e8735a"/><text x="256" y="330" font-size="240" text-anchor="middle" fill="#fff" font-family="Arial" font-weight="900">21</text></svg>\n=== FIN ARCHIVO ===\n\n=== ARCHIVO: bonos/guia-alimentacion.html ===\n<!doctype html><meta charset="utf-8"><h1>Guía de alimentación</h1><p>Bono de ejemplo.</p>\n=== FIN ARCHIVO ===\n\nFaltan los IDs de YouTube: quedaron como PENDIENTE.\n\n=== EXPEDIENTE · TURNO 2: PRODUCTO ===\nNombre del reto: ${p.nombre}\nPaís: ${p.pais}\nVideos pendientes: 21\n=== FIN TURNO 2 ===`;
  }
  if (etapa === "guiones") return `Aquí van los guiones para Leona de "${p.nombre}".\n\n**MENSAJE 1**\n¡Hola! 👋 Qué bueno que escribes…\n\n=== EXPEDIENTE · TURNO 3: GUIONES ===\nFlujo de Leona: listo\nVideos: 3 guiones\n=== FIN TURNO 3 ===`;
  return `Revisé lo que me pegaste. El producto con más señales es "${p.nombre}": muchos anuncios activos y varios anunciantes copiándolo.\n\n=== EXPEDIENTE · TURNO 1: INVESTIGACIÓN ===\nProducto elegido: ${p.nombre}\nPaíses donde modelarlo: ${p.pais}\n=== FIN TURNO 1 ===`;
}

/* ---------------------------------------------------------------------
   Demo: datos de ejemplo en memoria, sin Firebase
   --------------------------------------------------------------------- */
function crearDemo() {
  const usuario = { correo: "demo@nuclea.co", nombre: "Nicole", esAdmin: true, acceso: true };
  const hace = (min) => new Date(Date.now() - min * 60e3).toISOString();
  let productos = [
    { id: "p1", nombre: "Reto Pilates en la Silla 21D", pais: "México", etapa: "investigacion", estado: "en_curso",
      responsable: { correo: "santiago@nuclea.co", nombre: "Santiago" }, expedientes: {}, creadoEn: hace(300), historial: [] },
    { id: "p2", nombre: "Desafío Calistenia Asiática", pais: "Venezuela", etapa: "producto", estado: "pendiente", responsable: null,
      expedientes: { investigacion: "=== EXPEDIENTE · TURNO 1: INVESTIGACIÓN ===\nProducto elegido: Desafio Calistenia Asiática 21 dias\nAnuncios activos: 140\n=== FIN TURNO 1 ===" },
      creadoEn: hace(900), historial: [] },
    { id: "p3", nombre: "Yoga Facial 14D", pais: "Colombia", etapa: "guiones", estado: "en_curso", responsable: { correo: "anyela@nuclea.co", nombre: "Anyela" }, expedientes: {}, creadoEn: hace(2000), historial: [] },
    { id: "p4", nombre: "Reto Acero 30D", pais: "Colombia", etapa: "listo", estado: "pendiente", responsable: null, expedientes: {}, creadoEn: hace(5000), historial: [] },
    { id: "p5", nombre: "Método Abdomen Plano 28D", pais: "Perú", etapa: "listo", estado: "pendiente", responsable: null, expedientes: {}, creadoEn: hace(6000), historial: [] },
  ];
  let equipo = [{ correo: "santiago@nuclea.co", nombre: "Santiago", rol: "miembro" }, { correo: "anyela@nuclea.co", nombre: "Anyela", rol: "miembro" }, { correo: "demo@nuclea.co", nombre: "Nicole", rol: "admin" }];
  let conversaciones = [
    { id: "c1", agente: "detective", productoId: null, titulo: "Palabras clave para Brasil", creadoPor: "santiago@nuclea.co", creadoEn: hace(120), actualizadoEn: hace(95), escribiendo: false, ultimo: { quien: "Detective", texto: "Aquí van 12 palabras clave en portugués…" } },
    { id: "c2", agente: "columnista", productoId: "p3", titulo: "Yoga Facial 14D", creadoPor: "anyela@nuclea.co", creadoEn: hace(60), actualizadoEn: hace(40), escribiendo: false, ultimo: { quien: "Columnista", texto: "Te dejo el primer guion…" } },
  ];
  const mensajes = {
    c1: [
      { id: "m1", rol: "persona", quien: "Santiago", texto: "Dame palabras clave para buscar retos de pilates en Brasil", estado: "listo", creadoEn: hace(100) },
      { id: "m2", rol: "agente", texto: "Aquí van 12 palabras clave en portugués, listas para copiar:\n\n`pilates na cadeira | api.whatsapp.com`\n`desafio 21 dias pilates | api.whatsapp.com`\n`pilates para iniciantes | api.whatsapp.com`", estado: "listo", creadoEn: hace(95) },
    ],
    c2: [
      { id: "m3", rol: "persona", quien: "Anyela", texto: "Empecemos con los guiones de video", estado: "listo", creadoEn: hace(45) },
      { id: "m4", rol: "agente", texto: "Te dejo el primer guion, con el ángulo de \"5 minutos frente al espejo\".", estado: "listo", creadoEn: hace(40) },
    ],
  };
  const conocimiento = {};
  const oyentes = new Set(), oyentesEquipo = new Set(), oyentesConv = new Set(), oyentesChat = new Set();
  const copia = (x) => JSON.parse(JSON.stringify(x));
  const avisar = () => { oyentes.forEach((cb) => cb(copia(productos))); oyentesEquipo.forEach((cb) => cb([...equipo])); };
  const avisarConv = () => {
    conversaciones.sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
    oyentesConv.forEach((cb) => cb(copia(conversaciones)));
    oyentesChat.forEach((f) => f());
  };
  const cambiar = (id, f) => { productos = productos.map((p) => (p.id === id ? { ...p, ...f(p), actualizadoEn: ahora() } : p)); avisar(); };
  const cambiarConv = (id, f) => { conversaciones = conversaciones.map((c) => (c.id === id ? { ...c, ...f, actualizadoEn: ahora() } : c)); avisarConv(); };

  return {
    demo: true,
    alCambiarSesion: (cb) => setTimeout(() => cb(usuario), 0),
    entrar: async () => {}, salir: async () => {},
    escucharProductos(cb) { oyentes.add(cb); setTimeout(avisar, 0); return () => oyentes.delete(cb); },
    escucharEquipo(cb) { oyentesEquipo.add(cb); setTimeout(avisar, 0); return () => oyentesEquipo.delete(cb); },
    async crearProducto({ nombre, pais }) {
      productos = [{ id: "p" + Date.now(), nombre, pais, etapa: "investigacion", estado: "pendiente", responsable: null, expedientes: {}, creadoEn: ahora(), historial: [] }, ...productos];
      avisar();
    },
    async tomarTurno(p) { cambiar(p.id, () => ({ estado: "en_curso", responsable: { correo: usuario.correo, nombre: usuario.nombre } })); },
    async soltarTurno(p) { cambiar(p.id, () => ({ estado: "pendiente", responsable: null })); },
    async guardarExpediente(p, texto) { cambiar(p.id, (x) => ({ expedientes: { ...x.expedientes, [p.etapa]: texto } })); },
    async entregar(p, texto) {
      cambiar(p.id, (x) => ({ expedientes: { ...x.expedientes, [p.etapa]: texto }, etapa: siguiente(p.etapa), estado: "pendiente", responsable: null }));
    },
    async eliminarProducto(p) { productos = productos.filter((x) => x.id !== p.id); avisar(); },
    async guardarMiembro(correo, datos) { equipo = [...equipo.filter((m) => m.correo !== correo), { correo: correo.toLowerCase(), ...datos }]; avisar(); },
    async quitarMiembro(correo) { equipo = equipo.filter((m) => m.correo !== correo); avisar(); },
    escucharConversaciones(cb) { oyentesConv.add(cb); setTimeout(avisarConv, 0); return () => oyentesConv.delete(cb); },
    escucharMensajes(convId, cb) {
      const f = () => cb(copia(mensajes[convId] || []));
      oyentesChat.add(f); setTimeout(f, 0); return () => oyentesChat.delete(f);
    },
    async enviarMensaje({ conv, agente, producto, texto, alCrear }) {
      let id = conv.id;
      if (!id) {
        id = "c" + Date.now();
        conversaciones.push({ id, agente: agente.id, productoId: producto?.id || null, titulo: conv.titulo || titulo(texto), creadoPor: usuario.correo, creadoEn: ahora(), actualizadoEn: ahora(), escribiendo: false });
        alCrear?.(id);
      }
      const lista = (mensajes[id] ||= []);
      lista.push({ id: "m" + Date.now(), rol: "persona", quien: usuario.nombre, texto, estado: "listo", creadoEn: ahora() });
      const r = { id: "m" + Date.now() + "r", rol: "agente", texto: "", estado: "escribiendo", creadoEn: ahora() };
      lista.push(r);
      if (producto && producto.etapa === agente.etapa && producto.estado !== "en_curso") cambiar(producto.id, () => ({ estado: "en_curso", responsable: { correo: usuario.correo, nombre: usuario.nombre } }));
      cambiarConv(id, { escribiendo: true, ultimo: { quien: usuario.nombre, texto } });
      const completo = respuestaDemo(producto, agente.etapa, agente).replace("{n}", productos.filter((p) => p.etapa !== "listo").length);
      for (let i = 0; i < completo.length; i += 24) { r.texto = completo.slice(0, i + 24); avisarConv(); await new Promise((ok) => setTimeout(ok, 30)); }
      r.estado = "listo";
      cambiarConv(id, { escribiendo: false, ultimo: { quien: agente.nombre, texto: completo.slice(0, 140) } });
      return id;
    },
    async renombrarConversacion(id, titulo) { cambiarConv(id, { titulo }); },
    async leerConocimiento(ag) { return conocimiento[ag.id] || ""; },
    async guardarConocimiento(ag, texto) { conocimiento[ag.id] = texto; },
  };
}

export async function crearDatos() {
  const demo = new URLSearchParams(location.search).has("demo");
  return demo ? crearDemo() : crearFirebase();
}

export { siguiente };
