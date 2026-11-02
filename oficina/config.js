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

// Dirección del servidor del chat en Cloudflare (termina en /chat).
// Ejemplo: "https://oficina-nuclea-chat.tu-subdominio.workers.dev/chat"
export const CHAT_URL = "https://oficina-nuclea-chat.nucleagentes.workers.dev/chat";

// Correos que siempre son administradores (deben coincidir con firestore.rules).
export const ADMINS = ["nucleagent@gmail.com"];

// Los tres agentes. "persona" es quien lo usa y aparece junto al avatar.
// "donde" es el enlace que abre esa persona para trabajar su turno.
// Los personajes son originales, inspirados en un detective clásico, un hada
// del taller y una columnista de Nueva York.
export const AGENTES = [
  {
    etapa: "investigacion",
    nombre: "Detective",
    persona: "Santiago",
    rol: "Investigador",
    zona: "Agencia de investigación",
    donde: "https://www.facebook.com/ads/library/",
    dondeTexto: "Abrir la Biblioteca de anuncios (usa Claude in Chrome)",
    colores: { sombrero: "#5b4636", cinta: "#2b211a", pelo: "#3b2418", piel: "#e9b98f", ropa: "#c9a46a", ropa2: "#8a6a3e", camisa: "#f4efe4", detalle: "#9c2f2f", pantalon: "#3a3530", zapatos: "#24201c" },
    estilo: "detective",
    frases: { trabajando: "Siguiendo pistas 🔍", libre: "Café negro, sin azúcar ☕", espera: "¡Hay un caso nuevo!" },
  },
  {
    etapa: "producto",
    nombre: "Hada",
    persona: "Nicole",
    rol: "Creadora de producto",
    zona: "Taller del hada",
    donde: "https://claude.ai/projects",
    dondeTexto: "Abrir el Proyecto \"2 · Creador de producto\"",
    colores: { pelo: "#f2cf5b", piel: "#f6d3b8", ropa: "#5fbf6a", ropa2: "#3f9a4f", pantalon: "#5fbf6a", zapatos: "#3f9a4f", detalle: "#ffffff", alas: "rgba(190, 240, 255, 0.55)" },
    estilo: "hada",
    frases: { trabajando: "Creando con polvo de hada ✨", libre: "Descansando las alas ✨", espera: "¡Hay algo para crear!" },
  },
  {
    etapa: "guiones",
    nombre: "Columnista",
    persona: "Anyela",
    rol: "Guionista",
    zona: "Estudio de guiones",
    donde: "https://claude.ai/projects",
    dondeTexto: "Abrir el Proyecto \"3 · Guionista\"",
    colores: { pelo: "#e8c37a", piel: "#f3d1b8", ropa: "#e85a9a", ropa2: "#b83f78", pantalon: "#f7e3ef", zapatos: "#d6336c", detalle: "#ffffff", labios: "#c2185b" },
    estilo: "columnista",
    frases: { trabajando: "Y no pude evitar preguntarme… ✍️", libre: "Un cosmo y vuelvo 🍸", espera: "¡Hay un guion por escribir!" },
  },
];

export const ETAPAS = [
  { id: "investigacion", nombre: "1 · Investigación" },
  { id: "producto", nombre: "2 · Producto" },
  { id: "guiones", nombre: "3 · Guiones" },
  { id: "listo", nombre: "Listo" },
];

export const PAISES = ["Colombia", "Venezuela", "Ecuador", "Perú", "México", "Chile", "Argentina", "Bolivia", "Brasil", "Otro"];
