// Copies the ONNX Runtime WebAssembly binary next to the site so the Master level can load it.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("onnxruntime-web/package.json"));
const out = join(process.cwd(), "public", "ort");
mkdirSync(out, { recursive: true });
for (const f of ["ort-wasm-simd-threaded.wasm"]) {
  const src = join(pkgDir, "dist", f);
  if (!existsSync(src)) throw new Error(`missing ${src}`);
  copyFileSync(src, join(out, f));
}
console.log("copied ONNX Runtime wasm to public/ort");
