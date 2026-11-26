import { designHost, engineImage } from "./designapi";
// Default pictures for a website made in "Design yourself": drawn here (no photos, nothing downloaded) in the theme's own
// colours, with a simple symbol that suits the kind of business or the theme type. They stand in until the person adds their own.

type Glyph = { re: RegExp; d: string };
// Each symbol is drawn in a 200 x 200 box (stroke-free shapes, white at 90%).
const G: Glyph[] = [
  // Events come first: their words ("conference", "wedding", "marathon") say more than the trade words below.
  { re: /wedding|engagement|anniversary|bridal|baby shower|reception event/i, d: "M100 165s-62-38-62-84a34 34 0 0 1 62-20 34 34 0 0 1 62 20c0 46-62 84-62 84Z" },
  { re: /concert|gig|music|opera|musical|dance|festival event/i, d: "M80 150a22 22 0 1 1-12-20V50l80-16v90a22 22 0 1 1-12-20V62l-56 11v77Z" },
  { re: /tournament|championship|league|award|competition|hackathon|ideathon/i, d: "M60 40h80v30a40 40 0 0 1-80 0Zm-25 6h25v14H49c1 12 6 20 15 24l-6 12c-16-8-23-24-23-50Zm130 0c0 26-7 42-23 50l-6-12c9-4 14-12 15-24h-11V46ZM92 112h16v24h22v16H70v-16h22Z" },
  { re: /marathon|fun run|cycling race|parade/i, d: "M50 30h12v140H50Zm20 6c30-12 44 12 80 0v62c-36 12-50-12-80 0Z" },
  { re: /conference|summit|seminar|symposium|keynote|lecture|panel|fireside|webinar|town hall|meeting|comedy|open mic|press|briefing|reading|hearing/i, d: "M100 30a22 22 0 0 1 22 22v40a22 22 0 0 1-44 0V52a22 22 0 0 1 22-22Zm-40 60h12a28 28 0 0 0 56 0h12a40 40 0 0 1-34 39.500V152h22v14H72v-14h22v-22.500A40 40 0 0 1 60 90Z" },
  { re: /market|expo|trade show|exhibition|job fair|food fair/i, d: "M100 34 30 96h16v70h108V96h16Zm-18 132v-44h36v44Z" },
  { re: /dent|tooth|orthodon/i, d: "M60 60c0-22 28-26 40-12 12-14 40-10 40 12 0 30-14 40-16 78-1 12-12 12-14 0l-10-30-10 30c-2 12-13 12-14 0-2-38-16-48-16-78Z" },
  { re: /clinic|hospital|health|pharmac|doctor|medic|physio/i, d: "M80 40h40v40h40v40h-40v40H80v-40H40V80h40Z" },
  { re: /cafe|café|coffee|tea|bistro|brew/i, d: "M50 80h90v50a40 40 0 0 1-40 40H90a40 40 0 0 1-40-40Zm90 12h14a20 20 0 0 1 0 40h-14v-10h14a10 10 0 0 0 0-20h-14ZM75 30c-8 10 8 14 0 24m25-24c-8 10 8 14 0 24m25-24c-8 10 8 14 0 24" },
  { re: /bak|cake|dessert|pastr|sweet/i, d: "M45 120h110v40H45Zm10-30h90v22H55Zm20-24h50v20H75Zm25-30c-10 8-4 16 0 20 4-4 10-12 0-20Z" },
  { re: /restaurant|food|kitchen|grill|seafood|indian|italian|asian|vegan|street|dining|catering|cloud|family/i, d: "M60 30v60c0 10 8 16 14 16v64h12v-64c6 0 14-6 14-16V30h-8v50h-6V30h-8v50h-6V30Zm76 0c-18 8-24 34-20 62h16v78h12Z" },
  { re: /hotel|resort|stay|spa|wellness|yoga/i, d: "M30 140V70h14v40h112c0-24-16-30-40-30H84v-14h40c40 0 62 16 62 54v20h-14v-10H44v10Zm34-46a14 14 0 1 1 0-28 14 14 0 0 1 0 28Z" },
  { re: /salon|beauty|barber|hair|boutique|fashion|jewel|model|influencer/i, d: "M100 30l18 50 54 2-43 33 15 52-44-31-44 31 15-52-43-33 54-2Z" },
  { re: /retail|shop|store|product|grocery|electronic|furniture|gift|craft|homemade|candle/i, d: "M50 70h100l10 90H40Zm22 0a28 28 0 0 1 56 0h-12a16 16 0 0 0-32 0Z" },
  { re: /gym|fitness|sport/i, d: "M20 90h14V70h18v60H34v-20H20Zm160 0h-14V70h-18v60h18v-20h14ZM60 94h80v12H60Z" },
  { re: /school|coach|tutor|educat|college|learn|class|trading|finance|account|bank|insur|legal|law|consult/i, d: "M30 60l70-28 70 28-70 28Zm30 46v30c0 10 80 10 80 0v-30l-40 16Zm110-34h10v50h-10Z" },
  { re: /tech|software|it |app|dev|design|agency|studio|youtuber|video|photo|film|media/i, d: "M70 70l-40 30 40 30V70Zm60 0v60l40-30Zm-14-20L84 150h16l32-100Z" },
  { re: /real|estate|construct|build|interior|architect|home/i, d: "M100 30 30 95h20v65h40v-40h20v40h40V95h20Z" },
  { re: /travel|tour|trans|logistic|auto|car/i, d: "M30 110l60-16V40l20-10 6 64 64 24v16l-66-14-6 36 22 14v10l-36-8-36 8v-10l22-14-6-36-64 14Z" },
];
const PERSON = "M100 30a34 34 0 1 1 0 68 34 34 0 0 1 0-68Zm-68 140c0-40 30-60 68-60s68 20 68 60Z";
const SPARK = "M100 25l14 46 46 14-46 14-14 46-14-46-46-14 46-14Z";

