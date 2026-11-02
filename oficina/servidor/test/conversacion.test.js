import test from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { historial, sistema, sinEncabezado } from "../src/conversacion.js";
import { campos } from "../src/firestore.js";

test("el historial alterna turnos y omite errores y respuestas a medias", () => {
  const h = historial([
    { rol: "agente", texto: "hola suelto" },
    { rol: "persona", quien: "Ana", texto: "uno" },
    { rol: "persona", quien: "Ana", texto: "dos" },
    { rol: "agente", texto: "x", estado: "error" },
    { rol: "agente", texto: "respuesta", estado: "listo" },
    { rol: "persona", quien: "Ana", texto: "tres" },
    { rol: "agente", texto: "", estado: "escribiendo" },
  ]);
  assert.deepStrictEqual(h, [
    { role: "user", content: "[Ana] uno\n\n[Ana] dos" },
    { role: "assistant", content: "respuesta" },
    { role: "user", content: "[Ana] tres" },
  ]);
});

test("el sistema incluye solo los expedientes anteriores", () => {
  const s = sistema({
    etapa: "producto",
    producto: { nombre: "Reto X", pais: "Perú", expedientes: { investigacion: "EXP-1", guiones: "EXP-3" } },
    conocimiento: "REF", instrucciones: "INSTR",
  });
  assert.match(s, /EXP-1/);
  assert.doesNotMatch(s, /EXP-3/);
  assert.match(s, /REF/);
});

test("quita el encabezado de las instrucciones", () => {
  const t = sinEncabezado(readFileSync(new URL("../../../agentes/1-detective-oficina.md", import.meta.url), "utf8"));
  assert.ok(t.length > 200);
  assert.doesNotMatch(t, /Instrucciones para pegar/);
});

test("convierte los campos de Firestore", () => {
  assert.deepStrictEqual(campos({
    nombre: { stringValue: "Reto" },
    expedientes: { mapValue: { fields: { investigacion: { stringValue: "E1" } } } },
    escribiendo: { arrayValue: { values: [{ stringValue: "producto" }] } },
    responsable: { nullValue: null },
  }), { nombre: "Reto", expedientes: { investigacion: "E1" }, escribiendo: ["producto"], responsable: null });
});
