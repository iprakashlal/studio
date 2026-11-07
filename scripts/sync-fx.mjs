// Copies the shared interaction engine (src/fx/fx.js) into every template's assets/ folder,
// so the live preview and exported sites load it as assets/fx.js.
import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const src = "src/fx/fx.js";
const root = "public/templates";
for (const t of readdirSync(root)) {
  if (!statSync(join(root, t)).isDirectory()) continue;
  mkdirSync(join(root, t, "assets"), { recursive: true });
  copyFileSync(src, join(root, t, "assets", "fx.js"));
}
console.log("fx.js synced to templates");
