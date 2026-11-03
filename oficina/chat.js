// Chat siempre abierto con cada agente, a la derecha de la oficina.
// Cada agente tiene conversaciones libres y conversaciones ligadas a un producto.
import { AGENTES, ETAPAS, MODELOS, MODELO_POR_DEFECTO } from "./config.js";
import { retrato } from "./mundo.js";

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

// Una respuesta "escribiendo" de hace más de 20 minutos quedó interrumpida.
export const vivo = (m) => m.estado === "escribiendo" && !(m.creadoEn && Date.now() - Date.parse(m.creadoEn) > 20 * 60e3);

const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "producto";

const hace = (iso) => {
  if (!iso) return "";
  const min = Math.round((Date.now() - Date.parse(iso)) / 60e3);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
};
// Costo aproximado en USD de una respuesta, según los tokens que informó Claude.
export function costo(uso, modeloAgente) {
  if (!uso) return 0;
  const p = MODELOS[uso.modelo] || MODELOS[modeloAgente] || MODELOS[MODELO_POR_DEFECTO];
  return ((uso.entrada || 0) * p.entrada + (uso.salida || 0) * p.salida + (uso.cache || 0) * p.cacheLeer + (uso.cacheEscrito || 0) * p.cacheEscribir) / 1e6;
}
const usd = (n) => "US$" + (n < 0.01 ? n.toFixed(3) : n.toFixed(2)).replace(".", ",");

// Achica una imagen en el navegador (lado mayor 1568 px, JPEG) para guardarla con el mensaje.
async function prepararImagen(archivo) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    await new Promise((ok, mal) => { img.onload = ok; img.onerror = () => mal(new Error("No se pudo leer la imagen")); img.src = url; });
    const k = Math.min(1, 1568 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    let calidad = 0.85, dato;
    do { dato = c.toDataURL("image/jpeg", calidad); calidad -= 0.15; } while (dato.length > 250000 && calidad > 0.3);
    return { tipo: "image/jpeg", datos: dato.split(",")[1], url: dato };
  } finally { URL.revokeObjectURL(url); }
}
const MAX_IMAGENES = 3;

const nombreEtapa = (id) => ETAPAS.find((e) => e.id === id)?.nombre || id;

