// La oficina en pixel art isométrico, dibujada en un <canvas> sin imágenes externas.
// Tiene tres oficinas (una por departamento), un pasillo, la sala de juntas y el café.
import { AGENTES } from "./config.js";

const TW = 64, TH = 32;            // tamaño de una baldosa
const W = 26, H = 18;              // baldosas de ancho y fondo
const MURO = 150, MARGEN = 24, BORDE = 16, ESCALA = 4;
const ANCHO = (W + H) * TW / 2 + MARGEN * 2;
const ALTO = (W + H) * TH / 2 + MURO + BORDE + MARGEN * 2;
const OX = H * TW / 2 + MARGEN, OY = MURO + MARGEN;

const iso = (x, y, z = 0) => [OX + (x - y) * TW / 2, OY + (x + y) * TH / 2 - z];

/* ---------------------------------------------------------------------
   Plano: cuartos, puertas y lugares donde se sientan los agentes
   --------------------------------------------------------------------- */
const FILA_OFICINAS = 7;           // muro de vidrio del frente de las oficinas
const FILA_ABAJO = 9;              // muro de vidrio de la sala de juntas
const PASILLO = 8;
const CORTES = [0, 8.5, 17.5, W];  // límites en x de las tres oficinas
const CORTE_ABAJO = 13;            // entre sala de juntas y café

const OFICINAS = [0, 1, 2].map((i) => {
  const x0 = CORTES[i], x1 = CORTES[i + 1];
  const dx = x0 + 2.6;
  return {
    x0, x1, puerta: x0 + (x1 - x0) * 0.62,
    escritorio: { x: dx, y: 2.6, w: 2.4, d: 1 },
    silla: { x: dx + 1.6, y: 2.45 },
  };
});
const PUERTAS = {
  of0: { x: OFICINAS[0].puerta, dentro: 6.1 },
  of1: { x: OFICINAS[1].puerta, dentro: 6.1 },
  of2: { x: OFICINAS[2].puerta, dentro: 6.1 },
  juntas: { x: 7.5, dentro: 10 },
  cafe: { x: 19.5, dentro: 10.8 },
};
const MESA = { x: 3.2, y: 12, w: 6.6, d: 1.6 };
const PUESTOS_JUNTAS = [4.4, 6.5, 8.6].map((x) => ({ x, y: 11.85 }));
const SITIOS_CAFE = [
  { x: 16.0, y: 11.4 }, { x: 18.6, y: 13.0 }, { x: 21.0, y: 11.6 },
  { x: 23.4, y: 15.6 }, { x: 20.4, y: 15.0 }, { x: 15.0, y: 14.4 }, { x: 23.0, y: 13.4 },
];

function cuarto({ x, y }) {
  if (y < FILA_OFICINAS) return x < CORTES[1] ? "of0" : x < CORTES[2] ? "of1" : "of2";
  if (y <= FILA_ABAJO) return x >= CORTE_ABAJO && y > PASILLO + 0.5 ? "cafe" : "pasillo";
  return x < CORTE_ABAJO ? "juntas" : "cafe";
}

function lugarEscritorio(i) {
  const o = OFICINAS[i], e = o.escritorio;
  return {
    tipo: "escritorio", x: o.silla.x, y: o.silla.y, sentado: true,
    aprox: [{ x: e.x - 0.55, y: e.y + 2 }, { x: e.x - 0.55, y: o.silla.y }],
  };
}
const lugarJuntas = (i) => ({ tipo: "juntas", ...PUESTOS_JUNTAS[i], sentado: true, aprox: [] });
function lugarCafe(evitar) {
  const libres = SITIOS_CAFE.filter((s) => s !== evitar);
  const s = libres[Math.floor(Math.random() * libres.length)];
  return { tipo: "cafe", x: s.x + (Math.random() - 0.5) * 0.6, y: s.y + (Math.random() - 0.5) * 0.6, sitio: s, sentado: false, aprox: [] };
}

/* ---------------------------------------------------------------------
   Personajes (originales). Sprites de 12 x 19 píxeles.
   H pelo, S piel, E ojos, M boca, T ropa, U ropa 2, W camisa o blanco,
   K detalle, A sombrero, B cinta, P pantalón o falda, Z zapatos.
   --------------------------------------------------------------------- */
const SPRITES = {
  detective: {
    cuerpo: [
      "....AAAA....",
      "...AAAAAA...",
      "...BBBBBB...",
      ".AAAAAAAAAA.",
      "...HSSSSH...",
      "...SESSES...",
      "...SSSSSS...",
      "...SSMMSS...",
      "....SSSS....",
      "..TTUWKUTT..",
      ".TTTTWKTTTT.",
      ".TTTTTTTTTT.",
      "STUUUUUUUUTS",
      "S.TTTTTTTT.S",
      "..TTTTTTTT..",
      "..TTT..TTT..",
    ],
    piernas: [
      ["...PP..PP...", "...PP..PP...", "...ZZ..ZZZ.."],
      ["..PP....PP..", "..PP....PP..", ".ZZZ....ZZ.."],
    ],
  },
  hada: {
    cuerpo: [
      ".....HH.....",
      "....HHHH....",
      "...HHHHHH...",
      "..HHHHHHHH..",
      "..HSSSSSSH..",
      "..SSESSESS..",
      "..SSSSSSSS..",
      "..SSSMMSSS..",
      "....SSSS....",
      "...TTTTTT...",
      "..STTTTTTS..",
      ".S.TTTTTT.S.",
      "...UUUUUU...",
      "..TTTTTTTT..",
      ".TTUTTTTUTT.",
      ".T..TT.TT..T",
    ],
    piernas: [
      ["....SS..SS..", "....SS..SS..", "...ZZW.ZZW.."],
      ["...SS....SS.", "...SS....SS.", "..ZZW...ZZW."],
    ],
  },
  columnista: {
    cuerpo: [
      "...HHHHHH...",
      "..HHHHHHHH..",
      ".HHHHHHHHHH.",
      ".HHSSSSSSHH.",
      ".HSESSSSESH.",
      "HHSSSSSSSSHH",
      "HHSSSMMSSSHH",
      "HHHSSSSSSHHH",
      "HHHHSSSSHHHH",
      "HHTTTTTTTTHH",
      "HSTTTTTTTTSH",
      ".S.TTTTTT.S.",
      "...UUUUUU...",
      "..PPPPPPPP..",
      ".PPPPPPPPPP.",
      "PWPPWPPWPPWP",
    ],
    piernas: [
      ["....SS..SS..", "....SS..SS..", "....Z...Z..."],
      ["...SS....SS.", "...SS....SS.", "...Z.....Z.."],
    ],
  },
};
const ALTO_SPRITE = 19;

