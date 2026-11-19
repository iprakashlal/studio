// The Studio's opening: its logo gathers out of falling sand over a blurred Projects screen, rests a moment, then
// blows away as powder while the blur lifts. Plays once per load, never blocks the page (a click or key hurries it),
// and is skipped for people who ask their device for less motion.

import { useEffect, useRef, useState } from "react";
import { brand } from "../lib/brand";
import { MARK_URI } from "./logo";

let played = false;
const N = 96, IN = 1250, HOLD = 650, OUT = 1550;
const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function SandIntro() {
  const [on, setOn] = useState(() => { try { return !played && !matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } });
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!on) return; played = true;
    const b = brand(), im = new Image(); let raf = 0, dead = false, speed = 1;
    const hurry = () => { speed = 3.5; };
    addEventListener("pointerdown", hurry, true); addEventListener("keydown", hurry, true);
    const end = () => { if (!dead) { dead = true; setOn(false); } };
    im.onerror = end;
    im.onload = () => {
      const c = cv.current, box = wrap.current; if (!c || !box || dead) return end();
      const x = c.getContext("2d"); if (!x) return end();
      // the logo as grains: one for each cell of an N × N reading of it that isn't see-through
      const s = document.createElement("canvas"); s.width = s.height = N; const sx = s.getContext("2d", { willReadFrequently: true }); if (!sx) return end();
      const fit = Math.min(N / im.width, N / im.height) || 1, iw = im.width * fit, ih = im.height * fit; sx.drawImage(im, (N - iw) / 2, (N - ih) / 2, iw, ih);
      let px: Uint8ClampedArray; try { px = sx.getImageData(0, 0, N, N).data; } catch { return end(); }
      const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight; c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      const S = Math.round(Math.min(230, W * 0.5, H * 0.4)), g = S / N, ox = (W - S) / 2, oy = (H - S) / 2 - 18;
      type G = { tx: number; ty: number; fx: number; fy: number; col: string; a: number; dIn: number; base: number; rel: number; wx: number; wy: number; ph: number };
      const P: G[] = []; const rnd = Math.random;
      for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) {
        const i = (r * N + q) * 4, a = px[i + 3]; if (a < 40) continue;
        const base = (q / N) * 0.6;
        P.push({ tx: ox + q * g, ty: oy + r * g, fx: ox + q * g + (rnd() - 0.5) * S * 1.5, fy: oy - S * (0.5 + rnd() * 1.2), col: `rgb(${px[i]},${px[i + 1]},${px[i + 2]})`, a: a / 255,
          dIn: (1 - r / N) * 0.6 + rnd() * 0.4, base, rel: base + rnd() * 0.12, wx: 150 + rnd() * 240, wy: -70 + rnd() * 110, ph: rnd() * 6.283 });
      }
      if (!P.length) return end();
      // the true logo, wiped away from the left as its grains lift off
      const lg = document.createElement("canvas"); lg.width = lg.height = Math.round(S * dpr); const lx = lg.getContext("2d")!;
      const name = b.name || "", ink = getComputedStyle(document.body).color || "#fff", font = `800 19px ${getComputedStyle(document.body).fontFamily || "sans-serif"}`;
      const gs = Math.max(1, g) + 0.35; let t = 0, last = performance.now();
      const frame = (now: number) => {
        if (dead) return; t += Math.min(50, now - last) * speed; last = now;
        if (t >= IN + HOLD + OUT) return end();
        x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
        const u = (t - IN - HOLD) / OUT;
        if (t < IN) {
          const k = t / IN;
          for (const p of P) { const q = clamp((k - p.dIn * 0.45) / 0.55); if (q <= 0) continue; const e = 1 - Math.pow(1 - q, 3), sway = Math.sin(p.ph + q * 7) * 9 * (1 - e);
            x.globalAlpha = p.a * Math.min(1, q * 2.2); x.fillStyle = p.col; x.fillRect(p.fx + (p.tx - p.fx) * e + sway, p.fy + (p.ty - p.fy) * e, gs, gs); }
          const ia = clamp((k - 0.78) / 0.22); if (ia > 0) { x.globalAlpha = ia; x.drawImage(im, ox + (S - iw * g) / 2, oy + (S - ih * g) / 2, iw * g, ih * g); }
        } else if (u <= 0) { x.globalAlpha = 1; x.drawImage(im, ox + (S - iw * g) / 2, oy + (S - ih * g) / 2, iw * g, ih * g); }
        else {
          const front = (u / 0.6) * S, fe = 0.2 * S;
          if (front - fe < S) { // what the wind hasn't reached yet
            lx.setTransform(dpr, 0, 0, dpr, 0, 0); lx.globalCompositeOperation = "source-over"; lx.clearRect(0, 0, S, S); lx.drawImage(im, (S - iw * g) / 2, (S - ih * g) / 2, iw * g, ih * g);
            lx.globalCompositeOperation = "destination-out"; const gr = lx.createLinearGradient(front - fe, 0, front, 0); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)"); lx.fillStyle = gr; lx.fillRect(-1, 0, front + 1, S);
            x.globalAlpha = 1; x.drawImage(lg, ox, oy, S, S);
          }
          for (const p of P) {
            if (u < p.base) continue; // still part of the picture
            const tt = u - p.rel;
            if (tt <= 0) { x.globalAlpha = p.a; x.fillStyle = p.col; x.fillRect(p.tx, p.ty, gs, gs); continue; }
            const al = 1 - tt / 0.55; if (al <= 0) continue; const sec = (tt * OUT) / 1000;
            x.globalAlpha = p.a * al; x.fillStyle = p.col; const z = gs * (0.55 + 0.45 * al);
            x.fillRect(p.tx + p.wx * sec * (1 + sec * 0.9) + Math.sin(p.ph + sec * 5) * 7, p.ty + p.wy * sec + 95 * sec * sec + Math.cos(p.ph + sec * 4) * 6, z, z);
          }
        }
        if (name) { x.globalAlpha = (t < IN ? clamp((t / IN - 0.7) / 0.3) : 1) * (u > 0 ? clamp(1 - u * 2.6) : 1); x.fillStyle = ink; x.font = font; x.textAlign = "center"; x.textBaseline = "top"; x.fillText(name, W / 2, oy + S + 22, W - 40); }
        box.style.opacity = String(u > 0.5 ? clamp(1 - (u - 0.5) / 0.5) : 1);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };
    im.src = b.logo || MARK_URI;
    return () => { dead = true; cancelAnimationFrame(raf); removeEventListener("pointerdown", hurry, true); removeEventListener("keydown", hurry, true); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!on) return null;
  return <div ref={wrap} aria-hidden="true" data-sand-intro className="pointer-events-none fixed inset-0 z-[95] bg-ink-950/55" style={{ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}><canvas ref={cv} className="block h-full w-full" /></div>;
}
