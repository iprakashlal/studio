// Copies pdf.js (used by "Import from LinkedIn" to read profile PDFs) next to the site CMS.
// The Studio loads it from runtime/, and exported portfolio sites carry it in cms/.
import { copyFileSync, mkdirSync } from "node:fs";
const src = "node_modules/pdfjs-dist/legacy/build/";
mkdirSync("dist/runtime", { recursive: true });
for (const f of ["pdf.min", "pdf.worker.min"]) copyFileSync(src + f + ".mjs", "dist/runtime/" + f + ".js");
// onnxruntime-web (MIT), for finding and cutting out product photos (src/lib/saliency.ts). WebAssembly only.
mkdirSync("dist/runtime/ort", { recursive: true });
for (const f of ["ort.wasm.min.mjs", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) copyFileSync("node_modules/onnxruntime-web/dist/" + f, "dist/runtime/ort/" + f);
// Tesseract (Apache 2.0), the Picaffectz system's on-device reader for photos of pamphlets and menus (src/lib/ocr.ts).
// Its worker, its WebAssembly cores and the English data are served by the Studio itself: nothing is fetched elsewhere.
mkdirSync("dist/runtime/tess", { recursive: true });
copyFileSync("node_modules/tesseract.js/dist/worker.min.js", "dist/runtime/tess/worker.min.js");
for (const f of ["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"]) copyFileSync("node_modules/tesseract.js-core/" + f, "dist/runtime/tess/" + f);
copyFileSync("node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "dist/runtime/tess/eng.traineddata.gz");
console.log("pdf.js, onnxruntime-web and the on-device reader copied to dist/runtime");
