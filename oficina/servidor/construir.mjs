// Arma un solo archivo, dist/chat-worker.js, para pegarlo en el editor de Cloudflare.
// Las instrucciones de cada agente salen del archivo .md que indica config.js.
// Uso: npm run construir
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { AGENTES } from "../config.js";

const leer = (n) => readFileSync(new URL(`../../agentes/${n}`, import.meta.url), "utf8");
const instrucciones = Object.fromEntries(AGENTES.filter((a) => a.instrucciones).map((a) => [a.id, leer(a.instrucciones)]));
writeFileSync(new URL("./src/instrucciones.js", import.meta.url),
  "// Generado por construir.mjs desde agentes/*.md. No editar a mano.\n" +
  `export const INSTRUCCIONES = ${JSON.stringify(instrucciones, null, 2)};\n`);
if (process.argv.includes("--solo-instrucciones")) process.exit(0);
execSync("npx wrangler deploy --dry-run --outdir dist", { stdio: "inherit" });
copyFileSync(new URL("./dist/index.js", import.meta.url), new URL("./dist/chat-worker.js", import.meta.url));
console.log("Listo: dist/chat-worker.js");