/** A picture for `subject` (words such as "Dental clinic" or "Café"), in the colours given. `shape` "person" draws a portrait. */
export function defaultPicture(subject: string, c: { c1: string; c2: string; bg: string }, shape: "scene" | "person" = "scene", ratio = 800 / 640): string {
  const W = 800, H = Math.round(W / ratio), g = shape === "person" ? PERSON : (G.find((x) => x.re.test(subject)) || { d: SPARK }).d, s = Math.min(W, H) / 200 * 0.58;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.c1}"/><stop offset="1" stop-color="${c.c2}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="${c.bg}"/><rect width="${W}" height="${H}" fill="url(#g)" opacity=".88"/><circle cx="${W * 0.78}" cy="${H * 0.24}" r="${H * 0.2}" fill="#fff" opacity=".18"/><circle cx="${W * 0.2}" cy="${H * 0.78}" r="${H * 0.3}" fill="#000" opacity=".12"/><path d="M0 ${H * 0.82}C${W * 0.2} ${H * 0.7} ${W * 0.38} ${H * 0.9} ${W * 0.58} ${H * 0.8}S${W * 0.88} ${H * 0.68} ${W} ${H * 0.76}V${H}H0Z" fill="#fff" opacity=".18"/><g transform="translate(${(W - 200 * s) / 2} ${(H - 200 * s) / 2 - H * 0.03}) scale(${s})" fill="#fff" opacity=".92"><path d="${g}"/></g></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

const STYLE: Record<string, string> = { photo: "professional photograph, natural light, high quality", illustration: "clean modern illustration, vector style", "3d": "soft 3D render, pastel lighting", flat: "flat minimal graphic, simple shapes" };

/** Pictures drawn from words by the free AI Horde (no key, no sign-up, no daily quota: volunteers' computers do the drawing, so anonymous
 *  requests may wait in a queue). Small sizes and few steps keep it quick; the caller fits the result to the page. */
