"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { armarDia, productoPorNombre, puedeEscribir, ayerBogota } = require("../src/cruce");
const { extraerVenta } = require("../src/leona");

const productos = [
  { id: "p1", nombre: "Crema", pais: "CO" },
  { id: "p2", nombre: "Crema Facial", pais: "CO" },
  { id: "p3", nombre: "Faja Reductora", pais: "OT" },
];

test("el nombre más largo gana y no importan tildes ni mayúsculas", () => {
  assert.strictEqual(productoPorNombre("CO | CREMA FACIAL | Conversiones", productos).id, "p2");
  assert.strictEqual(productoPorNombre("Crema - Bolivia", productos).id, "p1");
  assert.strictEqual(productoPorNombre("Cremas", productos), null);
});

test("arma los mismos documentos que el cierre del día de la app", () => {
  const dia = armarDia(
    "2026-10-25",
    [
      { producto: "Crema Facial", valor: 100000, unidades: 1 },
      { producto: "crema facial", valor: 50000, unidades: 2 },
      { producto: "Producto nuevo", valor: 30000, unidades: 1 },
    ],
    [
      { campana: "CO Crema Facial", gasto: 40000 },
      { campana: "Faja Reductora BO", gasto: 20000 },
    ],
    productos,
    "2026-10-26T11:00:00.000Z"
  );
  const porId = Object.fromEntries(dia.movimientos.map((m) => [m.id, m.data]));
  assert.deepStrictEqual(Object.keys(porId).sort(), [
    "d-2026-10-25-ads-p2",
    "d-2026-10-25-ads-p3",
    "d-2026-10-25-venta-gen",
    "d-2026-10-25-venta-p2",
  ]);
  assert.strictEqual(porId["d-2026-10-25-venta-p2"].valor, 150000);
  assert.strictEqual(porId["d-2026-10-25-venta-p2"].unidades, 3);
  assert.strictEqual(porId["d-2026-10-25-venta-p2"].cuenta, "otra");
  assert.strictEqual(porId["d-2026-10-25-ads-p3"].plataforma, "Meta");
  assert.strictEqual(porId["d-2026-10-25-venta-gen"].producto, "");
  assert.deepStrictEqual(dia.sinProducto.ventas, ["Producto nuevo"]);
  assert.strictEqual(dia.totales.roas, 180000 / 60000);
});

test("no pisa lo que guardó una persona", () => {
  assert.ok(puedeEscribir(null));
  assert.ok(puedeEscribir({ creadoPor: "agente-caja" }));
  assert.ok(!puedeEscribir({ creadoPor: "Ana" }));
});

test("ayer en hora de Colombia", () => {
  // 2026-10-26 03:00 UTC es todavía 25 de octubre en Bogotá
  assert.strictEqual(ayerBogota(new Date("2026-10-26T03:00:00Z")), "2026-10-24");
});

test("lee una venta de un webhook con campos anidados", () => {
  const v = extraerVenta({ event: "sale", data: { order_id: 77, product_name: "Faja Reductora", total: "$ 89.900", created_at: "2026-10-25T20:00:00-05:00" } });
  assert.deepStrictEqual(v, { id: "77", producto: "Faja Reductora", valor: 89900, unidades: 1, fecha: "2026-10-25T20:00:00-05:00" });
  assert.strictEqual(extraerVenta({ hola: "mundo" }), null);
});
