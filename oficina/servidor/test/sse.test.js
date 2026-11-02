import test from "node:test";
import assert from "node:assert";
import { leerRespuesta } from "../../sse.js";

const flujo = (trozos) => new ReadableStream({ start(c) { trozos.forEach((t) => c.enqueue(new TextEncoder().encode(t))); c.close(); } });
const ev = (d) => `event: ${d.type}\ndata: ${JSON.stringify(d)}\n\n`;

test("junta el texto aunque los eventos lleguen partidos", async () => {
  const todo = ev({ type: "message_start", message: { usage: { input_tokens: 10 } } })
    + ev({ type: "content_block_delta", delta: { type: "text_delta", text: "Hola " } })
    + ev({ type: "content_block_delta", delta: { type: "text_delta", text: "mundo" } })
    + ev({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 3 } });
  const vistos = [];
  const r = await leerRespuesta(flujo([todo.slice(0, 50), todo.slice(50, 140), todo.slice(140)]), { alTexto: (t) => vistos.push(t) });
  assert.equal(r.texto, "Hola mundo");
  assert.equal(r.fin, "end_turn");
  assert.deepStrictEqual(r.uso, { entrada: 10, salida: 3, cache: 0 });
  assert.deepStrictEqual(vistos, ["Hola ", "Hola mundo"]);
});

test("avisa si la conexión se corta", async () => {
  await assert.rejects(leerRespuesta(flujo([ev({ type: "content_block_delta", delta: { type: "text_delta", text: "a" } })]), { alTexto() {} }), /se cortó/);
});
