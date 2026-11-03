import { AGENTES, DEPARTAMENTOS, PROXIMOS, ETAPAS, PAISES } from "./config.js";
import { crearDatos } from "./datos.js";
import { crearOficina, retrato } from "./mundo.js";
import { crearChat } from "./chat.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const agenteDe = (etapa) => AGENTES.find((a) => a.etapa === etapa);
const nombreEtapa = (etapa) => ETAPAS.find((e) => e.id === etapa)?.nombre || etapa;
const fecha = (iso) => (iso ? new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "");
const deptoDe = (id) => DEPARTAMENTOS.find((d) => d.id === id);
// Una conversación marcada "escribiendo" hace más de 20 minutos quedó interrumpida.
const escribe = (c) => c.escribiendo && !(c.actualizadoEn && Date.now() - Date.parse(c.actualizadoEn) > 20 * 60e3);

let datos, usuario = null, productos = [], conversaciones = [], equipo = [];
let oficina = null, chat = null, abierto = null, cancelar = [], vista = "mundo", zoom = 1, primeraVez = true;

function aviso(texto) {
  const a = $("aviso");
  a.textContent = texto;
  a.hidden = false;
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => (a.hidden = true), 2800);
}

async function intentar(fn, ok) {
  try { await fn(); if (ok) aviso(ok); }
  catch (e) { console.error(e); aviso("No se pudo guardar: " + (e.code || e.message)); }
}

function mostrar(pantalla) {
  ["pantalla-entrar", "pantalla-sin-acceso", "pantalla-oficina"].forEach((id) => ($(id).hidden = id !== pantalla));
}

/* ---------------- Estado de cada agente ---------------- */
function estados() {
  return Object.fromEntries(AGENTES.map((a) => {
    const suyos = a.etapa ? productos.filter((p) => p.etapa === a.etapa) : [];
    return [a.id, {
      enCurso: suyos.filter((p) => p.estado === "en_curso"),
      pendientes: suyos.filter((p) => p.estado !== "en_curso").length,
      escribiendo: conversaciones.some((c) => c.agente === a.id && escribe(c)),
    }];
  }));
}

// Lo que le toca a la persona que entró: sus turnos en curso y lo que espera a sus agentes.
function teToca() {
  const nombre = (usuario.nombre || "").split(" ")[0].toLowerCase();
  const mios = AGENTES.filter((a) => a.persona.toLowerCase() === nombre && a.etapa);
  const vivos = productos.filter((p) => p.etapa !== "listo");
  const enCurso = vivos.filter((p) => p.estado === "en_curso" && p.responsable?.correo === usuario.correo);
  const porTomar = vivos.filter((p) => p.estado !== "en_curso" && mios.some((a) => a.etapa === p.etapa));
  const equipoPend = vivos.filter((p) => p.estado !== "en_curso" && !porTomar.includes(p));
  return { enCurso, porTomar, equipoPend, total: enCurso.length + porTomar.length };
}

/* ---------------- Menú lateral ---------------- */
function pintarLateral() {
  const est = estados();
  $("lista-deptos").innerHTML = DEPARTAMENTOS.map((d) => {
    const n = AGENTES.filter((a) => a.departamento === d.id).length;
    return `<button class="depto" data-depto="${esc(d.id)}"><i style="background:${esc(d.color)}"></i><span>${esc(d.nombre)}</span><small>${n ? n + (n === 1 ? " agente" : " agentes") : "pronto"}</small></button>`;
  }).join("");
  $("lista-deptos").querySelectorAll("[data-depto]").forEach((b) => (b.onclick = () => {
    const d = deptoDe(b.dataset.depto);
    if (d.id === "productos") return irA("tablero");
    const vienen = PROXIMOS.filter((p) => p.departamento === d.id).map((p) => p.nombre).join(", ");
    aviso(`${d.nombre}: próximamente${vienen ? " · " + vienen : ""}`);
  }));

  $("lista-agentes").innerHTML = AGENTES.map((a) => {
    const e = est[a.id];
    const linea = e.escribiendo ? `<span class="vivo">● Escribiendo…</span>`
      : e.enCurso.length ? `En curso: ${esc(e.enCurso[0].nombre)}`
      : "En el café ☕";
    const activo = chat?.agente().id === a.id ? "activo" : "";
    return `<button class="fila-agente ${activo}" data-agente="${esc(a.id)}">
      <img src="${retrato(a, 36)}" alt="">
      <span class="txt"><b>${esc(a.nombre)} · ${esc(a.persona)}</b><small>${linea}</small></span>
      ${e.pendientes ? `<span class="necesita" title="Productos por tomar">${e.pendientes}</span>` : ""}
    </button>`;
  }).join("");
  $("lista-agentes").querySelectorAll("[data-agente]").forEach((b) => (b.onclick = () => {
    chat.abrirAgente(AGENTES.find((a) => a.id === b.dataset.agente));
    abrirDock();
    pintarLateral();
  }));

  $("lista-proximos").innerHTML = PROXIMOS.map((p) => `<div class="fila-agente apagada">
      <img src="${retrato(p, 36)}" alt=""><span class="txt"><b>${esc(p.nombre)}</b><small>${esc(p.rol)}</small></span></div>`).join("");

  const t = teToca();
  $("badge-tetoca").hidden = !t.total;
  $("badge-tetoca").textContent = t.total;
}

