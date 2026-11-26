// Copies the shared runtime files (src/fx/*.js) into every template's assets/ folder,
// so the live preview and exported sites load them as assets/fx.js and assets/motifs.js.
import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const files = ["fx.js", "motifs.js", "layouts.js", "warranty.js", "slides.js", "pages.js", "maint.js", "addons.js", "festival.js", "consent.js", "menu.js", "lang.js", "video.js", "wall.js", "social.js", "acct.js"];
const root = "public/templates";
for (const t of readdirSync(root)) {
  if (!statSync(join(root, t)).isDirectory()) continue;
  mkdirSync(join(root, t, "assets"), { recursive: true });
  for (const f of files) copyFileSync(join("src/fx", f), join(root, t, "assets", f));
}
// The shop and the restaurant need the invoice.
copyFileSync("src/fx/invoice.js", join(root, "store", "assets", "invoice.js"));
copyFileSync("src/fx/invoice.js", join(root, "restaurant", "assets", "invoice.js"));
console.log("fx.js and motifs.js synced to templates");
