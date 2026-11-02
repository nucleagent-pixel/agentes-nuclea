// Servidor del chat de la Oficina NUCLEA (Cloudflare Worker).
import { INSTRUCCIONES } from "./instrucciones.js";
import { AGENTES, PROXIMOS } from "../../config.js";
import { sinEncabezado, sistema, historial, generico } from "./conversacion.js";
import { crearFirestore, ErrorFirestore } from "./firestore.js";

// Valores por defecto: así se puede pegar en el editor de Cloudflare sin configurar variables.
const PROYECTO = "agents-730ec";
const MODELO = "claude-opus-5-5";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};
const json = (status, datos) => new Response(JSON.stringify(datos), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const ID = /^[\w-]{1,100}$/;

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    if (url.pathname === "/") return json(200, { ok: true, servicio: "Chat de la Oficina NUCLEA", agentes: AGENTES.map((a) => a.id) });
    if (url.pathname !== "/chat" || req.method !== "POST") return json(404, { error: "No existe" });

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
    if (!token) return json(401, { error: "Inicia sesión de nuevo" });
    const { conversacionId } = await req.json().catch(() => ({}));
    if (typeof conversacionId !== "string" || !ID.test(conversacionId)) return json(400, { error: "Faltan datos" });

    // 1. Conversación, tablero y conocimiento, leídos con el permiso de quien escribe.
    const db = crearFirestore({ proyecto: env.FIREBASE_PROYECTO || PROYECTO, token, base: env.FIRESTORE_URL || undefined });
    let conv, mensajes, productos, conocimiento, agente;
    try {
      conv = await db.documento(`conversaciones/${conversacionId}`);
      agente = AGENTES.find((a) => a.id === conv.agente);
      if (!agente) return json(400, { error: "Este agente todavía no tiene servidor. Vuelve a pegar chat-worker.js en Cloudflare." });
      [mensajes, productos, conocimiento] = await Promise.all([
        db.lista(`conversaciones/${conversacionId}/mensajes`),
        db.lista("productos").catch(() => []),
        db.documento(`conocimiento/${agente.id}`, true)
          .then((k) => k || (agente.etapa ? db.documento(`conocimiento/${agente.etapa}`, true) : null))
          .catch(() => null),
      ]);
    } catch (e) {
      return json(e instanceof ErrorFirestore ? e.status : 500, { error: e.message });
    }
    const turnos = historial(mensajes);
    if (!turnos.length || turnos[turnos.length - 1].role !== "user") return json(400, { error: "No hay un mensaje nuevo para responder" });
    productos.sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)));
    const producto = conv.productoId ? productos.find((p) => p.id === conv.productoId) : null;

    // 2. Claude responde en streaming; el Worker solo pasa los eventos sin procesarlos.
    if (!env.ANTHROPIC_API_KEY) return json(500, { error: "Falta la clave de Claude en Cloudflare (ANTHROPIC_API_KEY)" });
    const instrucciones = INSTRUCCIONES[agente.id] ? sinEncabezado(INSTRUCCIONES[agente.id]) : generico(agente);
    const cuerpo = {
      model: env.MODELO || MODELO,
      max_tokens: 64000,
      stream: true,
      output_config: { effort: agente.esfuerzo || "medium" },
      cache_control: { type: "ephemeral" },
      fallbacks: "default",
      system: sistema({ agente, agentes: AGENTES, proximos: PROXIMOS, producto, productos, conocimiento: conocimiento?.texto || "", instrucciones }),
      messages: turnos,
    };
    const pedir = (conRespaldo) => {
      const b = { ...cuerpo };
      if (!conRespaldo) delete b.fallbacks;
      return fetch(env.ANTHROPIC_URL || "https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2026-10-21",
          ...(env.ANTHROPIC_WORKSPACE_ID ? { "anthropic-workspace-id": env.ANTHROPIC_WORKSPACE_ID } : {}),
          ...(conRespaldo ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}),
          "content-type": "application/json",
        },
        body: JSON.stringify(b),
      });
    };
    let r = await pedir(true);
    // Si la cuenta no acepta el modelo de respaldo, se intenta una vez sin él.
    if (r.status === 400) {
      const detalle = await r.clone().json().catch(() => ({}));
      if (/fallback|beta/i.test(detalle?.error?.message || "")) r = await pedir(false);
    }
    if (!r.ok) {
      const cuerpo = await r.json().catch(() => ({}));
      const msg = cuerpo?.error?.message || "";
      console.log("Error de Claude", r.status, msg);
      const error = r.status === 401 ? "La clave de Claude no es válida"
        : r.status === 429 || r.status === 529 ? "Claude está ocupado, intenta en un minuto"
        : /credit/i.test(msg) ? "No hay créditos en la cuenta de Claude"
        : "Claude no pudo responder (" + r.status + (msg ? ": " + msg.slice(0, 300) : "") + ")";
      return json(502, { error });
    }
    return new Response(r.body, { headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  },
};