function pintarSprite(ctx, agente, px, py, paso, espejo) {
  const c = agente.colores, sp = SPRITES[agente.estilo] || SPRITES.detective;
  const color = {
    H: c.pelo, S: c.piel, E: "#222", M: c.labios || "#b8564b", T: c.ropa, U: c.ropa2 || c.ropa,
    W: c.camisa || c.detalle || "#fff", K: c.detalle || "#c33", A: c.sombrero || c.pelo, B: c.cinta || c.pelo,
    P: c.pantalon, Z: c.zapatos,
  };
  const filas = [...sp.cuerpo, ...sp.piernas[paso]];
  const x0 = px - 6 * ESCALA, y0 = py - ALTO_SPRITE * ESCALA;
  filas.forEach((fila, j) => {
    for (let i = 0; i < 12; i++) {
      const k = fila[espejo ? 11 - i : i];
      if (k === ".") continue;
      ctx.fillStyle = color[k];
      ctx.fillRect(x0 + i * ESCALA, y0 + j * ESCALA, ESCALA, ESCALA);
    }
  });
}

/* ---------------------------------------------------------------------
   Utilidades de dibujo
   --------------------------------------------------------------------- */
function poligono(ctx, pts, color) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// Caja isométrica: arriba, cara izquierda (frente +y) y cara derecha (frente +x).
function caja(ctx, x, y, w, d, h, [arriba, izq, der], z = 0) {
  poligono(ctx, [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], izq);
  poligono(ctx, [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)], der);
  poligono(ctx, [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], arriba);
}

// Rectángulo pintado sobre el muro del fondo (y = 0) o el izquierdo (x = 0).
const enMuroFondo = (ctx, x, w, z, h, color) => poligono(ctx, [iso(x, 0, z), iso(x + w, 0, z), iso(x + w, 0, z + h), iso(x, 0, z + h)], color);
const enMuroIzq = (ctx, y, w, z, h, color) => poligono(ctx, [iso(0, y, z), iso(0, y + w, z), iso(0, y + w, z + h), iso(0, y, z + h)], color);

function letrero(ctx, texto, x, y, { fondo = "#2b2420", tinta = "#fff4dc", tam = 14 } = {}) {
  ctx.font = `700 ${tam}px system-ui, sans-serif`;
  const w = ctx.measureText(texto).width + 20, h = tam + 12;
  ctx.fillStyle = fondo;
  ctx.beginPath(); ctx.roundRect(Math.round(x - w / 2), Math.round(y - h / 2), w, h, 6); ctx.fill();
  ctx.fillStyle = tinta; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(texto, x, y + 1);
  ctx.textBaseline = "alphabetic";
}

function globo(ctx, texto, x, y, fuerte) {
  ctx.font = "600 14px system-ui, sans-serif";
  const t = texto.length > 40 ? texto.slice(0, 39) + "…" : texto;
  const w = ctx.measureText(t).width + 18, h = 28, bx = Math.round(x - w / 2), by = Math.round(y - h - 8);
  ctx.fillStyle = fuerte ? "#fff3c4" : "#ffffff";
  ctx.strokeStyle = "#2b2b2b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, 7);
  ctx.moveTo(x - 6, by + h); ctx.lineTo(x, by + h + 8); ctx.lineTo(x + 6, by + h);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#1d1d1d";
  ctx.textAlign = "center";
  ctx.fillText(t, x, by + 19);
}

// Números pseudoaleatorios fijos para que la ciudad no cambie en cada carga.
function semilla(n) {
  return () => { n = (n * 16807) % 2147483647; return (n - 1) / 2147483646; };
}

/* ---------------------------------------------------------------------
   Colores
   --------------------------------------------------------------------- */
const MADERA = ["#8a5a36", "#5f3b22", "#74492b"];
const MADERA_CLARA = ["#d6a873", "#a87a4b", "#bf8f5e"];
const BLANCO = ["#f4f1ec", "#c9c3ba", "#dcd6cd"];
const METAL = ["#9aa3ae", "#69717c", "#828b96"];
const OSCURO = ["#3b3f46", "#25282d", "#30343a"];
const ROSA = ["#f3a6c4", "#c9789a", "#de8fb0"];
const MENTA = ["#a8e0c4", "#76b597", "#8fcbad"];
const CUERO = ["#7a3b2e", "#552820", "#683127"];
const TELA_AZUL = ["#5b7fb5", "#3f5d8a", "#4d6ea0"];
const PAPEL = ["#ffffff", "#dcdcdc", "#ececec"];

