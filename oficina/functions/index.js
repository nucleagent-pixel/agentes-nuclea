// Chat de los agentes de la Oficina NUCLEA. La oficina llama a "chatAgente";
// esta función habla con Claude y va guardando la respuesta en Firestore,
// así todo el equipo la ve escribirse en tiempo real.
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const Anthropic = require("@anthropic-ai/sdk");
const { ETAPAS, instruccionesDe, sistema, historial } = require("./src/conversacion");

initializeApp();
const db = getFirestore();

const CLAVE = defineSecret("ANTHROPIC_API_KEY");
const MODELO = defineString("MODELO", { default: "claude-opus-5-5" });
const ADMINS = ["nucleagent@gmail.com"];

async function esDelEquipo(correo) {
  if (ADMINS.includes(correo)) return true;
  return (await db.doc(`equipo/${correo}`).get()).exists;
}

exports.chatAgente = onRequest(
  { secrets: [CLAVE], timeoutSeconds: 1800, memory: "512MiB", cors: true, maxInstances: 10 },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

    // 1. Quién escribe
    let correo, nombre;
    try {
      const token = (req.get("Authorization") || "").replace(/^Bearer /, "");
      const u = await getAuth().verifyIdToken(token);
      if (!u.email_verified) throw new Error("correo sin verificar");
      correo = u.email.toLowerCase();
      if (!(await esDelEquipo(correo))) return res.status(403).json({ error: "No eres parte del equipo" });
      const m = await db.doc(`equipo/${correo}`).get();
      nombre = m.data()?.nombre || u.name || correo;
    } catch (e) {
      return res.status(401).json({ error: "Inicia sesión de nuevo" });
    }

    // 2. Qué producto y qué agente
    const { productoId, etapa, texto } = req.body || {};
    if (!ETAPAS.includes(etapa) || typeof productoId !== "string" || typeof texto !== "string" || !texto.trim()) {
      return res.status(400).json({ error: "Faltan datos" });
    }
    if (texto.length > 200000) return res.status(400).json({ error: "El mensaje es demasiado largo" });
    const refProducto = db.doc(`productos/${productoId}`);
    const producto = (await refProducto.get()).data();
    if (!producto) return res.status(404).json({ error: "No existe el producto" });

    const mensajes = refProducto.collection("mensajes");
    const ahora = () => new Date().toISOString();
    await mensajes.add({ etapa, rol: "persona", quien: nombre, correo, texto: texto.trim(), estado: "listo", creadoEn: ahora() });
    const respuesta = await mensajes.add({ etapa, rol: "agente", texto: "", estado: "escribiendo", creadoEn: ahora() });
    const cambios = { escribiendo: FieldValue.arrayUnion(etapa), actualizadoEn: ahora() };
    if (producto.etapa === etapa && producto.estado !== "en_curso") {
      Object.assign(cambios, { estado: "en_curso", responsable: { correo, nombre } });
    }
    await refProducto.update(cambios);

    // 3. Historial e instrucciones
    const previos = await mensajes.orderBy("creadoEn").get();
    const turnos = historial(previos.docs.filter((d) => d.id !== respuesta.id && d.data().etapa === etapa).map((d) => d.data()));
    const conocimiento = (await db.doc(`conocimiento/${etapa}`).get()).data()?.texto || "";

    let acumulado = "", ultimoGuardado = 0;
    const guardar = (extra = {}) => respuesta.update({ texto: acumulado, ...extra });
    try {
      const cliente = new Anthropic({ apiKey: CLAVE.value() });
      const stream = cliente.beta.messages.stream({
        model: MODELO.value(),
        max_tokens: 64000,
        output_config: { effort: etapa === "producto" ? "high" : "medium" },
        cache_control: { type: "ephemeral" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: sistema({ etapa, producto, conocimiento, instrucciones: instruccionesDe(etapa) }),
        messages: turnos,
      });
      for await (const ev of stream) {
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
          acumulado += ev.delta.text;
          if (Date.now() - ultimoGuardado > 700) { ultimoGuardado = Date.now(); await guardar(); }
        }
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") acumulado += "\n\n(El agente no pudo continuar con esta solicitud. Prueba a reformularla.)";
      if (final.stop_reason === "max_tokens") acumulado += "\n\n(La respuesta se cortó por largo. Escribe \"continúa\" para seguir.)";
      await guardar({ estado: "listo", uso: { entrada: final.usage.input_tokens, salida: final.usage.output_tokens, cache: final.usage.cache_read_input_tokens || 0 } });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      const motivo = e instanceof Anthropic.AuthenticationError ? "La clave de Claude no es válida"
        : e instanceof Anthropic.RateLimitError ? "Claude está ocupado, intenta en un minuto"
        : e instanceof Anthropic.APIError && e.status === 400 && /credit/i.test(e.message) ? "No hay créditos en la cuenta de Claude"
        : "No se pudo completar la respuesta";
      await guardar({ estado: "error", error: motivo });
      res.status(500).json({ error: motivo });
    } finally {
      await refProducto.update({ escribiendo: FieldValue.arrayRemove(etapa) }).catch(() => {});
    }
  },
);
