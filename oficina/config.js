/* =====================================================================
   CONFIGURACIÓN DE LA OFICINA — edita esto sin tocar el resto
   ===================================================================== */

// Proyecto de Firebase de la oficina. Estos datos no son secretos.
export const FIREBASE = {
  apiKey: "AIzaSyAzdz7YB2tevxQiL_n0st1_LcWvHAS9BKc",
  authDomain: "agents-730ec.firebaseapp.com",
  projectId: "agents-730ec",
  storageBucket: "agents-730ec.firebasestorage.app",
  messagingSenderId: "931808505007",
  appId: "1:931808505007:web:6aa7ffa2891eb9a387f85a",
};

// Correos que siempre son administradores (deben coincidir con firestore.rules).
export const ADMINS = ["nucleagent@gmail.com"];

// Los tres agentes. "donde" es el enlace que abre cada persona para trabajar
// su turno: la extensión de Chrome o el Proyecto de Claude correspondiente.
export const AGENTES = [
  {
    etapa: "investigacion",
    nombre: "Inés",
    rol: "Investigadora",
    zona: "Investigación",
    donde: "https://www.facebook.com/ads/library/",
    dondeTexto: "Abrir la Biblioteca de anuncios (usa Claude in Chrome)",
    colores: { pelo: "#3b2418", piel: "#f1c7a5", ropa: "#d9a13b", pantalon: "#5a4a3a", zapatos: "#2b2b2b", gafas: "#1d1d1d" },
    estilo: "bob",
  },
  {
    etapa: "producto",
    nombre: "Teo",
    rol: "Creador de producto",
    zona: "Taller de producto",
    donde: "https://claude.ai/projects",
    dondeTexto: "Abrir el Proyecto \"2 · Creador de producto\"",
    colores: { pelo: "#1f1a17", piel: "#c98b62", ropa: "#3f8f6b", pantalon: "#2f3b55", zapatos: "#e8e2d8" },
    estilo: "rizos",
  },
  {
    etapa: "guiones",
    nombre: "Gabi",
    rol: "Guionista",
    zona: "Estudio de guiones",
    donde: "https://claude.ai/projects",
    dondeTexto: "Abrir el Proyecto \"3 · Guionista\"",
    colores: { pelo: "#a8432a", piel: "#f3d1b8", ropa: "#7b4fa3", pantalon: "#2d2d3a", zapatos: "#7b4fa3" },
    estilo: "largo",
  },
];

export const ETAPAS = [
  { id: "investigacion", nombre: "1 · Investigación" },
  { id: "producto", nombre: "2 · Producto" },
  { id: "guiones", nombre: "3 · Guiones" },
  { id: "listo", nombre: "Listo" },
];

export const PAISES = ["Colombia", "Venezuela", "Ecuador", "Perú", "México", "Chile", "Argentina", "Bolivia", "Brasil", "Otro"];
