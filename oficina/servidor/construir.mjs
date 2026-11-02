// Arma un solo archivo, dist/chat-worker.js, para pegarlo en el editor de Cloudflare.
// Uso: npm run construir
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";

const leer = (n) => readFileSync(new URL(`../../agentes/${n}`, import.meta.url), "utf8");
writeFileSync(new URL("./src/instrucciones.js", import.meta.url),
  "// Generado por construir.mjs desde agentes/*.md. No editar a mano.\n" +
  `export const INSTRUCCIONES = ${JSON.stringify({
    investigacion: leer("1-detective-oficina.md"),
    producto: leer("2-creador-de-producto.md"),
    guiones: leer("3-guionista.md"),
  }, null, 2)};\n`);
if (process.argv.includes("--solo-instrucciones")) process.exit(0);
execSync("npx wrangler deploy --dry-run --outdir dist", { stdio: "inherit" });
copyFileSync(new URL("./dist/index.js", import.meta.url), new URL("./dist/chat-worker.js", import.meta.url));
console.log("Listo: dist/chat-worker.js");
