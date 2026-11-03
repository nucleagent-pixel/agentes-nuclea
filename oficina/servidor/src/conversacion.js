// Lógica pura del chat: arma las instrucciones y el historial que se envían a Claude.
export const ETAPAS = ["investigacion", "producto", "guiones"];
const NOMBRES = { investigacion: "Investigación", producto: "Producto", guiones: "Guiones", listo: "Listo" };

// Las instrucciones de cada agente están en agentes/*.md, debajo de la primera línea "---".
export function sinEncabezado(texto) {
  const i = texto.indexOf("\n---\n");
  return (i >= 0 ? texto.slice(i + 5) : texto).trim();
}

// Instrucciones para un agente que todavía no tiene su archivo .md.
export const generico = (ag) =>
  `Eres ${ag.nombre}, ${ag.rol.toLowerCase()} de NUCLEA. ${ag.descripcion || ""}\n\nNUCLEA vende infoproductos de bienestar en Latinoamérica con anuncios en Meta y cierra las ventas por WhatsApp con el bot Leona. Ayuda a la persona con lo que te pida, de forma práctica y concreta.`;

export const FORMATO_CHAT = `## Cómo trabajas en la Oficina NUCLEA

Hablas con una persona del equipo en el chat de la Oficina NUCLEA. Responde en español, claro y directo.
No tienes navegador ni acceso a internet. Trabaja con lo que la persona te pega o te cuenta, y con el estado de la oficina que ves abajo.
Los mensajes del equipo empiezan con el nombre de quien escribe entre corchetes.
No toda conversación es sobre un producto: la persona puede preguntarte cualquier cosa de tu área. Si te pregunta por el trabajo de otro agente, usa lo que ves en el tablero y dile qué agente lo puede ayudar.

Cuando entregues archivos, escribe cada uno completo con este formato exacto, sin nada más en esas líneas:

=== ARCHIVO: nombre/del/archivo.ext ===
(contenido completo del archivo)
=== FIN ARCHIVO ===

La oficina convierte esos bloques en archivos descargables. Para la app del reto entrega index.html,
manifest.webmanifest e icon.svg en la raíz. Los íconos PNG los genera la oficina desde icon.svg.
Los bonos van como páginas HTML listas para imprimir en PDF, dentro de la carpeta bonos/ (por ejemplo bonos/guia-alimentacion.html).
Cuando corrijas un archivo, vuelve a escribirlo completo.

Cuando la conversación sea sobre un producto y el trabajo de tu turno esté terminado, cierra con el bloque del expediente de tu turno, como dicen tus instrucciones.`;

const recortar = (t, n) => (t.length > n ? t.slice(0, n) + "\n[…]" : t);

// Quién es quién: los agentes de la oficina y las personas que los usan.
export function equipo(agentes, proximos = []) {
  const filas = agentes.map((a) => `- ${a.nombre} (lo usa ${a.persona}): ${a.rol}. ${a.descripcion || ""}`);
  const despues = proximos.map((a) => `- ${a.nombre}: ${a.rol} (todavía no existe)`);
  return `## Los agentes de la oficina\n\n${filas.join("\n")}${despues.length ? "\n\nEn camino:\n" + despues.join("\n") : ""}`;
}

// Resumen del tablero de la fábrica de productos, para que cada agente sepa qué hacen los demás.
export function tablero(productos, agentes, { excepto } = {}) {
  if (!productos.length) return "## Tablero de la fábrica de productos\n\nTodavía no hay productos.";
  const quien = (etapa) => agentes.find((a) => a.etapa === etapa)?.nombre;
  let presupuesto = 24000;
  const filas = productos.slice(0, 40).map((p) => {
    const estado = p.etapa === "listo" ? "listo"
      : p.estado === "en_curso" ? `en curso con ${quien(p.etapa) || p.etapa}${p.responsable?.nombre ? " (" + p.responsable.nombre + ")" : ""}`
      : `por tomar, le toca a ${quien(p.etapa) || p.etapa}`;
    let fila = `### ${p.nombre} · ${p.pais || "sin país"} · ${estado}`;
    if (p.id !== excepto) {
      for (const e of ETAPAS) {
        const exp = p.expedientes?.[e];
        if (!exp || presupuesto <= 0) continue;
        const corto = recortar(exp, Math.min(1500, presupuesto));
        presupuesto -= corto.length;
        fila += `\n\nExpediente de ${NOMBRES[e]}:\n${corto}`;
      }
    }
    return fila;
  });
  return `## Tablero de la fábrica de productos\n\n${filas.join("\n\n")}`;
}

export function sistema({ agente, agentes, proximos, producto, productos = [], conocimiento, instrucciones }) {
  let delProducto = "";
  if (producto) {
    const hasta = agente.etapa ? ETAPAS.indexOf(agente.etapa) : ETAPAS.length;
    const previos = ETAPAS.slice(0, hasta < 0 ? ETAPAS.length : hasta)
      .filter((e) => producto.expedientes?.[e])
      .map((e) => `### Expediente de ${NOMBRES[e]}\n\n${producto.expedientes[e]}`)
      .join("\n\n");
    delProducto = `## Producto de esta conversación\n\nNombre de trabajo: ${producto.nombre}\nPaís de destino: ${producto.pais || "sin definir"}\nEtapa actual: ${NOMBRES[producto.etapa] || producto.etapa}`
      + (previos ? `\n\n## Lo que entregaron los agentes anteriores\n\n${previos}` : "");
  }
  return [
    instrucciones,
    FORMATO_CHAT,
    equipo(agentes, proximos),
    tablero(productos, agentes, { excepto: producto?.id }),
    delProducto || "## Esta conversación\n\nEs una conversación libre, no está ligada a un producto.",
    conocimiento ? `## Conocimiento de referencia del equipo\n\n${conocimiento}` : "",
  ].filter(Boolean).join("\n\n");
}

// Convierte los mensajes guardados en turnos alternados user/assistant.
// Las imágenes que subió la persona van como bloques de imagen antes del texto.
export function historial(mensajes) {
  const turnos = [];
  for (const m of mensajes) {
    const imagenes = m.rol === "agente" ? [] : (m.imagenes || []).filter((i) => i?.datos && /^image\/(jpeg|png|gif|webp)$/.test(i.tipo));
    if (m.estado === "error" || m.estado === "escribiendo" || (!m.texto?.trim() && !imagenes.length)) continue;
    const role = m.rol === "agente" ? "assistant" : "user";
    const texto = role === "user" && m.quien ? `[${m.quien}] ${m.texto || ""}` : m.texto;
    const bloques = [
      ...imagenes.map((i) => ({ type: "image", source: { type: "base64", media_type: i.tipo, data: i.datos } })),
      { type: "text", text: texto },
    ];
    const ultimo = turnos[turnos.length - 1];
    if (ultimo && ultimo.role === role) ultimo.bloques.push(...bloques);
    else turnos.push({ role, bloques });
  }
  while (turnos.length && turnos[0].role !== "user") turnos.shift();
  // Si un turno es solo texto, se envía como un texto simple.
  return turnos.map(({ role, bloques }) => ({
    role,
    content: bloques.every((b) => b.type === "text") ? bloques.map((b) => b.text).join("\n\n") : bloques,
  }));
}
