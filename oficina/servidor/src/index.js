// Servidor del chat de la Oficina NUCLEA (Cloudflare Worker).
import { INSTRUCCIONES } from "./instrucciones.js";
import { ETAPAS, sinEncabezado, sistema, historial } from "./conversacion.js";
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

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    if (url.pathname === "/") return json(200, { ok: true, servicio: "Chat de la Oficina NUCLEA" });
    if (url.pathname !== "/chat" || req.method !== "POST") return json(404, { error: "No existe" });

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
    if (!token) return json(401, { error: "Inicia sesión de nuevo" });
    const { productoId, etapa } = await req.json().catch(() => ({}));
    if (!ETAPAS.includes(etapa) || typeof productoId !== "string" || !/^[\w-]{1,100}$/.test(productoId)) {
      return json(400, { error: "Faltan datos" });
    }

    // 1. Producto, conversación y conocimiento, leídos con el permiso de quien escribe.
    const db = crearFirestore({ proyecto: env.FIREBASE_PROYECTO || PROYECTO, token, base: env.FIRESTORE_URL || undefined });
    let producto, mensajes, conocimiento;
    try {
      producto = await db.documento(`productos/${productoId}`);
      [mensajes, conocimiento] = await Promise.all([
        db.lista(`productos/${productoId}/mensajes`),
        db.documento(`conocimiento/${etapa}`, true).catch(() => null),
      ]);
    } catch (e) {
      return json(e instanceof ErrorFirestore ? e.status : 500, { error: e.message });
    }
    const turnos = historial(mensajes.filter((m) => m.etapa === etapa));
    if (!turnos.length || turnos[turnos.length - 1].role !== "user") return json(400, { error: "No hay un mensaje nuevo para responder" });

    // 2. Claude responde en streaming; el Worker solo pasa los eventos sin procesarlos.
    if (!env.ANTHROPIC_API_KEY) return json(500, { error: "Falta la clave de Claude en Cloudflare (ANTHROPIC_API_KEY)" });
    const r = await fetch(env.ANTHROPIC_URL || "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2026-10-21",
        "anthropic-beta": "server-side-fallback-2026-07-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: env.MODELO || MODELO,
        max_tokens: 64000,
        stream: true,
        output_config: { effort: etapa === "producto" ? "high" : "medium" },
        cache_control: { type: "ephemeral" },
        fallbacks: "default",
        system: sistema({ etapa, producto, conocimiento: conocimiento?.texto || "", instrucciones: sinEncabezado(INSTRUCCIONES[etapa]) }),
        messages: turnos,
      }),
    });
    if (!r.ok) {
      const cuerpo = await r.json().catch(() => ({}));
      const msg = cuerpo?.error?.message || "";
      console.log("Error de Claude", r.status, msg);
      const error = r.status === 401 ? "La clave de Claude no es válida"
        : r.status === 429 || r.status === 529 ? "Claude está ocupado, intenta en un minuto"
        : /credit/i.test(msg) ? "No hay créditos en la cuenta de Claude"
        : "Claude no pudo responder (" + r.status + ")";
      return json(502, { error });
    }
    return new Response(r.body, { headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  },
};
