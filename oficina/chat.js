// Panel de chat con cada agente: se abre al tocar un avatar en la oficina.
import { AGENTES, ETAPAS } from "./config.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const BLOQUE_ARCHIVO = /=== ARCHIVO: (.+?) ===\n([\s\S]*?)(?:\n=== FIN ARCHIVO ===|$)/g;

// Archivos que entregó el agente en el chat (la última versión de cada uno).
export function archivosDe(mensajes) {
  const archivos = new Map();
  for (const m of mensajes) {
    if (m.rol !== "agente") continue;
    for (const [, ruta, contenido] of m.texto.matchAll(BLOQUE_ARCHIVO)) archivos.set(ruta.trim(), contenido);
  }
  return archivos;
}

// El último bloque de expediente que escribió el agente.
export function expedienteDe(mensajes) {
  for (let i = mensajes.length - 1; i >= 0; i--) {
    const m = mensajes[i];
    if (m.rol !== "agente" || m.estado !== "listo") continue;
    const ini = m.texto.lastIndexOf("=== EXPEDIENTE");
    if (ini < 0) continue;
    const resto = m.texto.slice(ini);
    const fin = resto.match(/=== FIN TURNO[^\n]*===/);
    return fin ? resto.slice(0, fin.index + fin[0].length) : resto.trim();
  }
  return "";
}

// Markdown sencillo: negritas, código, títulos y archivos como fichas.
function formato(texto, escribiendo) {
  let t = esc(texto).replace(/=== ARCHIVO: (.+?) ===\n([\s\S]*?)(?:\n=== FIN ARCHIVO ===|$)/g, (_, ruta, cont, i, todo) => {
    const abierto = !todo.slice(i).includes("=== FIN ARCHIVO ===");
    const kb = Math.max(1, Math.round(cont.length / 1024));
    return `<span class="ficha">📄 ${ruta} · ${abierto && escribiendo ? "escribiendo…" : kb + " KB"}</span>`;
  });
  t = t.replace(/^#{1,4} (.+)$/gm, "<b class=\"titulo\">$1</b>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/(=== EXPEDIENTE[\s\S]*?(?:=== FIN TURNO[^\n]*===|$))/g, "<span class=\"expediente\">$1</span>");
  return t;
}

let JSZip = null;
async function cargarZip() {
  if (JSZip) return JSZip;
  await new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = ok; s.onerror = () => mal(new Error("No se pudo cargar el compresor"));
    document.head.appendChild(s);
  });
  return (JSZip = window.JSZip);
}

async function pngDesdeSvg(svg, lado) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise((ok, mal) => { img.onload = ok; img.onerror = () => mal(new Error("icon.svg no es una imagen válida")); img.src = url; });
    const c = document.createElement("canvas");
    c.width = c.height = lado;
    c.getContext("2d").drawImage(img, 0, 0, lado, lado);
    return await new Promise((ok) => c.toBlob(ok, "image/png"));
  } finally { URL.revokeObjectURL(url); }
}

