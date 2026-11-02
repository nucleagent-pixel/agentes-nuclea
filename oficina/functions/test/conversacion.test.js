const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { historial, sistema, instruccionesDe } = require("../src/conversacion");

test("el historial alterna turnos y omite errores", () => {
  const h = historial([
    { rol: "agente", texto: "hola suelto" },
    { rol: "persona", quien: "Ana", texto: "uno" },
    { rol: "persona", quien: "Ana", texto: "dos" },
    { rol: "agente", texto: "", estado: "error" },
    { rol: "agente", texto: "respuesta" },
  ]);
  assert.deepStrictEqual(h, [
    { role: "user", content: "[Ana] uno\n\n[Ana] dos" },
    { role: "assistant", content: "respuesta" },
  ]);
});

test("el sistema incluye solo los expedientes anteriores", () => {
  const s = sistema({
    etapa: "producto",
    producto: { nombre: "Reto X", pais: "Perú", expedientes: { investigacion: "EXP-1", guiones: "EXP-3" } },
    conocimiento: "",
    instrucciones: "INSTR",
  });
  assert.match(s, /EXP-1/);
  assert.doesNotMatch(s, /EXP-3/);
  assert.match(s, /Reto X/);
});

test("lee las instrucciones debajo del separador", () => {
  const t = instruccionesDe("guiones", path.join(__dirname, "..", "..", "..", "agentes"));
  assert.ok(t.length > 200);
  assert.doesNotMatch(t, /Instrucciones para pegar/);
});
