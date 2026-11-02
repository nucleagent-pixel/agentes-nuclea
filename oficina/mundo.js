// La oficina en pixel art isométrico, dibujada en un <canvas> sin imágenes externas.
import { AGENTES } from "./config.js";

const TW = 64, TH = 32;          // tamaño de una baldosa
const W = 16, H = 11;            // baldosas de ancho y fondo
const MURO = 120, MARGEN = 20, ESCALA = 3;
const ANCHO = (W + H) * TW / 2 + MARGEN * 2;
const ALTO = (W + H) * TH / 2 + MURO + MARGEN * 2;
const OX = H * TW / 2 + MARGEN, OY = MURO + MARGEN;

const iso = (x, y, z = 0) => [OX + (x - y) * TW / 2, OY + (x + y) * TH / 2 - z];

// Escritorios: uno por agente, contra el muro del fondo.
const ESCRITORIOS = [1.5, 6.5, 11.5].map((x) => ({ x, y: 2.4, silla: { x: x + 1.3, y: 1.95 } }));
const SALA = [{ x: 5.6, y: 8.3 }, { x: 8, y: 8.6 }, { x: 10.4, y: 8.3 }];
const PASILLO_Y = 5.2;

// Sprites de 10 x 16 píxeles. Letras: H pelo, S piel, E ojos, G gafas, M boca,
// T ropa, P pantalón, Z zapatos.
const CABEZAS = {
  bob: ["..HHHHHH..", ".HHHHHHHH.", ".HHHHHHHH.", ".HSSSSSSH.", ".HGEGGEGH.", ".HSSSSSSH.", ".HSSMMSSH.", "..TSSSST.."],
  rizos: [".HH.HH.HH.", "HHHHHHHHHH", ".HSSSSSSH.", ".SSSSSSSS.", ".SSESSESS.", ".SSSSSSSS.", "..SSMMSS..", "..TTTTTT.."],
  largo: ["..HHHHHH..", ".HHHHHHHH.", "HHSSSSSSHH", "HSSSSSSSSH", "HSSESSESSH", "HSSSSSSSSH", "HHSSMMSSHH", "HHTTTTTTHH"],
};
const CUERPO = [".TTTTTTTT.", "STTTTTTTTS", "STTTTTTTTS", "..TTTTTT..", "..PPPPPP.."];
const PIERNAS = [
  ["..PP..PP..", "..PP..PP..", "..ZZ..ZZ.."],
  [".PP....PP.", ".PP....PP.", ".ZZ....ZZ."],
];

function pintarSprite(ctx, agente, px, py, paso, espejo) {
  const c = agente.colores;
  const color = { H: c.pelo, S: c.piel, E: "#222", G: c.gafas || "#222", M: "#b8564b", T: c.ropa, P: c.pantalon, Z: c.zapatos };
  const filas = [...CABEZAS[agente.estilo], ...CUERPO, ...PIERNAS[paso]];
  const x0 = px - 5 * ESCALA, y0 = py - 16 * ESCALA;
  filas.forEach((fila, j) => {
    for (let i = 0; i < 10; i++) {
      const k = fila[espejo ? 9 - i : i];
      if (k === ".") continue;
      ctx.fillStyle = color[k];
      ctx.fillRect(x0 + i * ESCALA, y0 + j * ESCALA, ESCALA, ESCALA);
    }
  });
}

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

function globo(ctx, texto, x, y, fuerte) {
  ctx.font = "600 12px system-ui, sans-serif";
  const t = texto.length > 32 ? texto.slice(0, 31) + "…" : texto;
  const w = ctx.measureText(t).width + 16, h = 24, bx = Math.round(x - w / 2), by = Math.round(y - h - 8);
  ctx.fillStyle = fuerte ? "#fff7e0" : "#ffffff";
  ctx.strokeStyle = "#2b2b2b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, 6);
  ctx.moveTo(x - 5, by + h); ctx.lineTo(x, by + h + 7); ctx.lineTo(x + 5, by + h);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#1d1d1d";
  ctx.textAlign = "center";
  ctx.fillText(t, x, by + 16);
}