function pintarSesion() {
  const s = $("sesion");
  if (!usuario) { s.innerHTML = ""; return; }
  s.innerHTML = `<div class="yo">${usuario.foto ? `<img src="${esc(usuario.foto)}" alt="">` : `<span class="inicial">${esc(usuario.nombre[0] || "?")}</span>`}
      <span><b>${esc(usuario.nombre)}</b><small>${usuario.esAdmin ? "Administradora" : "Equipo"}</small></span></div>
    <div class="acciones-pie">
      ${usuario.esAdmin ? `<button class="btn btn-sec btn-mini" id="b-conocimiento">Conocimiento</button><button class="btn btn-sec btn-mini" id="b-equipo">Equipo</button>` : ""}
      ${datos.demo ? "" : `<button class="btn btn-sec btn-mini" id="b-salir">Salir</button>`}
    </div>`;
  const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
  on("b-salir", () => datos.salir());
  on("b-equipo", () => { pintarEquipo(); $("d-equipo").showModal(); });
  on("b-conocimiento", () => { pintarConocimiento(); $("d-conocimiento").showModal(); });
}

/* ---------------- Cabecera: saludo e indicadores ---------------- */
function pintarCabecera() {
  const h = new Date().getHours();
  const hola = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  $("saludo").textContent = `${hola}, ${(usuario.nombre || "").split(" ")[0]}`;
  const est = estados();
  const trabajando = AGENTES.filter((a) => est[a.id].enCurso.length || est[a.id].escribiendo).length;
  const necesitan = AGENTES.filter((a) => est[a.id].pendientes).length;
  $("resumen").innerHTML = `<b>${trabajando}</b> ${trabajando === 1 ? "agente trabajando" : "agentes trabajando"} · <b class="${necesitan ? "rojo" : ""}">${necesitan}</b> ${necesitan === 1 ? "te necesita" : "te necesitan"}`;
  const hoy = new Date().toDateString();
  const chips = [
    ["En curso", productos.filter((p) => p.etapa !== "listo" && p.estado === "en_curso").length, "morado"],
    ["Por tomar", productos.filter((p) => p.etapa !== "listo" && p.estado !== "en_curso").length, "naranja"],
    ["Listos", productos.filter((p) => p.etapa === "listo").length, "verde"],
    ["Chats hoy", conversaciones.filter((c) => c.actualizadoEn && new Date(c.actualizadoEn).toDateString() === hoy).length, "azul"],
  ];
  $("indicadores").innerHTML = chips.map(([t, n, c]) => `<div class="indicador ${c}"><b>${n}</b><span>${t}</span></div>`).join("");
}

/* ---------------- Vistas ---------------- */
function irA(v) {
  vista = v;
  ["mundo", "tablero", "tetoca"].forEach((x) => ($("vista-" + x).hidden = x !== v));
  document.querySelectorAll(".nav [data-vista]").forEach((b) => b.classList.toggle("activo", b.dataset.vista === v));
  cerrarMenu();
}