const sleep = (ms: number, sig?: AbortSignal) => new Promise<void>((ok, no) => { const t = setTimeout(ok, ms); sig?.addEventListener("abort", () => { clearTimeout(t); no(new Error("Stopped.")); }); });
const b64Blob = (b: string, type = "image/webp") => { const bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type }); };
export async function generateImages(prompt: string, o: { /** "engine": the Studio's own AI engine draws it (quick), with the free generator as the fallback. */ source?: "horde" | "engine"; style?: string; kind?: "logo" | "photo"; n?: number; signal?: AbortSignal; status?: (t: string) => void } = {}): Promise<Blob[]> {
  const kind = o.kind || "photo", n = Math.max(1, Math.min(4, o.n || 1)), what = prompt.replace(/\s+/g, " ").trim().slice(0, 300);
  if (!what) throw new Error("Describe the picture first.");
  const full = kind === "logo" ? `minimal vector logo mark, ${what}, simple flat icon, centered, plain white background, no text` : `${what}, ${STYLE[o.style || "photo"] || STYLE.photo}, no text, no logo`;
  if (o.source === "engine") {
    const h = await designHost().catch(() => null);
    if (h) {
      o.status?.("Drawing…");
      const res = await Promise.all(Array.from({ length: n }, () => engineImage(h, full)));
      const got = res.filter((x) => x.image).map((x) => b64Blob(x.image!, "image/jpeg"));
      if (got.length) return got;
      // The chosen engine tried and failed: say why, rather than quietly using another generator. Only an engine that cannot draw at all (the Picaffectz system) hands over to the free one.
      const why = res.find((x) => x.error)?.error;
      if (why) throw new Error("The Studio's AI engine couldn't draw this: " + why);
    }
    o.status?.("This Studio's AI engine can't draw pictures; using the free generator…");
  }
  // Anonymous users have no kudos, so a request over the free work budget is refused: it is asked again smaller (size, steps, count) until the Horde accepts it.
  const LV: [number, number, number, number][] = kind === "logo" ? [[384, 384, 12, n], [320, 320, 8, n], [256, 256, 6, Math.min(n, 2)], [256, 256, 5, 1]] : [[512, 384, 12, n], [448, 320, 8, n], [384, 256, 6, Math.min(n, 2)], [320, 256, 5, 1]];
  let lv = 0; const H = { "Content-Type": "application/json", apikey: "0000000000", "Client-Agent": "picaffectz-studio:1:web" };
  const send = async (slow: boolean): Promise<string> => {
    const [w, h, steps, cnt] = LV[lv];
    const r = await fetch("https://aihorde.net/api/v2/generate/async", { method: "POST", headers: H, signal: o.signal, body: JSON.stringify({ prompt: full, params: { width: w, height: h, steps, n: cnt, cfg_scale: 7, sampler_name: "k_euler_a" }, nsfw: false, censor_nsfw: true, r2: false, slow_workers: slow }) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok && /kudos/i.test(String(j.message || "")) && lv < LV.length - 1) { lv++; o.status?.("Making it a little smaller for the free generator…"); return send(slow); }
    if (!r.ok || !j.id) throw new Error(j.message || "The free generator didn't accept the request. Please try again in a moment.");
    return j.id as string;
  };
  o.status?.("Sending…");
  // Quick workers first (usually a few seconds); if none picks it up soon, it is sent again to any worker.
  let id = await send(false), t0 = Date.now(), slowSent = false;
  const stop = (i: string) => fetch(`https://aihorde.net/api/v2/generate/status/${i}`, { method: "DELETE", headers: H }).catch(() => {});
  for (;;) {
    await sleep(1500, o.signal);
    if (Date.now() - t0 > 200_000) { stop(id); throw new Error("The free generator is very busy right now. Please try again in a few minutes."); }
    const c: any = await fetch(`https://aihorde.net/api/v2/generate/check/${id}`, { signal: o.signal }).then((x) => x.json()).catch(() => ({}));
    if (c.faulted) throw new Error("The free generator couldn't draw that. Try other words.");
    if (c.done) break;
    if (!slowSent && !c.processing && Date.now() - t0 > 12_000) { slowSent = true; stop(id); id = await send(true); t0 = Date.now(); }
    o.status?.(c.queue_position ? `In the queue (place ${c.queue_position})…` : "Drawing…");
  }
  const st: any = await fetch(`https://aihorde.net/api/v2/generate/status/${id}`, { signal: o.signal }).then((x) => x.json());
  const out = (st.generations || []).filter((g: any) => g && !g.censored && typeof g.img === "string" && g.img.length > 100).map((g: any) => b64Blob(g.img));
  if (!out.length) throw new Error("Nothing came back (the picture may have been filtered). Try other words.");
  return out;
}
