// Copies pdf.js (used by "Import from LinkedIn" to read profile PDFs) next to the site CMS.
// The Studio loads it from runtime/, and exported portfolio sites carry it in cms/.
import { copyFileSync, mkdirSync } from "node:fs";
const src = "node_modules/pdfjs-dist/legacy/build/";
mkdirSync("dist/runtime", { recursive: true });
for (const f of ["pdf.min", "pdf.worker.min"]) copyFileSync(src + f + ".mjs", "dist/runtime/" + f + ".js");
console.log("pdf.js copied to dist/runtime");
