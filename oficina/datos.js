// Capa de datos de la oficina: Firebase en producción, memoria en el modo demo (?demo=1).
import { FIREBASE, ADMINS, ETAPAS } from "./config.js";

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

    // Enlaces al chat de cada agente (los pega un administrador en "Chats").
    escucharEnlaces(cb) {
      return fs.onSnapshot(ref("config", "enlaces"), (s) => cb(s.exists() ? s.data() : {}), () => cb({}));
    },
    guardarEnlace: (etapa, url) => fs.setDoc(ref("config", "enlaces"), { [etapa]: url }, { merge: true }),
  };
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
  const oyentes = new Set(), oyentesEquipo = new Set(), oyentesEnlaces = new Set();
  let enlaces = {};
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
    escucharEnlaces(cb) { oyentesEnlaces.add(cb); setTimeout(() => cb({ ...enlaces }), 0); return () => oyentesEnlaces.delete(cb); },
    async guardarEnlace(etapa, url) { enlaces = { ...enlaces, [etapa]: url }; oyentesEnlaces.forEach((cb) => cb({ ...enlaces })); },
  };
}

export async function crearDatos() {
  const demo = new URLSearchParams(location.search).has("demo");
  return demo ? crearDemo() : crearFirebase();
}

export { siguiente };
