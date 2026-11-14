// Copies pdf.js (used by "Import from LinkedIn" to read profile PDFs) next to the site CMS.
// The Studio loads it from runtime/, and exported portfolio sites carry it in cms/.
import { copyFileSync, mkdirSync } from "node:fs";
const src = "node_modules/pdfjs-dist/legacy/build/";
mkdirSync("dist/runtime", { recursive: true });
for (const f of ["pdf.min", "pdf.worker.min"]) copyFileSync(src + f + ".mjs", "dist/runtime/" + f + ".js");
// onnxruntime-web (MIT), for finding and cutting out product photos (src/lib/saliency.ts). WebAssembly only.
mkdirSync("dist/runtime/ort", { recursive: true });
for (const f of ["ort.wasm.min.mjs", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) copyFileSync("node_modules/onnxruntime-web/dist/" + f, "dist/runtime/ort/" + f);
console.log("pdf.js and onnxruntime-web copied to dist/runtime");
