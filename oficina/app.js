import { AGENTES, ETAPAS, PAISES } from "./config.js";
import { crearDatos } from "./datos.js";
import { crearOficina } from "./mundo.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const agenteDe = (etapa) => AGENTES.find((a) => a.etapa === etapa);
const nombreEtapa = (etapa) => ETAPAS.find((e) => e.id === etapa)?.nombre || etapa;
const fecha = (iso) => (iso ? new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "");

let datos, usuario = null, productos = [], equipo = [], oficina = null, abierto = null, cancelar = [];

function aviso(texto) {
  const a = $("aviso");
  a.textContent = texto;
  a.hidden = false;
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => (a.hidden = true), 2600);
}

async function intentar(fn, ok) {
  try { await fn(); if (ok) aviso(ok); }
  catch (e) { console.error(e); aviso("No se pudo guardar: " + (e.code || e.message)); }
}

function mostrar(pantalla) {
  ["pantalla-entrar", "pantalla-sin-acceso", "pantalla-oficina"].forEach((id) => ($(id).hidden = id !== pantalla));
}

function pintarSesion() {
  const s = $("sesion");
  if (!usuario) { s.innerHTML = ""; return; }
  s.innerHTML = `${usuario.foto ? `<img src="${esc(usuario.foto)}" alt="">` : ""}<span>${esc(usuario.nombre)}</span>
    ${datos.demo ? "" : `<button class="btn btn-sec" id="b-salir">Salir</button>`}`;
  const b = $("b-salir");
  if (b) b.onclick = () => datos.salir();
}

/* ---------------- Tablero ---------------- */
function pintarTablero() {
  $("tablero").innerHTML = ETAPAS.map((e) => {
    const lista = productos.filter((p) => p.etapa === e.id);
    const ag = agenteDe(e.id);
    return `<div class="columna" data-etapa="${e.id}">
      <h3><span>${esc(e.nombre)}</span><small>${ag ? esc(ag.nombre) + " · " : ""}${lista.length}</small></h3>
      ${lista.length ? lista.map(tarjeta).join("") : `<div class="vacio">${e.id === "listo" ? "Aún no hay productos listos." : "Nada en este turno."}</div>`}
    </div>`;
  }).join("");
  document.querySelectorAll(".tarjeta").forEach((b) => (b.onclick = () => abrirProducto(b.dataset.id)));
}