function pintarTablero() {
  $("tablero").innerHTML = ETAPAS.map((e) => {
    const lista = productos.filter((p) => p.etapa === e.id);
    const ag = agenteDe(e.id);
    return `<div class="columna" data-etapa="${e.id}">
      <h3>${ag ? `<img src="${retrato(ag, 22)}" alt="">` : "✅"}<span>${esc(e.nombre)}</span><small>${lista.length}</small></h3>
      ${lista.length ? lista.map(tarjeta).join("") : `<div class="vacio">${e.id === "listo" ? "Aún no hay productos listos." : "Nada en este turno."}</div>`}
    </div>`;
  }).join("");
  $("tablero").querySelectorAll(".tarjeta").forEach((b) => (b.onclick = () => abrirProducto(b.dataset.id)));
}

function estadoChip(p) {
  return p.etapa === "listo" ? `<span class="estado listo">Listo</span>`
    : p.estado === "en_curso" ? `<span class="estado en_curso">${esc(p.responsable?.nombre || "En curso")}</span>`
    : `<span class="estado pendiente">Por tomar</span>`;
}

function tarjeta(p) {
  return `<button class="tarjeta" data-id="${esc(p.id)}"><b>${esc(p.nombre)}</b>
    <span class="meta"><span>${esc(p.pais || "")}</span>${estadoChip(p)}</span></button>`;
}

function pintarTeToca() {
  const t = teToca();
  const fila = (p, accion) => {
    const ag = agenteDe(p.etapa);
    return `<div class="fila-tarea">
      <img src="${retrato(ag, 36)}" alt="">
      <div class="txt"><b>${esc(p.nombre)}</b><small>${esc(p.pais || "")} · ${esc(nombreEtapa(p.etapa))} con ${esc(ag.nombre)}</small></div>
      ${estadoChip(p)}
      <button class="btn btn-sec btn-mini" data-ver="${esc(p.id)}">Ver</button>
      <button class="btn btn-primario btn-mini" data-chat="${esc(p.id)}">${accion}</button>
    </div>`;
  };
  const bloque = (titulo, lista, accion, vacio) => `<section class="bloque"><h2>${titulo} <small>${lista.length}</small></h2>
    ${lista.length ? lista.map((p) => fila(p, accion)).join("") : `<p class="nota">${vacio}</p>`}</section>`;
  $("tetoca").innerHTML = bloque("Sigues trabajando en", t.enCurso, "💬 Seguir", "No tienes turnos en curso.")
    + bloque("Te esperan a ti", t.porTomar, "💬 Empezar", "Nada esperando a tus agentes. ✨")
    + (t.equipoPend.length ? bloque("Esperan a otra persona del equipo", t.equipoPend, "💬 Abrir", "") : "");
  $("tetoca").querySelectorAll("[data-ver]").forEach((b) => (b.onclick = () => abrirProducto(b.dataset.ver)));
  $("tetoca").querySelectorAll("[data-chat]").forEach((b) => (b.onclick = () => {
    chat.abrirProducto(productos.find((p) => p.id === b.dataset.chat));
    abrirDock();
  }));
}

