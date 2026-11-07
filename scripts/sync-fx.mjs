// Copies the shared runtime files (src/fx/*.js) into every template's assets/ folder,
// so the live preview and exported sites load them as assets/fx.js and assets/motifs.js.
import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const files = ["fx.js", "motifs.js"];
const root = "public/templates";
for (const t of readdirSync(root)) {
  if (!statSync(join(root, t)).isDirectory()) continue;
  mkdirSync(join(root, t, "assets"), { recursive: true });
  for (const f of files) copyFileSync(join("src/fx", f), join(root, t, "assets", f));
}
console.log("fx.js and motifs.js synced to templates");