function tarjeta(p) {
  const estado = p.etapa === "listo" ? `<span class="estado listo">Listo</span>`
    : p.estado === "en_curso" ? `<span class="estado en_curso">${esc(p.responsable?.nombre || "En curso")}</span>`
    : `<span class="estado pendiente">Por tomar</span>`;
  return `<button class="tarjeta" data-id="${esc(p.id)}"><b>${esc(p.nombre)}</b>
    <span class="meta"><span>${esc(p.pais || "")}</span>${estado}</span></button>`;
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
  const anteriores = ["investigacion", "producto", "guiones"]
    .filter((e) => p.expedientes?.[e] && (e !== p.etapa || !mio))
    .map((e) => `<details><summary>Expediente de ${esc(nombreEtapa(e))}</summary><pre>${esc(p.expedientes[e])}</pre></details>`).join("");
  const historial = (p.historial || []).slice(-8).reverse()
    .map((h) => `<li>${esc(fecha(h.cuando))} · ${esc(h.quien)} ${esc(h.accion)} (${esc(nombreEtapa(h.etapa))})</li>`).join("");
  const previo = expedienteCompleto(p, p.etapa);

  let paso = "";
  if (p.etapa === "listo") {
    paso = `<div class="paso">Producto terminado. Aquí está el expediente completo de los tres turnos.</div>`;
  } else if (!p.estado || p.estado === "pendiente") {
    paso = `<div class="paso">Es el turno de <b>${esc(ag.nombre)}</b>, ${esc(ag.rol.toLowerCase())}. Tómalo para empezar a trabajar.</div>`;
  } else if (otro) {
    paso = `<div class="paso">Lo está trabajando <b>${esc(p.responsable?.nombre)}</b> con ${esc(ag.nombre)}.</div>`;
  } else {
    paso = `<div class="paso">
      1. ${previo ? `Copia el expediente anterior y pégalo en tu conversación. ` : ""}<a href="${esc(ag.donde)}" target="_blank" rel="noopener">${esc(ag.dondeTexto)}</a><br>
      2. Cuando ${esc(ag.nombre)} termine, pega aquí el bloque <code>=== EXPEDIENTE ===</code> que entregó y pulsa <b>Entregar</b>.</div>
      <label>Expediente de este turno<textarea id="t-exp" placeholder="=== EXPEDIENTE · TURNO ... ===">${esc(p.expedientes?.[p.etapa] || "")}</textarea></label>`;
  }

  const borrador = conservar ? d.querySelector("#t-exp")?.value : null;
  d.innerHTML = `<form method="dialog" class="formulario">
    <h3>${esc(p.nombre)}</h3>
    <p class="nota">${esc(p.pais || "")} · ${esc(nombreEtapa(p.etapa))}${p.estado === "en_curso" && p.etapa !== "listo" ? " · en curso" : ""}</p>
    ${paso}
    ${anteriores}
    ${historial ? `<details><summary>Historial</summary><ul class="historial">${historial}</ul></details>` : ""}
    <div class="botones">
      ${usuario.esAdmin ? `<button type="button" class="btn btn-peligro izq" id="b-eliminar">Eliminar</button>` : ""}
      ${previo && mio ? `<button type="button" class="btn btn-sec" id="b-copiar">Copiar expediente anterior</button>` : ""}
      ${p.etapa === "listo" ? `<button type="button" class="btn btn-sec" id="b-copiar-todo">Copiar expediente completo</button>` : ""}
      ${(mio || (otro && usuario.esAdmin)) ? `<button type="button" class="btn btn-sec" id="b-soltar">Soltar turno</button>` : ""}
      ${mio ? `<button type="button" class="btn btn-sec" id="b-guardar">Guardar borrador</button>` : ""}
      ${p.etapa !== "listo" && p.estado !== "en_curso" ? `<button type="button" class="btn" id="b-tomar">Tomar turno</button>` : ""}
      ${mio ? `<button type="button" class="btn" id="b-entregar">Entregar a ${esc(agenteDe(siguienteEtapa(p.etapa))?.nombre || "Listo")}</button>` : ""}
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
  on("b-copiar", () => copiar(previo));
  on("b-copiar-todo", () => copiar(expedienteCompleto(p)));
  on("b-eliminar", () => {
    if (confirm(`¿Eliminar "${p.nombre}"? No se puede deshacer.`)) intentar(() => datos.eliminarProducto(p), "Producto eliminado");
  });
}

function siguienteEtapa(etapa) {
  return ETAPAS[ETAPAS.findIndex((e) => e.id === etapa) + 1]?.id;
}

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); aviso("Copiado. Pégalo en la conversación del agente"); }
  catch { aviso("No se pudo copiar"); }
}

/* ---------------- Equipo ---------------- */
function pintarEquipo() {
  const d = $("d-equipo");
  d.innerHTML = `<form method="dialog" class="formulario" id="f-equipo">
    <h3>Equipo</h3>
    <p class="nota">Solo las personas de esta lista pueden entrar a la oficina.</p>
    <ul class="equipo-lista">${equipo.map((m) => `<li><span><b>${esc(m.nombre)}</b> · ${esc(m.correo)}${m.rol === "admin" ? ` <span class="chip">Admin</span>` : ""}</span>
      <button type="button" class="btn btn-peligro" data-quitar="${esc(m.correo)}">Quitar</button></li>`).join("") || `<li class="vacio">Aún no hay nadie.</li>`}</ul>
    <div class="fila">
      <input id="m-correo" type="email" placeholder="correo@gmail.com">
      <input id="m-nombre" placeholder="Nombre">
      <select id="m-rol"><option value="miembro">Miembro</option><option value="admin">Admin</option></select>
    </div>
    <div class="botones"><button value="cerrar" class="btn btn-sec">Cerrar</button><button type="button" class="btn" id="b-agregar">Agregar</button></div>
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

/* ---------------- Arranque ---------------- */
function entrarOficina() {
  mostrar("pantalla-oficina");
  if (!oficina) {
    oficina = crearOficina($("mundo"), {
      alTocarAgente: (ag) => {
        const col = document.querySelector(`.columna[data-etapa="${ag.etapa}"]`);
        if (!col) return;
        document.querySelectorAll(".columna").forEach((c) => c.classList.remove("resaltada"));
        col.classList.add("resaltada");
        col.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => col.classList.remove("resaltada"), 2000);
      },
    });
  }
  $("b-equipo").hidden = !usuario.esAdmin;
  cancelar.push(datos.escucharProductos((lista) => {
    productos = lista;
    $("err-datos").textContent = "";
    pintarTablero();
    oficina.actualizar(productos);
    if ($("d-producto").open) pintarProducto(true);
  }, (e) => ($("err-datos").textContent = "No se pudieron leer los productos: " + (e.code || e.message))));
  if (usuario.esAdmin) cancelar.push(datos.escucharEquipo((lista) => { equipo = lista; if ($("d-equipo").open) pintarEquipo(); }));
}

async function iniciar() {
  $("s-pais").innerHTML = PAISES.map((p) => `<option>${esc(p)}</option>`).join("");
  datos = await crearDatos();
  $("modo").hidden = !datos.demo;

  $("b-entrar").onclick = () => datos.entrar().catch((e) => ($("err-entrar").textContent = "No se pudo entrar: " + (e.code || e.message)));
  $("b-salir2").onclick = () => datos.salir();
  $("b-nuevo").onclick = () => { $("f-nuevo").reset(); $("d-nuevo").showModal(); };
  $("b-equipo").onclick = () => { pintarEquipo(); $("d-equipo").showModal(); };
  $("d-nuevo").addEventListener("close", () => {
    if ($("d-nuevo").returnValue !== "ok") return;
    const f = new FormData($("f-nuevo"));
    intentar(() => datos.crearProducto({ nombre: f.get("nombre").trim(), pais: f.get("pais") }), "Producto creado: le toca a " + AGENTES[0].nombre);
  });
  $("d-producto").addEventListener("close", () => (abierto = null));

  datos.alCambiarSesion((u) => {
    cancelar.forEach((c) => c && c());
    cancelar = [];
    usuario = u;
    pintarSesion();
    if (!u) return mostrar("pantalla-entrar");
    if (!u.acceso) { $("correo-sin-acceso").textContent = u.correo; return mostrar("pantalla-sin-acceso"); }
    entrarOficina();
  });
}

iniciar().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML("beforeend", `<p class="error centro">No se pudo cargar la oficina: ${esc(e.message)}</p>`);
});