/* ---------------- Tarjeta del agente (al tocarlo en el mapa) ---------------- */
function abrirAgente(ag) {
  const d = $("d-agente"), e = estados()[ag.id], depto = deptoDe(ag.departamento);
  const suyos = ag.etapa ? productos.filter((p) => p.etapa === ag.etapa) : [];
  const convs = conversaciones.filter((c) => c.agente === ag.id).slice(0, 3);
  const estado = e.escribiendo ? "✍️ Escribiendo ahora" : e.enCurso.length ? "💼 Trabajando en su oficina" : "☕ En el café";
  d.style.setProperty("--agente", ag.color);
  d.innerHTML = `<form method="dialog" class="tarjeta-agente">
    <header>
      <img src="${retrato(ag, 72)}" alt="">
      <div><h3>${esc(ag.nombre)} · ${esc(ag.persona)}</h3><p>${esc(ag.rol)}</p>
        <span class="chip-depto" style="--c:${esc(depto?.color || "#999")}">${esc(depto?.nombre || "")}</span> <span class="nota">${estado}</span></div>
    </header>
    <p class="descripcion">${esc(ag.descripcion || "")}</p>
    ${ag.etapa ? `<h4>Pendientes <small>${suyos.length}</small></h4>
      <div class="lista-pend">${suyos.length ? suyos.map((p) => `<div class="fila-tarea compacta"><div class="txt"><b>${esc(p.nombre)}</b><small>${esc(p.pais || "")}</small></div>${estadoChip(p)}<button type="button" class="btn btn-sec btn-mini" data-chat="${esc(p.id)}">Abrir</button></div>`).join("")
        : `<p class="nota">Nada pendiente. ${ag.etapa === "investigacion" ? "Crea un producto nuevo para empezar." : "Llega trabajo cuando el agente anterior entregue."}</p>`}</div>` : ""}
    ${convs.length ? `<h4>Conversaciones recientes</h4><div class="lista-pend">${convs.map((c) => `<button type="button" class="fila-conv" data-conv="${esc(c.id)}">${c.productoId ? "📦" : "💬"} <b>${esc(c.titulo || "Sin título")}</b><small>${esc(c.ultimo?.texto || "")}</small></button>`).join("")}</div>` : ""}
    <div class="botones"><button value="cerrar" class="btn btn-sec">Cerrar</button><button type="button" class="btn btn-primario" id="a-chat">💬 Chatear aquí</button></div>
  </form>`;
  const cerrarY = (fn) => () => { d.close(); fn(); abrirDock(); pintarLateral(); };
  d.querySelector("#a-chat").onclick = cerrarY(() => chat.abrirAgente(ag));
  d.querySelectorAll("[data-chat]").forEach((b) => (b.onclick = cerrarY(() => chat.abrirProducto(productos.find((p) => p.id === b.dataset.chat), ag))));
  d.querySelectorAll("[data-conv]").forEach((b) => (b.onclick = cerrarY(() => chat.abrirConversacion(b.dataset.conv))));
  if (!d.open) d.showModal();
}

/* ---------------- Producto ---------------- */
function expedienteCompleto(p, hasta) {
  const orden = ["investigacion", "producto", "guiones"];
  const fin = hasta ? orden.indexOf(hasta) : orden.length;
  return orden.slice(0, fin).map((e) => p.expedientes?.[e]).filter(Boolean).join("\n\n");
}

function abrirProducto(id) {
  abierto = id;
  pintarProducto();
  const d = $("d-producto");
  if (!d.open) d.showModal();
}