const MADERA = ["#c8955c", "#9c6b3b", "#b27f4b"];
const GRIS = ["#d9dde3", "#9aa1ab", "#b9bfc8"];
const ALFOMBRAS = ["#e7d3a8", "#bfdcc9", "#d9c6e6"];

export function crearOficina(canvas, { alTocarAgente } = {}) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = ANCHO * dpr;
  canvas.height = ALTO * dpr;
  canvas.style.aspectRatio = `${ANCHO} / ${ALTO}`;

  const avatares = AGENTES.map((a, i) => ({
    agente: a, i, x: SALA[i].x, y: SALA[i].y, ruta: [], paso: 0, tPaso: 0, espejo: false,
    sentado: false, quieto: Math.random() * 4, caja: null,
  }));
  let estado = AGENTES.map(() => ({ enCurso: [], pendientes: 0 }));
  let listos = 0;

  function rutaA(av, destino) {
    const e = ESCRITORIOS[av.i];
    const lado = e.x - 0.6;
    const enEscritorio = av.y < 2.3;
    if (destino === "escritorio") {
      return enEscritorio ? [] : [{ x: lado, y: PASILLO_Y }, { x: lado, y: e.silla.y }, e.silla];
    }
    const p = { x: SALA[av.i].x + (Math.random() - 0.5) * 1.6, y: SALA[av.i].y + (Math.random() - 0.5) * 0.8 };
    return enEscritorio ? [{ x: lado, y: e.silla.y }, { x: lado, y: PASILLO_Y }, p] : [p];
  }

  function actualizar(productos) {
    estado = AGENTES.map((a) => ({
      enCurso: productos.filter((p) => p.etapa === a.etapa && p.estado === "en_curso"),
      pendientes: productos.filter((p) => p.etapa === a.etapa && p.estado !== "en_curso").length,
    }));
    listos = productos.filter((p) => p.etapa === "listo").length;
    avatares.forEach((av) => {
      const trabaja = estado[av.i].enCurso.length > 0;
      if (trabaja && !av.sentado && !av.ruta.length) av.ruta = rutaA(av, "escritorio");
      if (!trabaja && (av.sentado || av.y < 2.3)) { av.sentado = false; av.ruta = rutaA(av, "sala"); }
    });
  }

  function mover(av, dt) {
    if (!av.ruta.length) {
      av.paso = 0;
      if (estado[av.i].enCurso.length) { av.sentado = true; return; }
      av.quieto -= dt;
      if (av.quieto <= 0) { av.ruta = rutaA(av, "sala"); av.quieto = 4 + Math.random() * 6; }
      return;
    }
    const obj = av.ruta[0], dx = obj.x - av.x, dy = obj.y - av.y, dist = Math.hypot(dx, dy), v = 2.2 * dt;
    const pantallaDx = (dx - dy);
    if (Math.abs(pantallaDx) > 0.01) av.espejo = pantallaDx < 0;
    if (dist <= v) { av.x = obj.x; av.y = obj.y; av.ruta.shift(); }
    else { av.x += dx / dist * v; av.y += dy / dist * v; }
    av.tPaso += dt;
    if (av.tPaso > 0.16) { av.tPaso = 0; av.paso = 1 - av.paso; }
  }

  function piso() {
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
      let color = (x + y) % 2 ? "#efe6d8" : "#e7dccb";
      const zona = y >= 1 && y < 5 ? Math.floor((x - 1) / 5) : -1;
      if (zona >= 0 && zona < 3 && x >= 1 && x < 16 && (x - 1) % 5 < 4) color = ALFOMBRAS[zona];
      if (y >= 7 && y < 10 && x >= 4 && x < 13) color = (x + y) % 2 ? "#cfe0ea" : "#c3d6e2";
      poligono(ctx, [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], color);
    }
  }

  function muros(t) {
    poligono(ctx, [iso(0, 0), iso(W, 0), iso(W, 0, MURO), iso(0, 0, MURO)], "#f3c98b");
    poligono(ctx, [iso(0, 0), iso(0, H), iso(0, H, MURO), iso(0, 0, MURO)], "#e0b06f");
    poligono(ctx, [iso(0, 0, MURO - 10), iso(W, 0, MURO - 10), iso(W, 0, MURO), iso(0, 0, MURO)], "#d89a4f");
    // Ventanas del muro izquierdo
    [2.5, 6.5].forEach((y) => poligono(ctx, [iso(0, y, 45), iso(0, y + 2, 45), iso(0, y + 2, 95), iso(0, y, 95)], "#a9d8f0"));
    // Letreros de cada zona
    ESCRITORIOS.forEach((e, i) => {
      const [x, y] = iso(e.x + 1.4, 0, 92);
      const nombre = AGENTES[i].zona;
      ctx.font = "700 13px system-ui, sans-serif";
      const w = ctx.measureText(nombre).width + 18;
      ctx.fillStyle = "#3a2a1a";
      ctx.beginPath(); ctx.roundRect(x - w / 2, y - 14, w, 24, 5); ctx.fill();
      ctx.fillStyle = "#fff4dc"; ctx.textAlign = "center"; ctx.fillText(nombre, x, y + 3);
    });
    // Reloj
    const [rx, ry] = iso(W - 1.2, 0, 70);
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(rx, ry, 11, 0, 7); ctx.fill();
    ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 2; ctx.stroke();
    const a = t / 2000;
    ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + Math.cos(a) * 7, ry + Math.sin(a) * 7); ctx.stroke();
  }

  // Todo lo que tiene profundidad se ordena por x + y y se dibuja de atrás hacia adelante.
  function escena(t) {
    const cosas = [];
    ESCRITORIOS.forEach((e, i) => {
      cosas.push({ prof: e.x + e.y + 2.5, dibujar: () => {
        caja(ctx, e.x, e.y, 2, 0.9, 26, MADERA);
        const trabaja = estado[i].enCurso.length > 0;
        caja(ctx, e.x + 0.2, e.y + 0.15, 0.7, 0.18, 20, ["#3b3f46", "#2b2f36", "#33373e"], 26);
        if (trabaja && Math.floor(t / 400) % 2) {
          const [lx, ly] = iso(e.x + 0.55, e.y + 0.1, 40);
          ctx.fillStyle = "rgba(140, 220, 255, 0.55)"; ctx.fillRect(lx - 8, ly - 4, 16, 3);
        }
        const n = Math.min(estado[i].pendientes, 5);
        for (let k = 0; k < n; k++) caja(ctx, e.x + 1.45, e.y + 0.45, 0.4, 0.3, 3, ["#ffffff", "#dcdcdc", "#ececec"], 26 + k * 3);
        if (estado[i].pendientes) {
          const [bx, by] = iso(e.x + 1.65, e.y + 0.6, 26 + n * 3 + 14);
          ctx.fillStyle = "#e24a3b"; ctx.beginPath(); ctx.arc(bx, by, 9, 0, 7); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "700 11px system-ui"; ctx.textAlign = "center"; ctx.fillText(estado[i].pendientes, bx, by + 4);
        }
      }});
      cosas.push({ prof: e.silla.x + e.silla.y - 0.6, dibujar: () => caja(ctx, e.silla.x - 0.3, e.silla.y - 0.75, 0.6, 0.35, 34, ["#4a4f58", "#383c44", "#41464e"]) });
    });

    // Sala: sofá, mesa, café, plantas y estante de productos listos.
    cosas.push({ prof: 4 + 10.2 + 1, dibujar: () => { caja(ctx, 4.5, 9.6, 3, 0.4, 34, ["#d0675a", "#a84c41", "#bd5a4e"]); caja(ctx, 4.5, 9.0, 3, 0.8, 16, ["#e07a6c", "#b85a4e", "#cc6a5d"]); } });
    cosas.push({ prof: 15.5, dibujar: () => caja(ctx, 8.6, 7.4, 1.4, 0.8, 14, MADERA) });
    cosas.push({ prof: 14.6 + 7.4, dibujar: () => { caja(ctx, 14.6, 7.0, 0.8, 0.8, 44, GRIS); caja(ctx, 14.75, 7.3, 0.5, 0.25, 8, ["#3b3f46", "#2b2f36", "#33373e"], 30); } });
    [[0.6, 9.6], [15.2, 2.4], [0.6, 0.6]].forEach(([x, y]) => cosas.push({ prof: x + y + 0.8, dibujar: () => {
      caja(ctx, x, y, 0.6, 0.6, 16, ["#b2643a", "#8a4a2a", "#9c5632"]);
      const [px, py] = iso(x + 0.3, y + 0.3, 34);
      ctx.fillStyle = "#4f9a5b"; ctx.beginPath(); ctx.arc(px, py, 16, 0, 7); ctx.fill();
      ctx.fillStyle = "#62b46e"; ctx.beginPath(); ctx.arc(px - 5, py - 6, 9, 0, 7); ctx.fill();
    }}));
    cosas.push({ prof: 0.15 + 4.6 + 1, dibujar: () => {
      caja(ctx, 0.15, 4.6, 0.7, 1.6, 70, MADERA);
      const libros = ["#e24a3b", "#3b82c4", "#e3b23c", "#4f9a5b", "#8e5bb5"];
      for (let k = 0; k < Math.min(listos, 10); k++) {
        const fila = Math.floor(k / 5), col = k % 5;
        caja(ctx, 0.75, 4.7 + col * 0.28, 0.12, 0.2, 16, [libros[col], libros[col], libros[col]], 12 + fila * 28);
      }
      const [lx, ly] = iso(0.5, 5.4, 88);
      ctx.font = "700 12px system-ui"; ctx.textAlign = "center";
      const tl = `Listos: ${listos}`, wl = ctx.measureText(tl).width + 12;
      ctx.fillStyle = "#3a2a1a"; ctx.beginPath(); ctx.roundRect(lx - wl / 2, ly - 13, wl, 19, 4); ctx.fill();
      ctx.fillStyle = "#fff4dc"; ctx.fillText(tl, lx, ly + 1);
    }});

    avatares.forEach((av) => cosas.push({ prof: av.x + av.y, dibujar: () => dibujarAvatar(av, t) }));
    cosas.sort((a, b) => a.prof - b.prof).forEach((c) => c.dibujar());
    avatares.forEach((av) => { dibujarNombre(av); dibujarGlobo(av); });
  }

  function dibujarAvatar(av, t) {
    const [px, py0] = iso(av.x, av.y);
    const py = py0 - (av.sentado ? 10 + (Math.floor(t / 300) % 2) : 0);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath(); ctx.ellipse(px, py0, 14, 6, 0, 0, 7); ctx.fill();
    pintarSprite(ctx, av.agente, px, py, av.paso, av.espejo);
    av.caja = { x: px - 18, y: py - 16 * ESCALA - 6, w: 36, h: 16 * ESCALA + 12 };
    av.pies = { x: px, y: av.sentado ? py - 16 * ESCALA - 22 : py0 + 6 };
  }

  // El nombre va encima de todo para que el escritorio no lo tape.
  function dibujarNombre(av) {
    if (!av.pies || av.sentado) return;
    const { x, y } = av.pies;
    ctx.font = "700 11px system-ui"; ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    const w = ctx.measureText(av.agente.nombre).width + 10;
    ctx.fillRect(x - w / 2, y, w, 15);
    ctx.fillStyle = "#1d1d1d"; ctx.fillText(av.agente.nombre, x, y + 11);
  }

  function dibujarGlobo(av) {
    const { x, y } = av.caja;
    const e = estado[av.i];
    let texto = "", fuerte = false;
    if (e.enCurso.length && av.sentado) {
      const p = e.enCurso[0];
      texto = `${av.agente.nombre} + ${p.responsable?.nombre || "alguien"} · ${p.nombre}`;
      if (e.enCurso.length > 1) texto = `${e.enCurso.length} productos en curso`;
    } else if (!e.enCurso.length && e.pendientes) {
      texto = e.pendientes === 1 ? "¡1 producto me espera!" : `¡${e.pendientes} productos me esperan!`;
      fuerte = true;
    } else if (!e.enCurso.length) {
      texto = "Tomando café ☕";
    }
    if (texto) globo(ctx, texto, x + 18, y, fuerte);
  }

  let ultimo = performance.now();
  function cuadro(t) {
    const dt = Math.min(0.05, (t - ultimo) / 1000);
    ultimo = t;
    avatares.forEach((av) => mover(av, dt));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#2a2622";
    ctx.fillRect(0, 0, ANCHO, ALTO);
    piso();
    muros(t);
    escena(t);
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