function descargar(nombre, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "producto";

export function crearChat({ dialogo, datos, aviso, usuario, productos }) {
  let ag = null, productoId = null, mensajes = [], dejar = null, enviando = false;

  const delAgente = () => productos().filter((p) => p.etapa === ag.etapa || p.expedientes?.[ag.etapa]);
  const actual = () => productos().find((p) => p.id === productoId);
  const siguiente = (etapa) => ETAPAS[ETAPAS.findIndex((e) => e.id === etapa) + 1]?.id;

  function escuchar() {
    if (dejar) dejar();
    mensajes = [];
    dejar = productoId ? datos.escucharMensajes(productoId, ag.etapa, (lista) => { mensajes = lista; pintarMensajes(); }, (e) => aviso("No se pudo leer el chat: " + (e.code || e.message))) : null;
  }

  function abrir(agente) {
    ag = agente;
    const lista = delAgente();
    const enTurno = lista.filter((p) => p.etapa === ag.etapa);
    const mio = enTurno.find((p) => p.responsable?.correo === usuario().correo);
    productoId = (mio || enTurno[0] || lista[0])?.id || null;
    pintar();
    escuchar();
    if (!dialogo.open) dialogo.show();   // sin fondo oscuro: la oficina se sigue viendo
    setTimeout(() => dialogo.querySelector("#c-texto")?.focus(), 50);
  }

  function pintar() {
    const lista = delAgente();
    const p = actual();
    const ayuda = ag.etapa === "investigacion"
      ? `<p class="nota">El ${esc(ag.nombre)} no navega por internet. Busca con Claude in Chrome en la <a href="${esc(ag.donde)}" target="_blank" rel="noopener">Biblioteca de anuncios</a> y pega aquí lo que encontraste.</p>`
      : "";
    dialogo.innerHTML = `<div class="chat">
      <header class="chat-cabeza">
        <div><b>${esc(ag.nombre)}</b> · ${esc(ag.persona || "")} <span class="nota">${esc(ag.rol)}</span></div>
        <button class="btn btn-sec" id="c-cerrar" aria-label="Cerrar">✕</button>
      </header>
      ${lista.length ? `<label class="chat-producto">Producto
        <select id="c-producto">${lista.map((x) => `<option value="${esc(x.id)}" ${x.id === productoId ? "selected" : ""}>${esc(x.nombre)} · ${esc(x.pais || "")}${x.etapa !== ag.etapa ? " (ya entregado)" : ""}</option>`).join("")}</select>
      </label>` : `<p class="nota chat-vacio">No hay productos en el turno de ${esc(ag.nombre)}. ${ag.etapa === "investigacion" ? "Crea uno con <b>+ Nuevo producto</b>." : "Llegan aquí cuando el agente anterior entrega."}</p>`}
      ${ayuda}
      <div class="chat-mensajes" id="c-mensajes"></div>
      <div class="chat-archivos" id="c-archivos"></div>
      ${p ? `<form class="chat-escribir" id="c-form">
        <textarea id="c-texto" rows="3" placeholder="Escríbele a ${esc(ag.nombre)}… (Ctrl + Enter para enviar)"></textarea>
        <div class="botones">
          <button type="button" class="btn btn-sec" id="c-entregar" hidden></button>
          <button class="btn" id="c-enviar">Enviar</button>
        </div>
      </form>` : ""}
    </div>`;
    dialogo.querySelector("#c-cerrar").onclick = () => dialogo.close();
    const sel = dialogo.querySelector("#c-producto");
    if (sel) sel.onchange = () => { productoId = sel.value; pintar(); escuchar(); };
    const form = dialogo.querySelector("#c-form");
    if (form) {
      const area = form.querySelector("#c-texto");
      area.onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } };
      form.onsubmit = async (e) => {
        e.preventDefault();
        const texto = area.value.trim();
        if (!texto || enviando) return;
        enviando = true; area.value = ""; pintarMensajes();
        try { await datos.enviarMensaje(actual(), ag.etapa, texto); }
        catch (err) { aviso(err.message); if (!area.value) area.value = texto; }
        finally { enviando = false; pintarMensajes(); }
      };
      form.querySelector("#c-entregar").onclick = entregar;
    }
    pintarMensajes();
  }

  function pintarMensajes() {
    const caja = dialogo.querySelector("#c-mensajes");
    if (!caja) return;
    const abajo = caja.scrollHeight - caja.scrollTop - caja.clientHeight < 80;
    caja.innerHTML = mensajes.length ? mensajes.map((m) => {
      const escribiendo = m.estado === "escribiendo";
      return m.rol === "agente"
        ? `<div class="burbuja agente ${escribiendo ? "escribiendo" : ""}"><small>${esc(ag.nombre)}</small>${formato(m.texto, escribiendo)}${escribiendo ? `<span class="cursor">▍</span>` : ""}${m.estado === "error" ? `<p class="error">${esc(m.error || "No se pudo completar la respuesta")}</p>` : ""}</div>`
        : `<div class="burbuja persona"><small>${esc(m.quien || "")}</small>${esc(m.texto)}</div>`;
    }).join("") : `<p class="nota chat-vacio">${productoId ? `Empieza la conversación. ${esc(ag.nombre)} ya conoce el producto y lo que entregaron los agentes anteriores.` : ""}</p>`;
    if (abajo || enviando) caja.scrollTop = caja.scrollHeight;

    const ocupado = enviando || mensajes.some((m) => m.estado === "escribiendo");
    const boton = dialogo.querySelector("#c-enviar");
    if (boton) { boton.disabled = ocupado; boton.textContent = ocupado ? "Escribiendo…" : "Enviar"; }

    const p = actual();
    const ent = dialogo.querySelector("#c-entregar");
    const exp = expedienteDe(mensajes);
    if (ent) {
      ent.hidden = !(p && p.etapa === ag.etapa && exp && !ocupado);
      const sig = AGENTES.find((a) => a.etapa === siguiente(ag.etapa));
      ent.textContent = sig ? `Entregar a ${sig.nombre}` : "Marcar como listo";
    }
    pintarArchivos(ocupado);
  }

  function pintarArchivos(ocupado) {
    const zona = dialogo.querySelector("#c-archivos");
    if (!zona) return;
    const archivos = archivosDe(mensajes);
    if (!archivos.size) { zona.innerHTML = ""; return; }
    const app = [...archivos.keys()].filter((r) => !r.startsWith("bonos/"));
    const otros = [...archivos.keys()].filter((r) => r.startsWith("bonos/"));
    zona.innerHTML = `${app.length ? `<button class="btn btn-sec" id="c-zip" ${ocupado ? "disabled" : ""}>⬇ App para Netlify (.zip)</button>` : ""}
      ${otros.map((r) => `<button class="btn btn-sec" data-archivo="${esc(r)}" ${ocupado ? "disabled" : ""}>⬇ ${esc(r.replace("bonos/", ""))}</button>`).join("")}`;
    const zip = zona.querySelector("#c-zip");
    if (zip) zip.onclick = () => bajarZip(archivos, app).catch((e) => aviso(e.message));
    zona.querySelectorAll("[data-archivo]").forEach((b) => (b.onclick = () => {
      const r = b.dataset.archivo;
      descargar(r.split("/").pop(), new Blob([archivos.get(r)], { type: "text/html" }));
    }));
  }

  async function bajarZip(archivos, rutas) {
    const Zip = await cargarZip();
    const zip = new Zip();
    rutas.forEach((r) => zip.file(r, archivos.get(r)));
    if (archivos.has("icon.svg")) {
      for (const lado of [192, 512]) if (!archivos.has(`icon-${lado}.png`)) zip.file(`icon-${lado}.png`, await pngDesdeSvg(archivos.get("icon.svg"), lado));
    }
    descargar(slug(actual()?.nombre || "producto") + "-netlify.zip", await zip.generateAsync({ type: "blob" }));
  }

  async function entregar() {
    const p = actual(), exp = expedienteDe(mensajes);
    if (!p || !exp) return;
    const sig = AGENTES.find((a) => a.etapa === siguiente(ag.etapa));
    if (!confirm(`¿Entregar "${p.nombre}" ${sig ? "a " + sig.nombre : "como listo"} con el último expediente del chat?`)) return;
    try {
      if (p.estado !== "en_curso") await datos.tomarTurno(p);
      await datos.entregar({ ...p, estado: "en_curso" }, exp);
      aviso(sig ? `Entregado. Le toca a ${sig.nombre}` : "¡Producto listo!");
      dialogo.close();
    } catch (e) { aviso("No se pudo entregar: " + (e.code || e.message)); }
  }

  dialogo.addEventListener("close", () => { if (dejar) dejar(); dejar = null; });

  return {
    abrir,
    // Cuando cambian los productos (otra persona entregó, etc.), refresca el selector.
    refrescar() { if (dialogo.open && ag) { const t = dialogo.querySelector("#c-texto")?.value; pintar(); const a = dialogo.querySelector("#c-texto"); if (a && t) a.value = t; } },
  };
}