const PISOS = {
  of0: ["#7a5236", "#6e4a31"],        // madera oscura del detective
  of1: ["#c9a27a", "#bf9870"],        // madera clara del taller
  of2: ["#efe3e6", "#e6d6da"],        // mármol rosado del estudio
  pasillo: ["#b89a78", "#ad8f6e"],
  juntas: ["#6f7d92", "#68768b"],
  cafe: ["#eee5d6", "#d8cab3"],
};
const ALFOMBRAS = [
  { x: 1.4, y: 1.8, w: 5.2, d: 4.2, color: "#3d5a48", borde: "#c9a85a" },
  { x: 10.2, y: 1.8, w: 5.2, d: 4.2, color: "#9fd6c0", borde: "#f2cf5b" },
  { x: 19.2, y: 1.8, w: 5.0, d: 4.2, color: "#f4b6cc", borde: "#ffffff" },
  { x: 2.4, y: 10.8, w: 8.2, d: 3.8, color: "#8b96a8", borde: "#8b96a8" },
  { x: 15.4, y: 13.4, w: 4.6, d: 4.2, color: "#e9c27a", borde: "#c98f4a" },
];

/* ---------------------------------------------------------------------
   Capa fija: piso, muros, ventanales con la ciudad y cuadros
   --------------------------------------------------------------------- */
function pintarFondo(ctx) {
  ctx.fillStyle = "#1f1b24";
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // Borde del piso (efecto maqueta)
  poligono(ctx, [iso(0, H), iso(W, H), iso(W, H, -BORDE), iso(0, H, -BORDE)], "#3a2d24");
  poligono(ctx, [iso(W, 0), iso(W, H), iso(W, H, -BORDE), iso(W, 0, -BORDE)], "#4a3a2e");

  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    const p = PISOS[cuarto({ x: x + 0.5, y: y + 0.5 })];
    poligono(ctx, [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], p[(x + y) % 2]);
  }
  ALFOMBRAS.forEach((a) => {
    poligono(ctx, [iso(a.x, a.y), iso(a.x + a.w, a.y), iso(a.x + a.w, a.y + a.d), iso(a.x, a.y + a.d)], a.borde);
    poligono(ctx, [iso(a.x + 0.15, a.y + 0.15), iso(a.x + a.w - 0.15, a.y + 0.15), iso(a.x + a.w - 0.15, a.y + a.d - 0.15), iso(a.x + 0.15, a.y + a.d - 0.15)], a.color);
  });

  // Muros
  poligono(ctx, [iso(0, 0), iso(W, 0), iso(W, 0, MURO), iso(0, 0, MURO)], "#343b4f");
  poligono(ctx, [iso(0, 0), iso(0, H), iso(0, H, MURO), iso(0, 0, MURO)], "#2b3142");
  enMuroFondo(ctx, 0, W, 0, 10, "#241f1c");
  enMuroIzq(ctx, 0, H, 0, 10, "#1d1916");
  enMuroFondo(ctx, 0, W, MURO - 8, 8, "#4a5470");
  enMuroIzq(ctx, 0, H, MURO - 8, 8, "#3e4760");

  // Ventanales con la ciudad al atardecer
  const r = semilla(7);
  const ventanal = (enMuro, a, b) => {
    const z0 = 34, z1 = MURO - 22;
    const pA = enMuro === enMuroFondo ? iso(a, 0, z1) : iso(0, a, z1);
    const pB = enMuro === enMuroFondo ? iso(b, 0, z0) : iso(0, b, z0);
    const g = ctx.createLinearGradient(0, Math.min(pA[1], pB[1]) - 30, 0, Math.max(pA[1], pB[1]) + 10);
    g.addColorStop(0, "#2c3e6b"); g.addColorStop(0.6, "#e7a96b"); g.addColorStop(1, "#f6d29a");
    enMuro(ctx, a, b - a, z0, z1 - z0, g);
    for (let u = a; u < b - 0.05;) {
      const ancho = Math.min(0.35 + r() * 0.6, b - u), alto = 20 + r() * (z1 - z0 - 30);
      enMuro(ctx, u, ancho, z0, alto, ["#1f2840", "#26304b", "#2d3754"][Math.floor(r() * 3)]);
      for (let v = u + 0.08; v < u + ancho - 0.1; v += 0.18) for (let h = z0 + 8; h < z0 + alto - 6; h += 10) {
        if (r() < 0.45) enMuro(ctx, v, 0.07, h, 4, r() < 0.8 ? "#ffd98a" : "#9fd3ff");
      }
      u += ancho + 0.02;
    }
    const tramos = Math.max(1, Math.round((b - a) / 1.6));
    for (let k = 0; k <= tramos; k++) enMuro(ctx, a + (b - a) * k / tramos - 0.04, 0.08, z0, z1 - z0, "#1a1d26");
    enMuro(ctx, a - 0.04, b - a + 0.08, z0 - 4, 5, "#1a1d26");
    enMuro(ctx, a - 0.04, b - a + 0.08, z1 - 2, 5, "#1a1d26");
  };
  ventanal(enMuroFondo, 0.8, 3.8);
  ventanal(enMuroFondo, 10.3, 16.9);
  ventanal(enMuroFondo, 18.3, 23.8);
  ventanal(enMuroIzq, 14.6, 17.4);

  // Detective: tablero de corcho con pistas y un mapa
  enMuroFondo(ctx, 4.3, 3.6, 50, 70, "#5a3a22");
  enMuroFondo(ctx, 4.45, 3.3, 54, 62, "#c99a62");
  const pistas = [[4.7, 104], [6.1, 108], [7.2, 96], [5.3, 76], [6.7, 72]];
  ctx.strokeStyle = "#c0392b"; ctx.lineWidth = 1.5; ctx.beginPath();
  [[0, 1], [1, 2], [0, 3], [3, 4], [1, 4]].forEach(([i, j]) => {
    const [ax, ay] = iso(pistas[i][0] + 0.22, 0, pistas[i][1] - 7), [bx, by] = iso(pistas[j][0] + 0.22, 0, pistas[j][1] - 7);
    ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
  });
  ctx.stroke();
  pistas.forEach(([u, z], k) => enMuroFondo(ctx, u, 0.45, z - 16, 16, ["#f4efe4", "#fbe7a1", "#dfe9f5"][k % 3]));
  enMuroIzq(ctx, 2.0, 2.6, 60, 52, "#2a2f3a");
  enMuroIzq(ctx, 2.15, 2.3, 64, 44, "#6f8c6b");
  enMuroIzq(ctx, 2.7, 0.7, 78, 16, "#a7b98a");
  enMuroIzq(ctx, 3.7, 0.5, 70, 24, "#a7b98a");

  // Sala de juntas: pantalla grande
  enMuroIzq(ctx, 10.6, 3.2, 52, 58, "#111317");
  enMuroIzq(ctx, 10.75, 2.9, 56, 50, "#1d2733");

  // Letreros de cada cuarto
  OFICINAS.forEach((o, i) => {
    const [x, y] = iso((o.x0 + o.x1) / 2, 0, MURO - 2);
    letrero(ctx, `${AGENTES[i].zona} · ${AGENTES[i].persona}`, x, y - 10, { fondo: "#1a1d26", tinta: ["#f3d38b", "#b8f0d4", "#ffc4dc"][i] });
  });
  const [jx, jy] = iso(0, 12.2, MURO - 2);
  letrero(ctx, "Sala de juntas", jx, jy - 10, { fondo: "#1a1d26", tinta: "#cfe0ff" });
}

