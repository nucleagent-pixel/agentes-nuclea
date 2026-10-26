"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const { armarDia, puedeEscribir, fechaBogota, ayerBogota } = require("./src/cruce");
const { extraerVenta } = require("./src/leona");
const { gastoPorCampana } = require("./src/meta");

initializeApp();
const db = getFirestore();

const LEONA_CLAVE = defineSecret("LEONA_WEBHOOK_CLAVE");
const META_TOKEN = defineSecret("META_TOKEN");
const META_CUENTA = defineSecret("META_CUENTA");

const REGION = "us-central1";
const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

function claveCorrecta(req, secreto) {
  const dada = req.get("x-clave") || req.query.clave;
  return Boolean(secreto) && dada === secreto;
}

// Leona llama aquí con cada venta. Se guarda el evento completo y la venta
// que se pudo leer; el cierre del día los suma.
exports.leonaWebhook = onRequest({ region: REGION, secrets: [LEONA_CLAVE] }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Solo POST");
  if (!claveCorrecta(req, LEONA_CLAVE.value())) return res.status(401).send("Clave incorrecta");

  const ahora = new Date();
  const venta = extraerVenta(req.body);
  let fecha = fechaBogota(ahora);
  if (venta && venta.fecha && !isNaN(Date.parse(venta.fecha))) fecha = fechaBogota(new Date(venta.fecha));

  const evento = { recibidoEn: ahora.toISOString(), fecha, venta, crudo: req.body || null };
  // Con id de Leona, un reenvío del mismo evento no se cuenta dos veces.
  const col = db.collection("agente_leona_eventos");
  if (venta && venta.id) await col.doc("leona-" + venta.id).set(evento);
  else await col.add(evento);

  if (!venta) logger.warn("Evento de Leona sin venta reconocible", { cuerpo: req.body });
  res.status(200).send("ok");
});

// Arma y guarda el cierre de un día en la caja.
async function cerrarDia(fecha) {
  const creadoEn = new Date().toISOString();

  const cfg = await db.doc("config/general").get();
  const productos = (cfg.exists && cfg.data().productos) || [];

  const eventos = await db.collection("agente_leona_eventos").where("fecha", "==", fecha).get();
  const ventas = eventos.docs.map((d) => d.data().venta).filter(Boolean);

  const campanas = await gastoPorCampana(fecha, { token: META_TOKEN.value(), cuenta: META_CUENTA.value() });

  const dia = armarDia(fecha, ventas, campanas, productos, creadoEn);

  const guardados = [], respetados = [];
  for (const m of dia.movimientos) {
    const ref = db.collection("movimientos").doc(m.id);
    const actual = await ref.get();
    if (puedeEscribir(actual.exists ? actual.data() : null)) {
      await ref.set(m.data);
      guardados.push(m.id);
    } else {
      respetados.push(m.id);
    }
  }

  // Bitácora del agente: la leerá la oficina virtual.
  const reporte = {
    agente: "caja",
    fecha,
    creadoEn,
    estado: dia.sinProducto.ventas.length || dia.sinProducto.campanas.length || respetados.length ? "revisar" : "ok",
    totales: dia.totales,
    ventasLeidas: ventas.length,
    campanasLeidas: campanas.length,
    guardados,
    respetados,
    sinProducto: dia.sinProducto,
  };
  await db.collection("agente_reportes").doc("caja-" + fecha).set(reporte);
  logger.info("Cierre del día", reporte);
  return reporte;
}

// Todos los días a las 6:00 a. m. (Colombia) cierra el día anterior, cuando
// Meta ya terminó de contar el gasto.
exports.cierreDiario = onSchedule(
  { region: REGION, schedule: "0 6 * * *", timeZone: "America/Bogota", secrets: [META_TOKEN, META_CUENTA] },
  async () => {
    await cerrarDia(ayerBogota(new Date()));
  }
);

// Para repetir un día a mano: /cerrarDiaManual?fecha=2026-10-25&clave=...
exports.cerrarDiaManual = onRequest(
  { region: REGION, secrets: [LEONA_CLAVE, META_TOKEN, META_CUENTA] },
  async (req, res) => {
    if (!claveCorrecta(req, LEONA_CLAVE.value())) return res.status(401).send("Clave incorrecta");
    const fecha = String(req.query.fecha || ayerBogota(new Date()));
    if (!FECHA_VALIDA.test(fecha)) return res.status(400).send("Fecha inválida, usa AAAA-MM-DD");
    try {
      res.json(await cerrarDia(fecha));
    } catch (e) {
      logger.error(e);
      res.status(500).send(e.message);
    }
  }
);
