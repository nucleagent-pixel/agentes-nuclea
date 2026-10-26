"use strict";

// Lee una venta del webhook de Leona.
//
// PENDIENTE: todavía no hemos visto un webhook real de Leona, así que esto
// prueba los nombres de campo más comunes. Con el primer evento real (queda
// guardado completo en `agente_leona_eventos`) se ajustan estas listas.
const CAMPOS = {
  id: ["id", "event_id", "order_id", "sale_id", "venta_id"],
  producto: ["producto", "product", "product_name", "nombre_producto", "item", "item_name"],
  valor: ["valor", "total", "amount", "monto", "price", "precio"],
  unidades: ["unidades", "quantity", "cantidad", "qty"],
  fecha: ["fecha", "created_at", "date", "timestamp", "paid_at"],
};

function buscar(obj, nombres, profundidad = 0) {
  if (!obj || typeof obj !== "object" || profundidad > 3) return undefined;
  for (const n of nombres) {
    if (obj[n] !== undefined && obj[n] !== null && typeof obj[n] !== "object") return obj[n];
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") {
      const r = buscar(v, nombres, profundidad + 1);
      if (r !== undefined) return r;
    }
  }
  return undefined;
}

// "$ 120.000" -> 120000. Los pesos no llevan decimales.
function dinero(v) {
  if (typeof v === "number") return v;
  const d = String(v || "").replace(/[^\d]/g, "");
  return d ? parseInt(d, 10) : 0;
}

// Devuelve {id, producto, valor, unidades, fecha} o null si no parece una venta.
function extraerVenta(payload) {
  const producto = buscar(payload, CAMPOS.producto);
  const valor = dinero(buscar(payload, CAMPOS.valor));
  if (!producto || !valor) return null;
  const id = buscar(payload, CAMPOS.id);
  const fecha = buscar(payload, CAMPOS.fecha);
  return {
    id: id != null ? String(id) : null,
    producto: String(producto),
    valor,
    unidades: Number(buscar(payload, CAMPOS.unidades)) || 1,
    fecha: fecha != null ? String(fecha) : null,
  };
}

module.exports = { extraerVenta, dinero };
