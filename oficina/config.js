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

/* ---------------------------------------------------------------------
   DEPARTAMENTOS Y AGENTES
   Para sumar un agente nuevo: agrégalo a AGENTES con su departamento y,
   si tiene instrucciones propias, el archivo .md de la carpeta agentes/.
   El mapa, el menú y el chat se arman solos a partir de esta lista.
   --------------------------------------------------------------------- */
export const DEPARTAMENTOS = [
  { id: "productos", nombre: "Fábrica de productos", color: "#7c5cff", descripcion: "Investigar, crear y vender infoproductos" },
  { id: "finanzas", nombre: "Finanzas", color: "#16a34a", descripcion: "La caja y las ventas del día" },
  { id: "contenido", nombre: "Contenido", color: "#f59e0b", descripcion: "Wemany, traducciones y piezas" },
];

// Agentes activos. "persona" es quien lo usa más; "etapa" solo la tienen los
// agentes que participan en el flujo de la fábrica de productos.
// Los personajes son originales, inspirados en un detective clásico, un hada
// del taller y una columnista de Nueva York.
export const AGENTES = [
  {
    id: "detective",
    departamento: "productos",
    etapa: "investigacion",
    nombre: "Detective",
    persona: "Santiago",
    rol: "Investigador de mercado",
    zona: "Agencia de investigación",
    color: "#a0742c",
    descripcion: "Te ayuda a buscar en la Biblioteca de anuncios, revisa los resultados y elige qué producto modelar.",
    sugerencias: [
      "Dame palabras clave para buscar en Brasil",
      "Revisa esta tabla de resultados",
      "¿Qué producto del tablero tiene más señales?",
    ],
    instrucciones: "1-detective-oficina.md",
    enlace: "https://www.facebook.com/ads/library/",
    esfuerzo: "medium",
    colores: { sombrero: "#5b4636", cinta: "#2b211a", pelo: "#3b2418", piel: "#e9b98f", ropa: "#c9a46a", ropa2: "#8a6a3e", camisa: "#f4efe4", detalle: "#9c2f2f", pantalon: "#3a3530", zapatos: "#24201c" },
    estilo: "detective",
    frases: { trabajando: "Siguiendo pistas 🔍", libre: "Café negro, sin azúcar ☕", espera: "¡Hay un caso nuevo!" },
  },
  {
    id: "hada",
    departamento: "productos",
    etapa: "producto",
    nombre: "Hada",
    persona: "Nicole",
    rol: "Creadora de producto",
    zona: "Taller del hada",
    color: "#2f9e57",
    descripcion: "Convierte la investigación en un reto propio: la app para Netlify y los bonos en PDF.",
    sugerencias: [
      "Propón un reto a partir del expediente",
      "Arma el plan de 21 días por semanas",
      "Crea el bono de alimentación",
    ],
    instrucciones: "2-creador-de-producto.md",
    esfuerzo: "high",
    colores: { pelo: "#f2cf5b", piel: "#f6d3b8", ropa: "#5fbf6a", ropa2: "#3f9a4f", pantalon: "#5fbf6a", zapatos: "#3f9a4f", detalle: "#ffffff", alas: "rgba(190, 240, 255, 0.55)" },
    estilo: "hada",
    frases: { trabajando: "Creando con polvo de hada ✨", libre: "Descansando las alas ✨", espera: "¡Hay algo para crear!" },
  },
  {
    id: "columnista",
    departamento: "productos",
    etapa: "guiones",
    nombre: "Columnista",
    persona: "Anyela",
    rol: "Guionista de ventas",
    zona: "Estudio de guiones",
    color: "#d6336c",
    descripcion: "Escribe los guiones de video para Meta y el flujo de venta de Leona por WhatsApp.",
    sugerencias: [
      "Escribe 3 guiones de video para este producto",
      "Arma el flujo completo de Leona",
      "Traduce y adapta este guion en portugués",
    ],
    instrucciones: "3-guionista.md",
    esfuerzo: "medium",
    colores: { pelo: "#e8c37a", piel: "#f3d1b8", ropa: "#e85a9a", ropa2: "#b83f78", pantalon: "#f7e3ef", zapatos: "#d6336c", detalle: "#ffffff", labios: "#c2185b" },
    estilo: "columnista",
    frases: { trabajando: "Y no pude evitar preguntarme… ✍️", libre: "Un cosmo y vuelvo 🍸", espera: "¡Hay un guion por escribir!" },
  },
];

// Agentes que vienen en camino: aparecen en el menú y en la oficina "en obra".
export const PROXIMOS = [
  { id: "caja", nombre: "Cajera", rol: "Agente de caja (en pausa)", departamento: "finanzas" },
  { id: "wemany", nombre: "Editora", rol: "Sube el contenido a Wemany", departamento: "contenido" },
  { id: "traductor", nombre: "Traductor", rol: "Traduce guiones de anuncios", departamento: "contenido" },
];

// Etapas del flujo de la fábrica de productos.
export const ETAPAS = [
  { id: "investigacion", nombre: "1 · Investigación" },
  { id: "producto", nombre: "2 · Producto" },
  { id: "guiones", nombre: "3 · Guiones" },
  { id: "listo", nombre: "Listo" },
];

export const PAISES = ["Colombia", "Venezuela", "Ecuador", "Perú", "México", "Chile", "Argentina", "Bolivia", "Brasil", "Otro"];