/* ---------------------------------------------------------------------
   La oficina
   --------------------------------------------------------------------- */
export function crearOficina(canvas, { alTocarAgente } = {}) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = ANCHO * dpr;
  canvas.height = ALTO * dpr;
  canvas.style.aspectRatio = `${ANCHO} / ${ALTO}`;

  const fondo = document.createElement("canvas");
  fondo.width = canvas.width; fondo.height = canvas.height;
  const fctx = fondo.getContext("2d");
  fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  pintarFondo(fctx);

  const avatares = AGENTES.map((a, i) => {
    const s = SITIOS_CAFE[i * 2];
    return {
      agente: a, i, x: s.x, y: s.y, ruta: [], paso: 0, tPaso: 0, espejo: false,
      lugar: { tipo: "cafe", x: s.x, y: s.y, sitio: s, sentado: false, aprox: [] },
      llego: true, sentado: false, quieto: 1 + Math.random() * 4, caja: null,
    };
  });
  let estado = AGENTES.map(() => ({ enCurso: [], pendientes: 0 }));
  let listos = 0, reunion = false;
  const chispas = [];

  // Ruta de un lugar a otro pasando por las puertas y el pasillo.
  function irA(av, destino) {
    const pts = [];
    if (av.llego && av.lugar?.aprox?.length) pts.push(...[...av.lugar.aprox].reverse());
    const desde = pts.length ? pts[pts.length - 1] : { x: av.x, y: av.y };
    const a = cuarto(desde);
    const b = cuarto(destino.aprox.length ? destino.aprox[0] : destino);
    if (a !== b) {
      if (a !== "pasillo") { const p = PUERTAS[a]; pts.push({ x: p.x, y: p.dentro }, { x: p.x, y: PASILLO }); }
      else pts.push({ x: desde.x, y: PASILLO });
      if (b !== "pasillo") { const p = PUERTAS[b]; pts.push({ x: p.x, y: PASILLO }, { x: p.x, y: p.dentro }); }
    }
    pts.push(...destino.aprox, destino);
    av.ruta = pts;
    av.lugar = destino;
    av.llego = false;
    av.sentado = false;
  }

  function actualizar(productos) {
    estado = AGENTES.map((a) => ({
      enCurso: productos.filter((p) => p.etapa === a.etapa && p.estado === "en_curso"),
      pendientes: productos.filter((p) => p.etapa === a.etapa && p.estado !== "en_curso").length,
    }));
    listos = productos.filter((p) => p.etapa === "listo").length;
    reunion = estado.every((e) => e.enCurso.length > 0);
    avatares.forEach((av) => {
      const quiere = reunion ? "juntas" : estado[av.i].enCurso.length ? "escritorio" : "cafe";
      if (av.lugar?.tipo === quiere) return;
      irA(av, quiere === "juntas" ? lugarJuntas(av.i) : quiere === "escritorio" ? lugarEscritorio(av.i) : lugarCafe());
    });
  }

  function mover(av, dt) {
    if (!av.ruta.length) {
      av.paso = 0;
      av.llego = true;
      av.sentado = !!av.lugar?.sentado;
      if (av.lugar?.tipo === "cafe") {
        av.quieto -= dt;
        if (av.quieto <= 0) { irA(av, lugarCafe(av.lugar.sitio)); av.quieto = 5 + Math.random() * 7; }
      }
      return;
    }
    const obj = av.ruta[0], dx = obj.x - av.x, dy = obj.y - av.y, dist = Math.hypot(dx, dy), v = 2.6 * dt;
    if (Math.abs(dx - dy) > 0.01) av.espejo = dx - dy < 0;
    if (dist <= v) { av.x = obj.x; av.y = obj.y; av.ruta.shift(); }
    else { av.x += dx / dist * v; av.y += dy / dist * v; }
    av.tPaso += dt;
    if (av.tPaso > 0.15) { av.tPaso = 0; av.paso = 1 - av.paso; }
  }

  /* ----- Muebles: se ordenan por profundidad junto con los avatares ----- */
  function muebles(t) {
    const cosas = [];
    const poner = (x, y, dibujar) => cosas.push({ prof: x + y, dibujar });
    const planta = (x, y) => poner(x + 0.3, y + 0.3, () => {
      caja(ctx, x, y, 0.6, 0.6, 18, ["#e7e1d6", "#b8b0a2", "#cfc8bb"]);
      const [px, py] = iso(x + 0.3, y + 0.3, 40);
      ctx.fillStyle = "#2f6b3e"; ctx.fillRect(px - 14, py - 6, 28, 26);
      ctx.fillStyle = "#3f8a4f"; ctx.fillRect(px - 11, py - 22, 22, 22);
      ctx.fillStyle = "#56a865"; ctx.fillRect(px - 7, py - 34, 14, 16);
      ctx.fillStyle = "#7cc78a"; ctx.fillRect(px - 4, py - 30, 4, 4); ctx.fillRect(px + 3, py - 16, 4, 4);
    });

    // Muros de vidrio, en tramos cortos para que el orden de dibujo funcione.
    const VIDRIO = ["rgba(200,230,255,.30)", "rgba(170,210,240,.20)", "rgba(190,220,250,.22)"];
    const BASE = ["#3a2d24", "#2b211a", "#33281f"];
    const MARCO = ["#2b211a", "#2b211a", "#2b211a"];
    const vidrioX = (x0, x1, y, huecos) => {
      for (let x = x0; x < x1 - 0.01; x += 0.5) {
        if (huecos.some((h) => Math.abs(x + 0.25 - h) < 0.75)) continue;
        poner(x + 0.25, y + 0.3, () => {
          caja(ctx, x, y - 0.06, 0.5, 0.12, 14, BASE);
          caja(ctx, x, y - 0.03, 0.5, 0.06, 58, VIDRIO, 14);
          caja(ctx, x, y - 0.06, 0.5, 0.12, 4, MARCO, 72);
        });
      }
    };
    const vidrioY = (y0, y1, x, huecos = []) => {
      for (let y = y0; y < y1 - 0.01; y += 0.5) {
        if (huecos.some((h) => Math.abs(y + 0.25 - h) < 0.75)) continue;
        poner(x + 0.3, y + 0.25, () => {
          caja(ctx, x - 0.06, y, 0.12, 0.5, 14, BASE);
          caja(ctx, x - 0.03, y, 0.06, 0.5, 58, VIDRIO, 14);
          caja(ctx, x - 0.06, y, 0.12, 0.5, 4, MARCO, 72);
        });
      }
    };
    vidrioX(0, W, FILA_OFICINAS, [PUERTAS.of0.x, PUERTAS.of1.x, PUERTAS.of2.x]);
    vidrioX(0, CORTE_ABAJO, FILA_ABAJO, [PUERTAS.juntas.x]);
    vidrioY(0, FILA_OFICINAS, CORTES[1]);
    vidrioY(0, FILA_OFICINAS, CORTES[2]);
    vidrioY(FILA_ABAJO, H, CORTE_ABAJO, [12.4]);

    // Escritorios con computador y pila de pendientes
    OFICINAS.forEach((o, i) => {
      const e = o.escritorio, trabaja = estado[i].enCurso.length > 0 && !reunion;
      poner(o.silla.x, o.silla.y - 0.5, () => {
        caja(ctx, o.silla.x - 0.3, o.silla.y - 0.6, 0.6, 0.3, 46, [CUERO, MENTA, ROSA][i]);
        caja(ctx, o.silla.x - 0.32, o.silla.y - 0.32, 0.64, 0.5, 18, OSCURO);
      });
      poner(e.x + e.w / 2, e.y + e.d / 2, () => {
        caja(ctx, e.x, e.y, e.w, e.d, 30, [MADERA, MADERA_CLARA, BLANCO][i]);
        if (i === 2) {   // portátil rosado
          caja(ctx, e.x + 0.2, e.y + 0.3, 0.7, 0.45, 2, ["#e2e2e8", "#bcbcc4", "#cfcfd6"], 30);
          caja(ctx, e.x + 0.2, e.y + 0.25, 0.7, 0.06, 18, ["#f7d3e2", "#d6a2b8", "#e7b7cb"], 32);
        } else {
          caja(ctx, e.x + 0.15, e.y + 0.2, 0.9, 0.12, 24, OSCURO, 34);
          caja(ctx, e.x + 0.52, e.y + 0.3, 0.15, 0.15, 4, OSCURO, 30);
        }
        if (trabaja) {
          const [lx, ly] = iso(e.x + 0.6, e.y + 0.3, 46);
          ctx.fillStyle = Math.floor(t / 350) % 2 ? "rgba(140,220,255,.85)" : "rgba(140,220,255,.5)";
          ctx.fillRect(lx - 9, ly - 6, 18, 3);
          ctx.fillRect(lx - 9, ly, 12, 3);
        }
        if (i === 0) {   // lámpara verde del detective
          caja(ctx, e.x + 2.15, e.y + 0.2, 0.1, 0.1, 18, ["#2f5a3a", "#2f5a3a", "#2f5a3a"], 30);
          caja(ctx, e.x + 2.0, e.y + 0.1, 0.36, 0.3, 6, ["#3f8f5a", "#2f6a43", "#367a4e"], 48);
          const [gx, gy] = iso(e.x + 2.15, e.y + 0.4, 30);
          ctx.fillStyle = "rgba(255,220,140,.28)"; ctx.beginPath(); ctx.ellipse(gx, gy, 30, 12, 0, 0, 7); ctx.fill();
        }
        if (i === 1) {   // frasco con polvo de hada
          caja(ctx, e.x + 2.05, e.y + 0.3, 0.25, 0.25, 14, ["rgba(255,240,170,.9)", "rgba(240,210,110,.8)", "rgba(250,225,140,.8)"], 30);
        }
        if (i === 2) {   // florero
          caja(ctx, e.x + 1.9, e.y + 0.3, 0.25, 0.25, 12, ["#ffffff", "#d8d8e0", "#e8e8ee"], 30);
          const [fx, fy] = iso(e.x + 2.02, e.y + 0.42, 50);
          [["#ff6fa3", -5, 0], ["#ffb3cf", 4, -3], ["#ffffff", 0, -7]].forEach(([c, ox, oy]) => { ctx.fillStyle = c; ctx.fillRect(fx + ox - 3, fy + oy - 3, 6, 6); });
        }
        const n = Math.min(estado[i].pendientes, 6);
        const px = e.x + 1.0, py = e.y + 0.6;
        for (let k = 0; k < n; k++) caja(ctx, px, py, 0.38, 0.3, 3, PAPEL, 30 + k * 3);
        if (estado[i].pendientes) {
          const [bx, by] = iso(px + 0.2, py + 0.15, 30 + n * 3 + 16);
          ctx.fillStyle = "#e24a3b"; ctx.beginPath(); ctx.arc(bx, by, 10, 0, 7); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "700 12px system-ui"; ctx.textAlign = "center"; ctx.fillText(estado[i].pendientes, bx, by + 4);
        }
      });
    });

    // ---- Agencia de investigación (detective)
    poner(0.9, 5.2, () => {   // archivador
      caja(ctx, 0.3, 4.4, 0.9, 1.3, 64, METAL);
      [14, 32, 50].forEach((z) => caja(ctx, 1.2, 4.6, 0.02, 0.9, 10, ["#5a626c", "#5a626c", "#4a525c"], z));
    });
    poner(7.6, 1.0, () => {   // perchero con gabardina y sombrero
      caja(ctx, 7.55, 0.85, 0.1, 0.1, 84, ["#3b2a1d", "#2b1e14", "#33241a"]);
      caja(ctx, 7.35, 0.7, 0.5, 0.4, 30, ["#c9a46a", "#9c7c4a", "#b08e5a"], 42);
      caja(ctx, 7.35, 0.75, 0.45, 0.35, 8, ["#5b4636", "#3e3026", "#4c3a2d"], 84);
    });
    poner(5.6, 4.8, () => { caja(ctx, 5.0, 4.3, 1.2, 1.0, 22, CUERO); caja(ctx, 5.0, 4.3, 1.2, 0.3, 40, CUERO); });
    poner(2.1, 5.9, () => {
      caja(ctx, 1.7, 5.6, 0.7, 0.5, 14, MADERA);
      caja(ctx, 1.75, 5.65, 0.5, 0.35, 3, ["#f4efe4", "#d8d0c0", "#e6dfd1"], 14);
    });
    planta(0.25, 0.25);

    // ---- Taller del hada (producto)
    poner(9.4, 1.4, () => {   // estante con cajas de productos
      caja(ctx, 8.8, 0.25, 0.6, 2.4, 96, MADERA_CLARA);
      const colores = ["#f2cf5b", "#5fbf6a", "#e85a9a", "#6fb3e8", "#c58cf0"];
      for (let f = 0; f < 4; f++) for (let k = 0; k < 4; k++) {
        if ((f + k) % 3 === 2) continue;
        const c = colores[(f * 2 + k) % colores.length];
        caja(ctx, 9.4, 0.4 + k * 0.55, 0.05, 0.35, 16, [c, c, c], 8 + f * 24);
      }
    });
    poner(14.6, 4.9, () => {  // mesa de trabajo
      caja(ctx, 13.6, 4.4, 2.2, 1.0, 28, MADERA_CLARA);
      caja(ctx, 13.8, 4.55, 0.5, 0.4, 10, ["#f2cf5b", "#c9a840", "#ddbb4d"], 28);
      caja(ctx, 14.6, 4.6, 0.7, 0.5, 4, PAPEL, 28);
      caja(ctx, 14.65, 4.62, 0.6, 0.45, 2, PAPEL, 32);
    });
    poner(16.6, 1.0, () => {  // impresora de PDFs
      caja(ctx, 16.1, 0.6, 0.9, 0.8, 30, BLANCO);
      caja(ctx, 16.2, 0.7, 0.7, 0.6, 12, ["#e8e8ec", "#c4c4cc", "#d6d6dc"], 30);
      caja(ctx, 16.25, 1.2, 0.6, 0.3, 2, PAPEL, 22);
    });
    poner(10.0, 5.7, () => {  // hongo gigante
      caja(ctx, 9.85, 5.55, 0.3, 0.3, 26, ["#f6efe0", "#d8cfbd", "#e7dfcf"]);
      const [hx, hy] = iso(10.0, 5.7, 30);
      ctx.fillStyle = "#e24a3b"; ctx.beginPath(); ctx.ellipse(hx, hy, 26, 16, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#fff"; [[-12, -6], [2, -11], [12, -5]].forEach(([a, b]) => ctx.fillRect(hx + a - 2, hy + b - 2, 5, 5));
    });
    planta(16.6, 5.8);
    // Destellos del taller
    if (Math.random() < 0.15) {
      const [sx, sy] = iso(10 + Math.random() * 6, 1 + Math.random() * 5, 10 + Math.random() * 70);
      chispas.push({ x: sx, y: sy, vida: 1 });
    }

    // ---- Estudio de guiones (columnista)
    poner(24.9, 0.6, () => {  // clóset de zapatos
      caja(ctx, 24.0, 0.15, 1.8, 0.8, 92, BLANCO);
      const zap = ["#d6336c", "#111", "#f2cf5b", "#e85a9a", "#7b4fa3", "#c0392b"];
      for (let f = 0; f < 4; f++) for (let k = 0; k < 4; k++) {
        const c = zap[(f + k * 2) % zap.length];
        caja(ctx, 24.12 + k * 0.42, 0.95, 0.3, 0.04, 7, [c, c, c], 10 + f * 20);
      }
    });
    poner(24.9, 4.4, () => {  // espejo de pie
      caja(ctx, 24.8, 3.9, 0.12, 0.9, 80, ["#f2cf5b", "#c9a840", "#ddbb4d"]);
      caja(ctx, 24.77, 4.0, 0.04, 0.7, 64, ["#cfe8f5", "#cfe8f5", "#cfe8f5"], 8);
    });
    poner(19.4, 5.4, () => {  // sillón y revistas
      caja(ctx, 18.6, 4.8, 1.3, 1.0, 22, ROSA);
      caja(ctx, 18.6, 4.8, 0.3, 1.0, 40, ROSA);
    });
    poner(21.0, 5.6, () => {
      caja(ctx, 20.6, 5.2, 0.7, 0.6, 18, BLANCO);
      ["#e85a9a", "#111", "#f2cf5b"].forEach((c, k) => caja(ctx, 20.7, 5.28, 0.5, 0.4, 2, [c, c, c], 18 + k * 2));
    });

    // ---- Sala de juntas
    PUESTOS_JUNTAS.forEach((s) => poner(s.x, s.y - 0.5, () => {
      caja(ctx, s.x - 0.3, s.y - 0.6, 0.6, 0.3, 46, TELA_AZUL);
      caja(ctx, s.x - 0.32, s.y - 0.32, 0.64, 0.5, 18, OSCURO);
    }));
    // La mesa es larga: se ordena por su esquina más cercana para tapar a quien se sienta detrás.
    poner(MESA.x + MESA.w, MESA.y + MESA.d, () => {
      caja(ctx, MESA.x, MESA.y, MESA.w, MESA.d, 30, MADERA);
      [0.8, 2.9, 5.0].forEach((u) => caja(ctx, MESA.x + u, MESA.y + 0.5, 0.5, 0.35, 2, PAPEL, 30));
      if (reunion) {
        const [cx, cy] = iso(MESA.x + MESA.w / 2, MESA.y + MESA.d / 2, 32);
        ctx.fillStyle = "rgba(255,240,200,.25)"; ctx.beginPath(); ctx.ellipse(cx, cy, 130, 40, 0, 0, 7); ctx.fill();
      }
    });
    [4.4, 6.5, 8.6].forEach((x) => poner(x, 14.5, () => {   // sillas del frente, de espaldas
      caja(ctx, x - 0.32, 14.0, 0.64, 0.5, 18, OSCURO);
      caja(ctx, x - 0.3, 14.4, 0.6, 0.25, 46, TELA_AZUL);
    }));
    if (reunion) poner(0.2, 12.2, () => {   // la pantalla se enciende en reunión
      poligono(ctx, [iso(0.02, 10.75, 106), iso(0.02, 13.65, 106), iso(0.02, 13.65, 56), iso(0.02, 10.75, 56)], "#3b6fb0");
      const [tx, ty] = iso(0.02, 12.2, 80);
      ctx.fillStyle = "#fff"; ctx.font = "800 14px system-ui"; ctx.textAlign = "center"; ctx.fillText("NUCLEA", tx, ty + 5);
    });
    planta(0.3, 16.9);
    planta(11.9, 9.4);

    // ---- Café y descanso
    poner(16.5, 10.0, () => {   // barra de café
      caja(ctx, 13.8, 9.3, 5.0, 0.9, 34, MADERA);
      caja(ctx, 13.8, 9.3, 5.0, 0.9, 3, ["#efe5d6", "#cfc3b0", "#ddd2bf"], 34);
      caja(ctx, 14.2, 9.4, 0.6, 0.5, 26, METAL, 37);
      caja(ctx, 14.3, 9.85, 0.4, 0.06, 8, ["#111", "#111", "#111"], 45);
      [15.4, 15.8, 16.2].forEach((x) => caja(ctx, x, 9.6, 0.2, 0.2, 7, PAPEL, 37));
      caja(ctx, 17.2, 9.5, 0.9, 0.5, 14, ["#f4d8a8", "#d2b17d", "#e3c491"], 37);
      const [lx, ly] = iso(16.3, 9.3, 96);
      letrero(ctx, "Café y descanso ☕", lx, ly, { fondo: "#7a3b2e", tam: 13 });
    });
    poner(23.0, 9.8, () => {    // máquina de snacks
      caja(ctx, 22.4, 9.2, 1.0, 0.8, 80, ["#e24a3b", "#a8352b", "#c43f33"]);
      caja(ctx, 22.5, 10.0, 0.8, 0.02, 48, ["#cfe8f5", "#9fd3ff", "#cfe8f5"], 22);
    });
    poner(17.6, 16.6, () => {   // sofá
      caja(ctx, 15.8, 16.9, 3.6, 0.5, 40, ["#e7a24a", "#b47a33", "#cc8d3e"]);
      caja(ctx, 15.8, 16.0, 3.6, 0.95, 20, ["#f1b45e", "#c18540", "#d9984c"]);
      caja(ctx, 15.8, 16.0, 0.35, 1.4, 30, ["#e7a24a", "#b47a33", "#cc8d3e"]);
      caja(ctx, 19.05, 16.0, 0.35, 1.4, 30, ["#e7a24a", "#b47a33", "#cc8d3e"]);
    });
    poner(17.6, 14.5, () => caja(ctx, 16.9, 14.1, 1.4, 0.8, 14, MADERA_CLARA));
    [[21.4, 13.8], [24.2, 11.6]].forEach(([x, y]) => poner(x, y, () => {   // mesitas altas
      caja(ctx, x - 0.08, y - 0.08, 0.16, 0.16, 26, OSCURO);
      caja(ctx, x - 0.55, y - 0.55, 1.1, 1.1, 3, BLANCO, 26);
      caja(ctx, x - 0.1, y - 0.3, 0.18, 0.18, 6, PAPEL, 29);
    }));
    poner(13.7, 15.4, () => {   // biblioteca de productos listos
      caja(ctx, 13.15, 14.0, 0.7, 2.8, 96, MADERA);
      const libros = ["#e24a3b", "#3b82c4", "#e3b23c", "#4f9a5b", "#8e5bb5"];
      for (let k = 0; k < Math.min(listos, 20); k++) {
        const f = Math.floor(k / 5), c = k % 5;
        caja(ctx, 13.85, 14.15 + c * 0.52, 0.06, 0.38, 18, [libros[c], libros[c], libros[c]], 6 + f * 23);
      }
      const [lx, ly] = iso(13.5, 15.4, 114);
      letrero(ctx, `Productos listos: ${listos}`, lx, ly, { tam: 12 });
    });
    planta(13.4, 17.3);
    planta(25.2, 9.4);
    planta(21.6, 17.2);
    return cosas;
  }

  /* ----- Avatares ----- */
  function dibujarAvatar(av, t) {
    const [px, py0] = iso(av.x, av.y);
    const sentado = av.sentado && !av.ruta.length;
    const py = py0 - (sentado ? 4 + (Math.floor(t / 320) % 2) : 0);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath(); ctx.ellipse(px, py0, 16, 6, 0, 0, 7); ctx.fill();
    if (av.agente.colores.alas) {
      const aleteo = 0.7 + 0.3 * Math.abs(Math.sin(t / 120)), k = ESCALA / 3;
      ctx.fillStyle = av.agente.colores.alas;
      ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 1;
      [-1, 1].forEach((lado) => {
        ctx.beginPath(); ctx.ellipse(px + lado * 15 * k * aleteo, py - 40 * k, 13 * k * aleteo, 8 * k, lado * -0.5, 0, 7); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(px + lado * 11 * k * aleteo, py - 28 * k, 8 * k * aleteo, 5 * k, lado * 0.4, 0, 7); ctx.fill(); ctx.stroke();
      });
      if (Math.random() < (av.ruta.length || sentado ? 0.3 : 0.08)) chispas.push({ x: px + (Math.random() - 0.5) * 34, y: py - 16 - Math.random() * 34, vida: 1 });
    }
    pintarSprite(ctx, av.agente, px, py, sentado ? 0 : av.paso, av.espejo);
    av.caja = { x: px - 6 * ESCALA - 4, y: py - ALTO_SPRITE * ESCALA - 6, w: 12 * ESCALA + 8, h: ALTO_SPRITE * ESCALA + 12 };
    av.etiqueta = { x: px, y: py0 + 8, oculta: sentado };
  }

  function dibujarChispas(dt) {
    for (let k = chispas.length - 1; k >= 0; k--) {
      const c = chispas[k];
      c.vida -= dt * 1.2; c.y += dt * 12;
      if (c.vida <= 0) { chispas.splice(k, 1); continue; }
      ctx.fillStyle = `rgba(255, 236, 140, ${c.vida.toFixed(2)})`;
      ctx.fillRect(c.x - 1, c.y - 3, 2, 6); ctx.fillRect(c.x - 3, c.y - 1, 6, 2);
    }
  }

  function dibujarNombre(av) {
    if (!av.etiqueta || av.etiqueta.oculta) return;
    const { x, y } = av.etiqueta, texto = `${av.agente.nombre} · ${av.agente.persona}`;
    ctx.font = "700 12px system-ui"; ctx.textAlign = "center";
    const w = ctx.measureText(texto).width + 12;
    ctx.fillStyle = "rgba(20,18,24,0.78)";
    ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, 18, 5); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText(texto, x, y + 13);
  }

  function dibujarGlobo(av) {
    if (reunion || !av.caja) return;
    const { x, y } = av.caja, e = estado[av.i], f = av.agente.frases || {};
    let texto, fuerte = false;
    if (e.enCurso.length && av.sentado) {
      const p = e.enCurso[0];
      texto = e.enCurso.length > 1 ? `${e.enCurso.length} productos en curso` : `${p.responsable?.nombre || av.agente.persona} · ${p.nombre}`;
    } else if (e.enCurso.length) {
      texto = f.trabajando || "Voy a mi oficina…";
    } else if (e.pendientes) {
      texto = `${f.espera || "¡Me esperan!"} (${e.pendientes})`;
      fuerte = true;
    } else {
      texto = f.libre || "Tomando café ☕";
    }
    globo(ctx, texto, x + av.caja.w / 2, y, fuerte);
  }

  let ultimo = performance.now();
  function cuadro(t) {
    const dt = Math.min(0.05, Math.max(0, (t - ultimo) / 1000));
    ultimo = t;
    avatares.forEach((av) => mover(av, dt));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(fondo, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const cosas = muebles(t);
    avatares.forEach((av) => cosas.push({ prof: av.x + av.y + 0.01, dibujar: () => dibujarAvatar(av, t) }));
    cosas.sort((a, b) => a.prof - b.prof).forEach((c) => c.dibujar());
    dibujarChispas(dt);
    avatares.forEach((av) => { dibujarNombre(av); dibujarGlobo(av); });
    if (reunion) {
      const [cx, cy] = iso(MESA.x + MESA.w / 2, MESA.y - 0.6, 110);
      const n = estado.reduce((s, e) => s + e.enCurso.length, 0);
      globo(ctx, `Reunión de equipo · ${n} turnos en curso`, cx, cy, true);
    }
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);

  canvas.addEventListener("click", (ev) => {
    const r = canvas.getBoundingClientRect();
    const x = (ev.clientX - r.left) * ANCHO / r.width, y = (ev.clientY - r.top) * ALTO / r.height;
    const av = avatares.find((a) => a.caja && x >= a.caja.x && x <= a.caja.x + a.caja.w && y >= a.caja.y && y <= a.caja.y + a.caja.h);
    if (av && alTocarAgente) alTocarAgente(av.agente);
  });

  return { actualizar };
}
