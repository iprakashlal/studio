// CI helpers for the moved Studio (run by .github/workflows/deploy.yml after `npm run build`):
//   share   GitHub Pages uses the moved Studio's database: copies its studio.config.json (public, no secrets:
//           the database address and Studio ID) into dist/, so both Studios show the same projects.
//   deploy  Puts this build on the moved Studio's Cloudflare Worker, keeping its studio.config.json. Only the app
//           files change; projects live in the database and aren't touched. Needs CLOUDFLARE_API_TOKEN.
// Which Studio: studio.share.json { "studio": "https://studio.example.com/" } in the repository.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { Cloudflare } from "../src/lib/cloudflare";

const cmd = process.argv[2];
const share = existsSync("studio.share.json") ? JSON.parse(readFileSync("studio.share.json", "utf8")) : null;
const STUDIO = String(share?.studio || "").replace(/\/?$/, "/");
if (!share?.studio) { console.log("No studio.share.json: nothing to do."); process.exit(0); }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function liveConfig() {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(STUDIO + "studio.config.json?x=" + Date.now(), { cache: "no-store" } as any);
      const j: any = r.ok ? await r.json() : null;
      if (j && (j.kind === "cloudflare" ? /^https:\/\//.test(j.api) : j.kind === "supabase" && /^https:\/\//.test(j.url)) && j.studio) return j;
      throw new Error(`answered ${r.status}`);
    } catch (e: any) {
      if (i === 4) throw new Error(`Couldn't read ${STUDIO}studio.config.json (${e?.message || e}). Nothing was changed.`);
      await sleep(3000 * (i + 1));
    }
  }
}

if (cmd === "share") {
  const cfg = await liveConfig();
  writeFileSync("dist/studio.config.json", JSON.stringify(cfg, null, 2));
  console.log(`GitHub Pages now uses the projects of Studio "${cfg.studio}" (${cfg.kind === "cloudflare" ? cfg.api : cfg.url}).`);
} else if (cmd === "deploy") {
  const token = process.env.CLOUDFLARE_API_TOKEN || "";
  if (!token) { console.log("::notice::CLOUDFLARE_API_TOKEN isn't set, so the moved Studio wasn't updated by CI (it still updates itself when an owner opens it)."); process.exit(0); }
  const cf = new Cloudflare(null, token, async (q) => {
    const r = await fetch("https://api.cloudflare.com/client/v4" + q.path, { method: q.method, headers: { Authorization: "Bearer " + q.auth, ...(q.contentType ? { "Content-Type": q.contentType } : {}) }, body: q.body64 ? Buffer.from(q.body64, "base64") : q.body });
    return { status: r.status, body: await r.text() };
  });
  // Find the Worker behind the Studio's address: a custom domain, or name.sub.workers.dev.
  const host = new URL(STUDIO).hostname;
  let account = "", name = "";
  for (const a of await cf.accounts()) {
    if (host.endsWith(".workers.dev")) {
      const sub = await cf.subdomain(a.id, "studio").catch(() => "");
      if (sub && host === `${host.split(".")[0]}.${sub}.workers.dev`) { account = a.id; name = host.split(".")[0]; break; }
    } else {
      const d = await (cf as any).api("GET", `/accounts/${a.id}/workers/domains?hostname=${encodeURIComponent(host)}`).catch(() => []);
      const hit = (d || []).find((x: any) => x.hostname === host);
      if (hit) { account = a.id; name = hit.service; break; }
    }
  }
  if (!name) throw new Error(`Couldn't find the Worker serving ${host} with this token (it needs Workers Scripts: Edit and Workers Routes: Edit/Read).`);
  const cfg = await liveConfig();
  const files: { path: string; data: Uint8Array }[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else { const r = relative("dist", p).split("\\").join("/"); if (r !== "studio.config.json" && r !== ".nojekyll") files.push({ path: r, data: readFileSync(p) }); } } };
  walk("dist");
  files.push({ path: "studio.config.json", data: new TextEncoder().encode(JSON.stringify(cfg, null, 2)) });
  const build = JSON.parse(readFileSync("dist/app-files.json", "utf8")).build;
  console.log(`Deploying build ${build} (${files.length} files) to the Worker "${name}" (${host}).`);
  await cf.deploySite(account, name, await cf.subdomain(account, "studio"), files, { spa: true, progress: (d, t) => t && d === t && console.log(`Uploaded ${t} new files.`) });
  // Check it's live (Cloudflare can take a few seconds).
  for (let i = 0; i < 12; i++) {
    const live = await fetch(STUDIO + "app-files.json?x=" + Date.now()).then((r) => (r.ok ? r.json() : null)).catch(() => null) as any;
    if (live?.build === build) { console.log(`${STUDIO} is on build ${build}. Its projects weren't touched.`); process.exit(0); }
    await sleep(5000);
  }
  console.log(`::warning::Deployed, but ${STUDIO} didn't show build ${build} yet. Check it in a minute.`);
} else { console.error("Use: share | deploy"); process.exit(1); }
