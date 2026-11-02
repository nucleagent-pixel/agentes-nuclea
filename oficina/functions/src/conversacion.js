// Lógica pura del chat: arma las instrucciones y el historial que se envían a Claude.
const fs = require("node:fs");
const path = require("node:path");

const ETAPAS = ["investigacion", "producto", "guiones"];
const ARCHIVOS = {
  investigacion: "1-investigador.md",
  producto: "2-creador-de-producto.md",
  guiones: "3-guionista.md",
};
const NOMBRES = { investigacion: "Investigación", producto: "Producto", guiones: "Guiones" };

// Las instrucciones de cada agente están en agentes/*.md, debajo de la primera línea "---".
function instruccionesDe(etapa, carpeta = path.join(__dirname, "..", "agentes")) {
  const texto = fs.readFileSync(path.join(carpeta, ARCHIVOS[etapa]), "utf8");
  const i = texto.indexOf("\n---\n");
  return (i >= 0 ? texto.slice(i + 5) : texto).trim();
}

const FORMATO_CHAT = `## Cómo trabajas en la Oficina NUCLEA

Hablas con una persona del equipo en el chat de la Oficina NUCLEA. Responde en español, claro y directo.
No tienes navegador ni acceso a internet. Trabaja con lo que la persona te pega o te cuenta.

Cuando entregues archivos, escribe cada uno completo con este formato exacto, sin nada más en esas líneas:

=== ARCHIVO: nombre/del/archivo.ext ===
(contenido completo del archivo)
=== FIN ARCHIVO ===

La oficina convierte esos bloques en archivos descargables. Para la app del reto entrega index.html,
manifest.webmanifest e icon.svg en la raíz. Los íconos PNG los genera la oficina desde icon.svg.
Los bonos van como páginas HTML listas para imprimir en PDF, dentro de la carpeta bonos/ (por ejemplo bonos/guia-alimentacion.html).
Cuando corrijas un archivo, vuelve a escribirlo completo.

Cuando el trabajo esté terminado, cierra con el bloque del expediente de tu turno, como dicen tus instrucciones.`;

function sistema({ etapa, producto, conocimiento, instrucciones }) {
  const previos = ETAPAS.slice(0, ETAPAS.indexOf(etapa))
    .filter((e) => producto.expedientes?.[e])
    .map((e) => `### Expediente de ${NOMBRES[e]}\n\n${producto.expedientes[e]}`)
    .join("\n\n");
  const partes = [
    instrucciones,
    FORMATO_CHAT,
    `## Producto de este chat\n\nNombre de trabajo: ${producto.nombre}\nPaís de destino: ${producto.pais || "sin definir"}`,
    previos ? `## Lo que entregaron los agentes anteriores\n\n${previos}` : "",
    conocimiento ? `## Conocimiento de referencia del equipo\n\n${conocimiento}` : "",
  ];
  return partes.filter(Boolean).join("\n\n");
}

// Convierte los mensajes guardados en turnos alternados user/assistant.
function historial(mensajes) {
  const turnos = [];
  for (const m of mensajes) {
    if (m.estado === "error" || !m.texto?.trim()) continue;
    const role = m.rol === "agente" ? "assistant" : "user";
    const texto = role === "user" && m.quien ? `[${m.quien}] ${m.texto}` : m.texto;
    const ultimo = turnos[turnos.length - 1];
    if (ultimo && ultimo.role === role) ultimo.content += "\n\n" + texto;
    else turnos.push({ role, content: texto });
  }
  while (turnos.length && turnos[0].role !== "user") turnos.shift();
  return turnos;
}

module.exports = { ETAPAS, instruccionesDe, sistema, historial, FORMATO_CHAT };
