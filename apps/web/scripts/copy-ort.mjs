// Copies the ONNX Runtime WebAssembly files next to the site so the Master level can load them.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const out = join(process.cwd(), "public", "ort");
mkdirSync(out, { recursive: true });
// The package exports these files under their own names.
for (const name of ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"]) {
  copyFileSync(require.resolve(`onnxruntime-web/${name}`), join(out, name));
}
console.log("copied ONNX Runtime files to public/ort");