function pintarProducto(conservar) {
  const p = productos.find((x) => x.id === abierto);
  const d = $("d-producto");
  if (!p) { if (d.open) d.close(); return; }
  const ag = agenteDe(p.etapa);
  const mio = p.estado === "en_curso" && p.responsable?.correo === usuario.correo;
  const otro = p.estado === "en_curso" && !mio;
  const expedientes = ["investigacion", "producto", "guiones"].filter((e) => p.expedientes?.[e])
    .map((e) => `<details><summary>Expediente de ${esc(nombreEtapa(e))}</summary><pre>${esc(p.expedientes[e])}</pre></details>`).join("");
  const historial = (p.historial || []).slice(-8).reverse()
    .map((h) => `<li>${esc(fecha(h.cuando))} · ${esc(h.quien)} ${esc(h.accion)} (${esc(nombreEtapa(h.etapa))})</li>`).join("");

  const paso = p.etapa === "listo" ? "Producto terminado. Aquí está el expediente completo de los tres turnos."
    : otro ? `Lo está trabajando <b>${esc(p.responsable?.nombre)}</b> con ${esc(ag.nombre)}.`
    : mio ? `Es tu turno con <b>${esc(ag.nombre)}</b>. Habla con él en el chat y, cuando entregue el expediente, pulsa <b>Entregar</b> en el chat.`
    : `Es el turno de <b>${esc(ag.nombre)}</b> (${esc(ag.persona)}). Abre el chat para empezar.`;

  const borrador = conservar ? d.querySelector("#t-exp")?.value : null;
  d.innerHTML = `<form method="dialog" class="formulario">
    <h3>${esc(p.nombre)}</h3>
    <p class="nota">${esc(p.pais || "")} · ${esc(nombreEtapa(p.etapa))}${p.estado === "en_curso" && p.etapa !== "listo" ? " · en curso" : ""}</p>
    <div class="paso">${paso}</div>
    ${expedientes}
    ${mio ? `<details><summary>Entregar a mano (pegar el expediente)</summary>
      <textarea id="t-exp" placeholder="=== EXPEDIENTE · TURNO ... ===">${esc(p.expedientes?.[p.etapa] || "")}</textarea>
      <div class="botones"><button type="button" class="btn btn-sec btn-mini" id="b-guardar">Guardar borrador</button><button type="button" class="btn btn-sec btn-mini" id="b-entregar">Entregar</button></div></details>` : ""}
    ${historial ? `<details><summary>Historial</summary><ul class="historial">${historial}</ul></details>` : ""}
    <div class="botones">
      ${usuario.esAdmin ? `<button type="button" class="btn btn-peligro izq" id="b-eliminar">Eliminar</button>` : ""}
      ${expedientes ? `<button type="button" class="btn btn-sec" id="b-copiar-todo">Copiar expediente</button>` : ""}
      ${(mio || (otro && usuario.esAdmin)) ? `<button type="button" class="btn btn-sec" id="b-soltar">Soltar turno</button>` : ""}
      ${p.etapa !== "listo" && p.estado !== "en_curso" ? `<button type="button" class="btn btn-sec" id="b-tomar">Tomar turno</button>` : ""}
      ${ag ? `<button type="button" class="btn btn-primario" id="b-chat">💬 Abrir chat con ${esc(ag.nombre)}</button>` : ""}
      <button value="cerrar" class="btn btn-sec">Cerrar</button>
    </div></form>`;
  if (borrador != null && d.querySelector("#t-exp")) d.querySelector("#t-exp").value = borrador;

  const on = (id, fn) => { const b = d.querySelector("#" + id); if (b) b.onclick = fn; };
  const texto = () => (d.querySelector("#t-exp")?.value || "").trim();
  on("b-tomar", () => intentar(() => datos.tomarTurno(p), "Turno tomado: " + ag.nombre + " va a su escritorio"));
  on("b-soltar", () => intentar(() => datos.soltarTurno(p), "Turno liberado"));
  on("b-guardar", () => intentar(() => datos.guardarExpediente(p, texto()), "Borrador guardado"));
  on("b-entregar", () => {
    if (!texto()) { aviso("Pega primero el expediente de este turno"); return; }
    intentar(() => datos.entregar(p, texto()), "Entregado al siguiente turno");
  });
  on("b-chat", () => { d.close(); chat.abrirProducto(p); abrirDock(); });
  on("b-copiar-todo", async () => {
    try { await navigator.clipboard.writeText(expedienteCompleto(p)); aviso("Expediente copiado"); } catch { aviso("No se pudo copiar"); }
  });
  on("b-eliminar", () => {
    if (confirm(`¿Eliminar "${p.nombre}"? No se puede deshacer.`)) intentar(() => datos.eliminarProducto(p), "Producto eliminado");
  });
}

/* ---------------- Equipo ---------------- */
function pintarEquipo() {
  const d = $("d-equipo");
  d.innerHTML = `<form method="dialog" class="formulario" id="f-equipo">
    <h3>Equipo</h3>
    <p class="nota">Solo las personas de esta lista pueden entrar a la oficina.</p>
    <ul class="equipo-lista">${equipo.map((m) => `<li><span><b>${esc(m.nombre)}</b> · ${esc(m.correo)}${m.rol === "admin" ? ` <span class="chip">Admin</span>` : ""}</span>
      <button type="button" class="btn btn-peligro btn-mini" data-quitar="${esc(m.correo)}">Quitar</button></li>`).join("") || `<li class="vacio">Aún no hay nadie.</li>`}</ul>
    <div class="fila">
      <input id="m-correo" type="email" placeholder="correo@gmail.com">
      <input id="m-nombre" placeholder="Nombre">
      <select id="m-rol"><option value="miembro">Miembro</option><option value="admin">Admin</option></select>
    </div>
    <div class="botones"><button value="cerrar" class="btn btn-sec">Cerrar</button><button type="button" class="btn btn-primario" id="b-agregar">Agregar</button></div>
  </form>`;
  d.querySelectorAll("[data-quitar]").forEach((b) => (b.onclick = () => {
    if (b.dataset.quitar === usuario.correo) { aviso("No puedes quitarte a ti misma"); return; }
    intentar(() => datos.quitarMiembro(b.dataset.quitar), "Persona quitada");
  }));
  d.querySelector("#b-agregar").onclick = () => {
    const correo = d.querySelector("#m-correo").value.trim().toLowerCase(), nombre = d.querySelector("#m-nombre").value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo) || !nombre) { aviso("Escribe un correo y un nombre"); return; }
    intentar(() => datos.guardarMiembro(correo, { nombre, rol: d.querySelector("#m-rol").value }), nombre + " ya puede entrar");
  };
}

