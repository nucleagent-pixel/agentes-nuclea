// Capa de datos de la oficina: Firebase en producción, memoria en el modo demo (?demo=1).
import { FIREBASE, ADMINS, ETAPAS, CHAT_URL } from "./config.js";
import { leerRespuesta } from "./sse.js";

const SDK = "https://www.gstatic.com/firebasejs/12.19.0/";
const siguiente = (etapa) => ETAPAS[ETAPAS.findIndex((e) => e.id === etapa) + 1]?.id || "listo";
const ahora = () => new Date().toISOString();
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

    // Chat con los agentes: la función del servidor escribe la respuesta y aquí se escucha en vivo.
    escucharMensajes(productoId, etapa, cb, alError) {
      return fs.onSnapshot(fs.query(fs.collection(db, "productos", productoId, "mensajes"), fs.orderBy("creadoEn")),
        (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => m.etapa === etapa)), alError);
    },
    // Guarda el mensaje, pide la respuesta al servidor del chat (Cloudflare) y la va
    // guardando mientras llega, para que todo el equipo la vea escribirse.
    async enviarMensaje(p, etapa, texto) {
      if (!CHAT_URL) throw new Error("Falta la dirección del servidor del chat en config.js");
      const mensajes = fs.collection(db, "productos", p.id, "mensajes");
      const refP = ref("productos", p.id);
      await fs.addDoc(mensajes, { etapa, rol: "persona", quien: usuario.nombre, correo: usuario.correo, texto, estado: "listo", creadoEn: ahora() });
      const resp = await fs.addDoc(mensajes, { etapa, rol: "agente", texto: "", estado: "escribiendo", creadoEn: ahora() });
      const cambios = { escribiendo: fs.arrayUnion(etapa), actualizadoEn: ahora() };
      if (p.etapa === etapa && p.estado !== "en_curso") {
        Object.assign(cambios, { estado: "en_curso", responsable: { correo: usuario.correo, nombre: usuario.nombre },
          historial: fs.arrayUnion(evento(usuario, etapa, "tomó el turno")) });
      }
      await fs.updateDoc(refP, cambios);
      let ultimo = 0, guardando = Promise.resolve();
      try {
        const r = await fetch(CHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await A.currentUser.getIdToken()) },
          body: JSON.stringify({ productoId: p.id, etapa }),
        });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "El chat no respondió (" + r.status + ")");
        const final = await leerRespuesta(r.body, {
          alTexto(t) {
            if (Date.now() - ultimo < 800) return;
            ultimo = Date.now();
            guardando = guardando.then(() => fs.updateDoc(resp, { texto: t })).catch(() => {});
          },
        });
        let t = final.texto;
        if (final.fin === "refusal") t += "\n\n(El agente no pudo continuar con esta solicitud. Prueba a reformularla.)";
        if (final.fin === "max_tokens") t += "\n\n(La respuesta se cortó por largo. Escribe \"continúa\" para seguir.)";
        await guardando;
        await fs.updateDoc(resp, { texto: t, estado: "listo", uso: final.uso });
      } catch (e) {
        await guardando;
        await fs.updateDoc(resp, { estado: "error", error: e.message }).catch(() => {});
        throw e;
      } finally {
        await fs.updateDoc(refP, { escribiendo: fs.arrayRemove(etapa) }).catch(() => {});
      }
    },
    async leerConocimiento(etapa) { return (await fs.getDoc(ref("conocimiento", etapa))).data()?.texto || ""; },
    guardarConocimiento: (etapa, texto) => fs.setDoc(ref("conocimiento", etapa), { texto, actualizadoEn: ahora(), por: usuario.correo }),
  };
}

// Respuestas de ejemplo del modo demo (no llaman a Claude).
function respuestaDemo(p, etapa) {
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
  let productos = [
    { id: "p1", nombre: "Reto Pilates en la Silla 21D", pais: "México", etapa: "investigacion", estado: "en_curso",
      responsable: { correo: "ana@nuclea.co", nombre: "Ana" }, expedientes: {}, creadoEn: ahora(), historial: [] },
    { id: "p2", nombre: "Desafío Calistenia Asiática", pais: "Venezuela", etapa: "producto", estado: "en_curso",
      responsable: { correo: "demo@nuclea.co", nombre: "Nicole" },
      expedientes: { investigacion: "=== EXPEDIENTE · TURNO 1: INVESTIGACIÓN ===\nProducto elegido: Desafio Calistenia Asiática 21 dias\nAnuncios activos: 140\n=== FIN TURNO 1 ===" },
      creadoEn: ahora(), historial: [] },
    { id: "p3", nombre: "Yoga Facial 14D", pais: "Colombia", etapa: "guiones", estado: "pendiente", responsable: null, expedientes: {}, creadoEn: ahora(), historial: [] },
    { id: "p4", nombre: "Reto Acero 30D", pais: "Colombia", etapa: "listo", estado: "pendiente", responsable: null, expedientes: {}, creadoEn: ahora(), historial: [] },
  ];
  let equipo = [{ correo: "ana@nuclea.co", nombre: "Ana", rol: "miembro" }, { correo: "demo@nuclea.co", nombre: "Nicole", rol: "admin" }];
  const oyentes = new Set(), oyentesEquipo = new Set(), oyentesChat = new Set();
  const mensajes = [], conocimiento = {};
  const avisar = () => { oyentes.forEach((cb) => cb(productos.map((p) => ({ ...p })))); oyentesEquipo.forEach((cb) => cb([...equipo])); };
  const cambiar = (id, f) => { productos = productos.map((p) => (p.id === id ? { ...p, ...f(p), actualizadoEn: ahora() } : p)); avisar(); };

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
    escucharMensajes(productoId, etapa, cb) {
      const f = () => cb(mensajes.filter((m) => m.productoId === productoId && m.etapa === etapa).map((m) => ({ ...m })));
      oyentesChat.add(f); setTimeout(f, 0); return () => oyentesChat.delete(f);
    },
    async enviarMensaje(p, etapa, texto) {
      const avisarChat = () => oyentesChat.forEach((f) => f());
      mensajes.push({ id: "m" + Date.now(), productoId: p.id, etapa, rol: "persona", quien: usuario.nombre, texto, estado: "listo" });
      if (p.etapa === etapa && p.estado !== "en_curso") cambiar(p.id, () => ({ estado: "en_curso", responsable: { correo: usuario.correo, nombre: usuario.nombre } }));
      const r = { id: "m" + Date.now() + "r", productoId: p.id, etapa, rol: "agente", texto: "", estado: "escribiendo" };
      mensajes.push(r); cambiar(p.id, (x) => ({ escribiendo: [...(x.escribiendo || []), etapa] })); avisarChat();
      const completo = respuestaDemo(p, etapa);
      for (let i = 0; i < completo.length; i += 24) { r.texto = completo.slice(0, i + 24); avisarChat(); await new Promise((ok) => setTimeout(ok, 30)); }
      r.estado = "listo"; avisarChat();
      cambiar(p.id, (x) => ({ escribiendo: (x.escribiendo || []).filter((e) => e !== etapa) }));
    },
    async leerConocimiento(etapa) { return conocimiento[etapa] || ""; },
    async guardarConocimiento(etapa, texto) { conocimiento[etapa] = texto; },
  };
}

export async function crearDatos() {
  const demo = new URLSearchParams(location.search).has("demo");
  return demo ? crearDemo() : crearFirebase();
}

export { siguiente };
