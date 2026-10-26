"use strict";

// Lógica pura del Agente de Caja: cruza ventas de Leona y gasto de Meta con
// el catálogo de productos de la caja y arma los mismos documentos que guarda
// el botón "Guardar el día" de la app.

const AGENTE = "agente-caja";
const CUENTA_POR_DEFECTO = "otra"; // la app usa "otra" en el cierre del día

// "Café Premium 2x1" -> "cafe premium 2x1"
function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Devuelve el producto cuyo nombre aparece dentro del texto (nombre de
// campaña o de producto en Leona). Si varios coinciden, gana el nombre más
// largo, para que "Crema" no le gane a "Crema Facial".
function productoPorNombre(texto, productos) {
  const t = " " + normalizar(texto) + " ";
  let mejor = null;
  for (const p of productos || []) {
    const n = normalizar(p.nombre);
    if (!n) continue;
    if (t.includes(" " + n + " ") && (!mejor || n.length > normalizar(mejor.nombre).length)) {
      mejor = p;
    }
  }
  return mejor;
}

function idDiario(fecha, tipo, clave) {
  return "d-" + fecha + "-" + tipo + "-" + clave;
}

// ventas:   [{producto: "nombre en Leona", valor: 120000, unidades: 1}]
// campanas: [{campana: "nombre de la campaña", gasto: 45000}]
// Devuelve los movimientos a guardar y lo que no se pudo asignar.
function armarDia(fecha, ventas, campanas, productos, creadoEn) {
  const porClave = new Map();
  const fila = (clave) => {
    if (!porClave.has(clave)) porClave.set(clave, { valor: 0, unidades: 0, pauta: 0 });
    return porClave.get(clave);
  };
  const sinProducto = { ventas: [], campanas: [] };

  for (const v of ventas || []) {
    const p = productoPorNombre(v.producto, productos);
    if (!p) sinProducto.ventas.push(v.producto || "(sin nombre)");
    const f = fila(p ? p.id : "gen");
    f.valor += Number(v.valor) || 0;
    f.unidades += Number(v.unidades) || 1;
  }
  for (const c of campanas || []) {
    const p = productoPorNombre(c.campana, productos);
    if (!p) sinProducto.campanas.push(c.campana || "(sin nombre)");
    fila(p ? p.id : "gen").pauta += Number(c.gasto) || 0;
  }

  const movimientos = [];
  const comun = { fecha, cuenta: CUENTA_POR_DEFECTO, nota: "Cargado por el agente", creadoPor: AGENTE, creadoEn };
  let ventasTotal = 0, pautaTotal = 0;
  for (const [clave, f] of porClave) {
    const producto = clave === "gen" ? "" : clave;
    const valor = Math.round(f.valor), pauta = Math.round(f.pauta);
    ventasTotal += valor;
    pautaTotal += pauta;
    if (valor > 0) {
      movimientos.push({ id: idDiario(fecha, "venta", clave), data: { ...comun, tipo: "venta", valor, unidades: f.unidades, producto } });
    }
    if (pauta > 0) {
      movimientos.push({ id: idDiario(fecha, "ads", clave), data: { ...comun, tipo: "ads", valor: pauta, producto, plataforma: "Meta" } });
    }
  }

  return {
    movimientos,
    sinProducto,
    totales: { ventas: ventasTotal, pauta: pautaTotal, roas: pautaTotal > 0 ? ventasTotal / pautaTotal : null },
  };
}

// Un documento escrito por una persona no se pisa: se reporta.
function puedeEscribir(existente) {
  return !existente || existente.creadoPor === AGENTE;
}

// Fecha YYYY-MM-DD en hora de Colombia.
function fechaBogota(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function ayerBogota(ahora) {
  return fechaBogota(new Date(ahora.getTime() - 24 * 3600 * 1000));
}

module.exports = { AGENTE, normalizar, productoPorNombre, idDiario, armarDia, puedeEscribir, fechaBogota, ayerBogota };