/* ---------------- Conocimiento de cada agente ---------------- */
async function pintarConocimiento(id = AGENTES[0].id) {
  const d = $("d-conocimiento");
  const ag = AGENTES.find((a) => a.id === id);
  d.innerHTML = `<form method="dialog" class="formulario">
    <h3>Conocimiento de los agentes</h3>
    <p class="nota">Lo que pegues aquí lo lee el agente en cada conversación: ejemplos, la app de un reto anterior, un guion modelo, el banco de palabras clave. No pegues contraseñas ni datos bancarios.</p>
    <label>Agente<select id="k-agente">${AGENTES.map((a) => `<option value="${esc(a.id)}" ${a.id === id ? "selected" : ""}>${esc(a.nombre)} · ${esc(a.rol)}</option>`).join("")}</select></label>
    <label>Texto de referencia<textarea id="k-texto" placeholder="Cargando…" disabled></textarea></label>
    <label class="nota">O súbelo desde un archivo de texto (.html, .md, .txt)<input type="file" id="k-archivo" accept=".html,.htm,.md,.txt,.json,.csv"></label>
    <div class="botones"><button value="cerrar" class="btn btn-sec">Cerrar</button><button type="button" class="btn btn-primario" id="k-guardar">Guardar</button></div>
  </form>`;
  const area = d.querySelector("#k-texto");
  d.querySelector("#k-agente").onchange = (e) => pintarConocimiento(e.target.value);
  d.querySelector("#k-archivo").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 600000) { aviso("El archivo es muy grande (máximo 600 KB)"); return; }
    const texto = await f.text();
    area.value = (area.value ? area.value + "\n\n" : "") + `=== ${f.name} ===\n${texto}`;
  };
  d.querySelector("#k-guardar").onclick = () => {
    if (area.value.length > 900000) { aviso("Es demasiado texto (máximo unos 900 KB)"); return; }
    intentar(() => datos.guardarConocimiento(ag, area.value), `Conocimiento de ${ag.nombre} guardado`);
  };
  try { area.value = await datos.leerConocimiento(ag); }
  catch (e) { aviso("No se pudo leer: " + (e.code || e.message)); }
  area.disabled = false; area.placeholder = "Pega aquí el texto de referencia";
}

/* ---------------- Paneles en pantallas pequeñas ---------------- */
const os = () => $("pantalla-oficina");
function abrirDock() { os().classList.add("chat-abierto"); }
function cerrarMenu() { os().classList.remove("menu-abierto"); }

function pintarTodo() {
  pintarLateral();
  pintarCabecera();
  pintarTablero();
  pintarTeToca();
  oficina.actualizar({ productos, estados: estados() });
  chat.refrescar();
  if ($("d-producto").open) pintarProducto(true);
}

/* ---------------- Arranque ---------------- */
function entrarOficina() {
  mostrar("pantalla-oficina");
  if (!chat) {
    chat = crearChat({
      contenedor: $("dock"), datos, aviso, usuario: () => usuario, productos: () => productos, conversaciones: () => conversaciones,
      alVerProducto: (p) => abrirProducto(p.id),
      alCerrar: () => os().classList.remove("chat-abierto"),
    });
  }
  if (!oficina) oficina = crearOficina($("mundo"), { alTocarAgente: abrirAgente });
  if (datos.demo) window.oficinaDemo = oficina;
  pintarSesion();
  cancelar.push(datos.escucharProductos((lista) => {
    productos = lista;
    $("err-datos").textContent = "";
    pintarTodo();
  }, (e) => ($("err-datos").textContent = "No se pudieron leer los productos: " + (e.code || e.message))));
  cancelar.push(datos.escucharConversaciones((lista) => {
    conversaciones = lista;
    if (primeraVez) {   // abre el chat con el agente de quien entró
      primeraVez = false;
      const nombre = (usuario.nombre || "").split(" ")[0].toLowerCase();
      chat.abrirAgente(AGENTES.find((a) => a.persona.toLowerCase() === nombre) || AGENTES[0]);
    }
    pintarTodo();
  }, (e) => ($("err-datos").textContent = "No se pudieron leer las conversaciones: " + (e.code || e.message) + ". ¿Publicaste las reglas nuevas en Firebase?")));
  if (usuario.esAdmin) cancelar.push(datos.escucharEquipo((lista) => { equipo = lista; if ($("d-equipo").open) pintarEquipo(); }));
  setInterval(() => { if (usuario) pintarCabecera(); }, 60e3);
}