export function crearChat({ contenedor, datos, aviso, usuario, productos, conversaciones, alVerProducto, alCerrar }) {
  let ag = AGENTES[0], convId = null, productoNuevo = "", mensajes = [], dejar = null, adjuntos = [];
  const enviando = new Set();          // conversaciones a las que este navegador les está escribiendo
  const $ = (sel) => contenedor.querySelector(sel);

  const convsDe = (a) => conversaciones().filter((c) => c.agente === a.id);
  const conv = () => conversaciones().find((c) => c.id === convId);
  const producto = () => {
    const id = convId ? conv()?.productoId : productoNuevo;
    return id ? productos().find((p) => p.id === id) : null;
  };
  const ocupado = () => enviando.has(convId) || mensajes.some(vivo);

  function escuchar() {
    if (dejar) dejar();
    mensajes = [];
    dejar = convId ? datos.escucharMensajes(convId, (lista) => { mensajes = lista; pintarMensajes(); }, (e) => aviso("No se pudo leer el chat: " + (e.code || e.message))) : null;
  }

  function elegir(agente, id, deProducto = "") {
    if (agente !== ag) adjuntos = [];
    ag = agente; convId = id; productoNuevo = deProducto;
    pintar();
    escuchar();
    setTimeout(() => $("#c-texto")?.focus(), 50);
  }

  /* ---------- Esqueleto del panel ---------- */
  function pintar() {
    contenedor.style.setProperty("--agente", ag.color || "#7c5cff");
    contenedor.innerHTML = `
      <div class="dock-agentes" role="tablist">${AGENTES.map((a) => `
        <button class="dock-tab ${a.id === ag.id ? "activo" : ""}" data-ag="${esc(a.id)}" title="${esc(a.nombre)} · ${esc(a.persona)}" role="tab">
          <img src="${retrato(a, 32)}" alt=""><span class="punto" data-punto="${esc(a.id)}"></span></button>`).join("")}
        <button class="b-icono dock-cerrar" id="c-cerrar" aria-label="Cerrar chat">✕</button>
      </div>
      <header class="dock-cabeza">
        <img class="retrato" src="${retrato(ag, 44)}" alt="">
        <div class="dock-quien"><b>${esc(ag.nombre)} · ${esc(ag.persona)}</b><small id="c-estado">${esc(ag.rol)}</small></div>
        <button class="btn btn-sec btn-mini" id="c-nueva">+ Nueva</button>
      </header>
      <div class="dock-conv"><select id="c-conv" aria-label="Conversación"></select></div>
      <div id="c-contexto"></div>
      <div class="chat-mensajes" id="c-mensajes"></div>
      <div class="chat-archivos" id="c-archivos"></div>
      <form class="chat-escribir" id="c-form">
        <div class="adjuntos" id="c-adjuntos"></div>
        <textarea id="c-texto" rows="2" placeholder="Escríbele a ${esc(ag.nombre)}…${ag.imagenes ? " (puedes pegar imágenes)" : ""}"></textarea>
        <div class="fila-envio">
          ${ag.imagenes ? `<label class="b-adjuntar" title="Subir imágenes">🖼️<input type="file" id="c-archivo" accept="image/*" multiple hidden></label>` : ""}
          <span class="modelo" id="c-modelo"></span>
          <button type="button" class="btn btn-sec btn-mini" id="c-entregar" hidden></button>
          <button class="btn-enviar" id="c-enviar" aria-label="Enviar">↑</button>
        </div>
      </form>`;
    contenedor.querySelectorAll("[data-ag]").forEach((b) => (b.onclick = () => abrirAgente(AGENTES.find((a) => a.id === b.dataset.ag))));
    $("#c-cerrar").onclick = () => alCerrar?.();
    $("#c-nueva").onclick = () => elegir(ag, null);
    $("#c-conv").onchange = (e) => elegir(ag, e.target.value || null);
    const form = $("#c-form"), area = $("#c-texto");
    area.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } };
    area.oninput = () => { area.style.height = "auto"; area.style.height = Math.min(area.scrollHeight, 220) + "px"; };
    form.onsubmit = (e) => { e.preventDefault(); enviar(area.value.trim()); };
    if (ag.imagenes) {
      $("#c-archivo").onchange = (e) => { agregarImagenes([...e.target.files]); e.target.value = ""; };
      area.addEventListener("paste", (e) => {
        const imgs = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
        if (imgs.length) { e.preventDefault(); agregarImagenes(imgs); }
      });
    }
    pintarAdjuntos();
    $("#c-entregar").onclick = entregar;
    refrescar();
    pintarMensajes();
  }

  /* ---------- Partes que cambian con el tablero ---------- */
  function refrescar() {
    if (!$("#c-conv")) return;
    const lista = convsDe(ag);
    $("#c-conv").innerHTML = `<option value="">✨ Nueva conversación</option>` + lista.map((c) =>
      `<option value="${esc(c.id)}" ${c.id === convId ? "selected" : ""}>${c.productoId ? "📦" : "💬"} ${esc(c.titulo || "Sin título")} · ${esc(hace(c.actualizadoEn))}</option>`).join("");
    if (!convId) $("#c-conv").value = "";
    AGENTES.forEach((a) => {
      const p = contenedor.querySelector(`[data-punto="${a.id}"]`);
      if (p) p.classList.toggle("on", convsDe(a).some((c) => c.escribiendo));
    });
    const escribe = ocupado() || conv()?.escribiendo;
    $("#c-estado").innerHTML = escribe ? `<span class="vivo">● Escribiendo…</span>` : `${esc(ag.rol)} · <span class="en-linea">● En línea</span>`;
    pintarContexto();
    pintarBotones();
  }

  function pintarContexto() {
    const zona = $("#c-contexto");
    const p = producto();
    let html = "";
    if (p) {
      const turno = p.etapa === "listo" ? "Listo" : `${nombreEtapa(p.etapa)}${p.estado === "en_curso" ? " · en curso" + (p.responsable?.nombre ? " con " + p.responsable.nombre : "") : " · por tomar"}`;
      html += `<div class="franja-producto"><span>📦 <b>${esc(p.nombre)}</b> · ${esc(p.pais || "")}<small>${esc(turno)}</small></span>
        <button type="button" class="btn btn-sec btn-mini" id="c-ver">Ver</button></div>`;
    }
    if (ag.enlace) {
      html += `<p class="nota ayuda">No navego por internet: busca con Claude in Chrome en la <a href="${esc(ag.enlace)}" target="_blank" rel="noopener">Biblioteca de anuncios</a> y pégame la tabla. <button type="button" class="btn btn-sec btn-mini" id="c-chrome">📋 Instrucciones para Chrome</button></p>`;
    }
    zona.innerHTML = html;
    const ver = $("#c-ver");
    if (ver) ver.onclick = () => alVerProducto?.(p);
    const chrome = $("#c-chrome");
    if (chrome) chrome.onclick = async () => {
      try {
        const t = await (await fetch("instrucciones-chrome.txt")).text();
        await navigator.clipboard.writeText(t);
        aviso("Copiado. Pégalo al inicio de la conversación en Claude in Chrome");
      } catch { aviso("No se pudo copiar"); }
    };
  }

  /* ---------- Mensajes ---------- */
  function vacio() {
    const lista = productos().filter((p) => p.etapa !== "listo");
    const mios = ag.etapa ? lista.filter((p) => p.etapa === ag.etapa) : [];
    const otros = lista.filter((p) => !mios.includes(p));
    const opcion = (p) => `<option value="${esc(p.id)}" ${p.id === productoNuevo ? "selected" : ""}>${esc(p.nombre)} · ${esc(p.pais || "")}</option>`;
    return `<div class="chat-vacio">
      <img src="${retrato(ag, 72)}" alt="">
      <h3>Hola, soy ${esc(ag.nombre)}</h3>
      <p>${esc(ag.descripcion || ag.rol)}</p>
      <label class="sobre">Sobre un producto (opcional)
        <select id="c-sobre"><option value="">Conversación libre</option>
          ${mios.length ? `<optgroup label="En mi turno">${mios.map(opcion).join("")}</optgroup>` : ""}
          ${otros.length ? `<optgroup label="Otros productos">${otros.map(opcion).join("")}</optgroup>` : ""}
        </select></label>
      <div class="sugerencias">${(ag.sugerencias || []).map((s) => `<button type="button" class="sugerencia">${esc(s)}</button>`).join("")}</div>
    </div>`;
  }

  function pintarMensajes() {
    const caja = $("#c-mensajes");
    if (!caja) return;
    if (!convId && !enviando.has(null)) {
      caja.innerHTML = vacio();
      const sobre = $("#c-sobre");
      sobre.onchange = () => {
        const c = sobre.value && convsDe(ag).find((x) => x.productoId === sobre.value);
        if (c) return elegir(ag, c.id);          // ya hay una conversación de ese producto
        productoNuevo = sobre.value; pintarContexto(); pintarBotones();
      };
      caja.querySelectorAll(".sugerencia").forEach((b) => (b.onclick = () => enviar(b.textContent)));
      pintarBotones();
      $("#c-archivos").innerHTML = "";
      return;
    }
    const abajo = caja.scrollHeight - caja.scrollTop - caja.clientHeight < 80;
    caja.innerHTML = mensajes.map((m) => {
      const escribiendo = vivo(m);
      if (m.estado === "escribiendo" && !escribiendo) m = { ...m, estado: "error", error: "La respuesta se interrumpió (se cerró la página). Envía el mensaje otra vez." };
      return m.rol === "agente"
        ? `<div class="msj agente"><img src="${retrato(ag, 28)}" alt=""><div class="burbuja agente">${formato(m.texto, escribiendo)}${escribiendo ? `<span class="cursor">▍</span>` : ""}${m.estado === "error" ? `<p class="error">${esc(m.error || "No se pudo completar la respuesta")}</p>` : ""}${m.uso ? `<span class="costo" title="Costo aproximado de esta respuesta">≈ ${usd(costo(m.uso, ag.modelo))}</span>` : ""}</div></div>`
        : `<div class="msj persona"><div class="burbuja persona"><small>${esc(m.quien || "")}</small>${(m.imagenes || []).map((i) => `<img class="adjunta" src="${i.url || `data:${esc(i.tipo)};base64,${esc(i.datos)}`}" alt="Imagen adjunta">`).join("")}${esc(m.texto)}</div></div>`;
    }).join("") || `<p class="nota centro-txt">Cargando…</p>`;
    if (abajo || enviando.has(convId)) caja.scrollTop = caja.scrollHeight;
    pintarBotones();
    pintarArchivos();
  }

  function pintarBotones() {
    const ocup = ocupado();
    const boton = $("#c-enviar");
    if (boton) { boton.disabled = ocup; boton.classList.toggle("girando", ocup); }
    const p = producto(), exp = expedienteDe(mensajes), ent = $("#c-entregar");
    if (ent) {
      ent.hidden = !(p && ag.etapa && p.etapa === ag.etapa && exp && !ocup);
      const sig = AGENTES.find((a) => a.etapa === siguiente(ag.etapa));
      ent.textContent = sig ? `Entregar a ${sig.nombre} →` : "Marcar como listo ✓";
    }
    const lab = $("#c-modelo");
    if (lab) {
      const total = mensajes.reduce((s, m) => s + costo(m.uso, ag.modelo), 0);
      lab.textContent = `Claude ${(MODELOS[ag.modelo] || MODELOS[MODELO_POR_DEFECTO]).nombre}${total ? " · esta conversación ≈ " + usd(total) : " · ve todo el tablero"}`;
    }
    const est = $("#c-estado");
    if (est) est.innerHTML = ocup ? `<span class="vivo">● Escribiendo…</span>` : `${esc(ag.rol)} · <span class="en-linea">● En línea</span>`;
  }

  function pintarArchivos() {
    const zona = $("#c-archivos");
    if (!zona) return;
    const archivos = archivosDe(mensajes), ocup = ocupado();
    if (!archivos.size) { zona.innerHTML = ""; return; }
    const app = [...archivos.keys()].filter((r) => !r.startsWith("bonos/"));
    const otros = [...archivos.keys()].filter((r) => r.startsWith("bonos/"));
    zona.innerHTML = `${app.length ? `<button class="btn btn-sec btn-mini" id="c-zip" ${ocup ? "disabled" : ""}>⬇ App para Netlify (.zip)</button>` : ""}
      ${otros.map((r) => `<button class="btn btn-sec btn-mini" data-archivo="${esc(r)}" ${ocup ? "disabled" : ""}>⬇ ${esc(r.replace("bonos/", ""))}</button>`).join("")}`;
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
    descargar(slug(producto()?.nombre || conv()?.titulo || "producto") + "-netlify.zip", await zip.generateAsync({ type: "blob" }));
  }

  /* ---------- Enviar y entregar ---------- */
  async function agregarImagenes(archivos) {
    for (const f of archivos) {
      if (adjuntos.length >= MAX_IMAGENES) { aviso(`Máximo ${MAX_IMAGENES} imágenes por mensaje`); break; }
      if (!f.type.startsWith("image/")) continue;
      try { adjuntos.push(await prepararImagen(f)); } catch (e) { aviso(e.message); }
    }
    pintarAdjuntos();
  }

  function pintarAdjuntos() {
    const zona = $("#c-adjuntos");
    if (!zona) return;
    zona.innerHTML = adjuntos.map((a, i) => `<span class="miniatura"><img src="${a.url}" alt=""><button type="button" data-quitar="${i}" aria-label="Quitar imagen">✕</button></span>`).join("");
    zona.querySelectorAll("[data-quitar]").forEach((b) => (b.onclick = () => { adjuntos.splice(Number(b.dataset.quitar), 1); pintarAdjuntos(); }));
  }

  async function enviar(texto) {
    const imagenes = adjuntos;
    if ((!texto && !imagenes.length) || ocupado()) return;
    if (!texto) texto = imagenes.length > 1 ? "(Te envío estas imágenes)" : "(Te envío esta imagen)";
    adjuntos = []; pintarAdjuntos();
    const area = $("#c-texto");
    if (area) { area.value = ""; area.style.height = ""; }
    const agente = ag, p = producto();
    let id = convId;
    const c = id ? conv() : { titulo: "" };
    enviando.add(id);
    if (!id) { mensajes = [{ rol: "persona", quien: usuario().nombre, texto, imagenes, estado: "listo" }, { rol: "agente", texto: "", estado: "escribiendo", creadoEn: new Date().toISOString() }]; pintarMensajes(); }
    pintarBotones();
    try {
      await datos.enviarMensaje({
        conv: c || { id }, agente, producto: p, texto, imagenes,
        alCrear(nuevo) {
          enviando.delete(null); enviando.add(nuevo); id = nuevo;
          if (ag === agente && !convId) { convId = nuevo; productoNuevo = ""; escuchar(); refrescar(); }
        },
      });
    } catch (err) {
      aviso(err.message);
      const a = $("#c-texto");
      if (a && !a.value && ag === agente) { a.value = texto; adjuntos = imagenes; pintarAdjuntos(); }
    } finally {
      enviando.delete(id);
      enviando.delete(null);
      if (ag === agente) { pintarBotones(); pintarArchivos(); }
    }
  }

  async function entregar() {
    const p = producto(), exp = expedienteDe(mensajes);
    if (!p || !exp) return;
    const sig = AGENTES.find((a) => a.etapa === siguiente(ag.etapa));
    if (!confirm(`¿Entregar "${p.nombre}" ${sig ? "a " + sig.nombre : "como listo"} con el último expediente de esta conversación?`)) return;
    try {
      if (p.estado !== "en_curso") await datos.tomarTurno(p);
      await datos.entregar({ ...p, estado: "en_curso" }, exp);
      aviso(sig ? `Entregado. Le toca a ${sig.nombre}` : "¡Producto listo!");
    } catch (e) { aviso("No se pudo entregar: " + (e.code || e.message)); }
  }

  const siguiente = (etapa) => ETAPAS[ETAPAS.findIndex((e) => e.id === etapa) + 1]?.id;

  /* ---------- Lo que usa la app ---------- */
  function abrirAgente(agente) {
    if (agente.id === ag.id && contenedor.firstChild) return refrescar();
    const ultima = convsDe(agente)[0];
    elegir(agente, ultima?.id || null);
  }
  function abrirProducto(p, agente = AGENTES.find((a) => a.etapa === p.etapa) || ag) {
    const c = convsDe(agente).find((x) => x.productoId === p.id);
    elegir(agente, c?.id || null, c ? "" : p.id);
  }
  function abrirConversacion(id) {
    const c = conversaciones().find((x) => x.id === id);
    const agente = c && AGENTES.find((a) => a.id === c.agente);
    if (agente) elegir(agente, id);
  }

  elegir(ag, null);
  return { abrirAgente, abrirProducto, abrirConversacion, refrescar, agente: () => ag };
}
