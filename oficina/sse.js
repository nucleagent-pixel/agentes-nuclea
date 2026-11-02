// Lee la respuesta en streaming de Claude (eventos SSE) y avisa cada vez que llega texto.
export async function leerRespuesta(cuerpo, { alTexto }) {
  const lector = cuerpo.pipeThrough(new TextDecoderStream()).getReader();
  let pendiente = "", texto = "", fin = null, uso = { entrada: 0, salida: 0, cache: 0 };
  const evento = (bloque) => {
    const linea = bloque.split("\n").find((l) => l.startsWith("data:"));
    if (!linea) return;
    let d;
    try { d = JSON.parse(linea.slice(5)); } catch { return; }
    if (d.type === "content_block_delta" && d.delta?.type === "text_delta") { texto += d.delta.text; alTexto(texto); }
    else if (d.type === "message_start") {
      uso.entrada = d.message?.usage?.input_tokens || 0;
      uso.cache = d.message?.usage?.cache_read_input_tokens || 0;
    } else if (d.type === "message_delta") { fin = d.delta?.stop_reason || fin; uso.salida = d.usage?.output_tokens || uso.salida; }
    else if (d.type === "error") throw new Error(d.error?.type === "overloaded_error" ? "Claude está ocupado, intenta en un minuto" : "Claude se interrumpió: " + (d.error?.message || "error"));
  };
  for (;;) {
    const { value, done } = await lector.read();
    if (done) break;
    pendiente += value;
    let i;
    while ((i = pendiente.indexOf("\n\n")) >= 0) { evento(pendiente.slice(0, i)); pendiente = pendiente.slice(i + 2); }
  }
  if (pendiente.trim()) evento(pendiente);
  if (!fin) throw new Error("La conexión se cortó antes de terminar");
  return { texto, fin, uso };
}
