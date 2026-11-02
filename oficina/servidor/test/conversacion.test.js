import test from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { historial, sistema, sinEncabezado, tablero, generico } from "../src/conversacion.js";
import { campos } from "../src/firestore.js";
import { AGENTES, PROXIMOS } from "../../config.js";

const [detective, hada] = AGENTES;

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

test("en un producto, el agente ve completos solo los expedientes anteriores a su turno", () => {
  const producto = { id: "p1", nombre: "Reto X", pais: "Perú", etapa: "producto", expedientes: { investigacion: "EXP-1", guiones: "EXP-3" } };
  const s = sistema({ agente: hada, agentes: AGENTES, proximos: PROXIMOS, producto, productos: [producto], conocimiento: "REF", instrucciones: "INSTR" });
  assert.match(s, /EXP-1/);
  assert.doesNotMatch(s, /EXP-3/);
  assert.match(s, /REF/);
  assert.match(s, /Producto de esta conversación/);
});

test("en una conversación libre, el agente ve el tablero y a los demás agentes", () => {
  const productos = [
    { id: "a", nombre: "Yoga Facial", pais: "Chile", etapa: "guiones", estado: "en_curso", responsable: { nombre: "Anyela" }, expedientes: { investigacion: "EXP-YOGA" } },
    { id: "b", nombre: "Reto Acero", etapa: "listo", expedientes: {} },
  ];
  const s = sistema({ agente: detective, agentes: AGENTES, proximos: PROXIMOS, productos, instrucciones: "INSTR" });
  assert.match(s, /Yoga Facial · Chile · en curso con Columnista \(Anyela\)/);
  assert.match(s, /EXP-YOGA/);
  assert.match(s, /Reto Acero · sin país · listo/);
  assert.match(s, /Hada \(lo usa Nicole\)/);
  assert.match(s, /conversación libre/);
  assert.match(s, /Cajera.*todavía no existe/);
});

test("el tablero recorta expedientes largos", () => {
  const largo = "x".repeat(5000);
  const t = tablero([{ id: "a", nombre: "A", etapa: "producto", expedientes: { investigacion: largo } }], AGENTES);
  assert.ok(t.length < 2000);
  assert.match(t, /\[…\]/);
});

test("un agente sin archivo de instrucciones recibe unas genéricas", () => {
  assert.match(generico({ nombre: "Cajera", rol: "Agente de caja", descripcion: "Cuadra la caja." }), /Eres Cajera, agente de caja de NUCLEA\. Cuadra la caja\./);
});

test("cada agente con archivo de instrucciones lo tiene en agentes/", () => {
  for (const a of AGENTES.filter((x) => x.instrucciones)) {
    const t = sinEncabezado(readFileSync(new URL(`../../../agentes/${a.instrucciones}`, import.meta.url), "utf8"));
    assert.ok(t.length > 200, a.id);
    assert.doesNotMatch(t, /Instrucciones para pegar/);
  }
});

test("convierte los campos de Firestore", () => {
  assert.deepStrictEqual(campos({
    nombre: { stringValue: "Reto" },
    expedientes: { mapValue: { fields: { investigacion: { stringValue: "E1" } } } },
    escribiendo: { booleanValue: true },
    responsable: { nullValue: null },
  }), { nombre: "Reto", expedientes: { investigacion: "E1" }, escribiendo: true, responsable: null });
});
