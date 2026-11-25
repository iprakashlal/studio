// Every page and project carries the Picaffectz notice as an HTML comment right after the doctype (view-source shows it).
// Run by hand to stamp the sources (idempotent); the build also runs it on dist, so a new template page gets it too.
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const NOTICE = `<!-- Powered by Picaffectz | https://www.picaffectz.com -->
<!--
  Copyright (c) Picaffectz. All rights reserved.
  This source code is proprietary and confidential. Unauthorized copying or distribution is prohibited.
-->`;
export function stamp(path) {
  const s = readFileSync(path, "utf8");
  if (s.includes("Powered by Picaffectz")) return false;
  const m = /<!doctype html>\s*/i.exec(s);
  const out = m ? s.slice(0, m.index + m[0].length).replace(/\s*$/, "\n") + NOTICE + "\n" + s.slice(m.index + m[0].length) : NOTICE + "\n" + s;
  writeFileSync(path, out); return true;
}
export function stampTree(base) {
  let n = 0; if (!existsSync(base)) return 0;
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f), st = statSync(p); if (st.isDirectory()) { if (!/node_modules|supabase|starters|runtime/.test(f)) walk(p); } else if (f.endsWith(".html") && stamp(p)) n++; } };
  walk(base); return n;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  let n = stampTree("public"); for (const f of ["index.html"]) if (stamp(f)) n++;
  console.log(`stamped ${n} source pages`);
}