function zoomMundo(paso) {
  zoom = Math.min(2.5, Math.max(1, zoom + paso * 0.5));
  const caja = $("mundo-scroll"), centroX = (caja.scrollLeft + caja.clientWidth / 2) / caja.scrollWidth, centroY = (caja.scrollTop + caja.clientHeight / 2) / caja.scrollHeight;
  $("mundo").style.width = zoom * 100 + "%";
  caja.classList.toggle("ampliado", zoom > 1);
  caja.scrollLeft = centroX * caja.scrollWidth - caja.clientWidth / 2;
  caja.scrollTop = centroY * caja.scrollHeight - caja.clientHeight / 2;
}

// Arrastrar para moverse por el mapa cuando está ampliado.
function arrastre(caja) {
  let x0 = null, y0, l0, t0, movio = false;
  caja.addEventListener("pointerdown", (e) => { if (zoom === 1) return; x0 = e.clientX; y0 = e.clientY; l0 = caja.scrollLeft; t0 = caja.scrollTop; movio = false; });
  addEventListener("pointermove", (e) => {
    if (x0 === null) return;
    if (Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0) > 4) movio = true;
    caja.scrollLeft = l0 - (e.clientX - x0); caja.scrollTop = t0 - (e.clientY - y0);
  });
  addEventListener("pointerup", () => { x0 = null; });
  caja.addEventListener("click", (e) => { if (movio) { e.stopPropagation(); movio = false; } }, true);
}

async function iniciar() {
  $("s-pais").innerHTML = PAISES.map((p) => `<option>${esc(p)}</option>`).join("");
  datos = await crearDatos();
  $("modo").hidden = !datos.demo;

  $("b-entrar").onclick = () => datos.entrar().catch((e) => ($("err-entrar").textContent = "No se pudo entrar: " + (e.code || e.message)));
  $("b-salir2").onclick = () => datos.salir();
  $("b-nuevo").onclick = () => { $("f-nuevo").reset(); $("d-nuevo").showModal(); cerrarMenu(); };
  $("d-nuevo").addEventListener("close", () => {
    if ($("d-nuevo").returnValue !== "ok") return;
    const f = new FormData($("f-nuevo"));
    intentar(() => datos.crearProducto({ nombre: f.get("nombre").trim(), pais: f.get("pais") }), "Producto creado: le toca a " + AGENTES[0].nombre);
  });
  $("d-producto").addEventListener("close", () => (abierto = null));
  document.querySelectorAll(".nav [data-vista]").forEach((b) => (b.onclick = () => irA(b.dataset.vista)));
  document.querySelectorAll("[data-zoom]").forEach((b) => (b.onclick = () => zoomMundo(Number(b.dataset.zoom))));
  arrastre($("mundo-scroll"));
  if (innerWidth < 820) requestAnimationFrame(() => zoomMundo(2));   // en el celular el mapa arranca ampliado
  $("b-menu").onclick = () => os().classList.toggle("menu-abierto");
  $("b-chats").onclick = () => os().classList.toggle("chat-abierto");
  $("velo").onclick = () => os().classList.remove("menu-abierto", "chat-abierto");

  datos.alCambiarSesion((u) => {
    cancelar.forEach((c) => c && c());
    cancelar = [];
    usuario = u;
    if (!u) return mostrar("pantalla-entrar");
    if (!u.acceso) { $("correo-sin-acceso").textContent = u.correo; return mostrar("pantalla-sin-acceso"); }
    entrarOficina();
  });
}

iniciar().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML("beforeend", `<p class="error portada">No se pudo cargar la oficina: ${esc(e.message)}</p>`);
});
