import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TemplateDef } from "../schema/types";

// The template pages run in an iframe named "cms-preview". They announce themselves with
// { type: "cms:ready", page } and render whatever { type: "cms:content" } we send back.

const DEVICES = [
  { id: "desktop", label: "Desktop", w: 1280 },
  { id: "tablet", label: "Tablet", w: 820 },
  { id: "phone", label: "Phone", w: 390 },
] as const;

export function Preview({ tpl, base, content, version, assets }: { tpl: TemplateDef; base: string; content: any; version: number; assets: Record<string, string> }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<(typeof DEVICES)[number]["id"]>("desktop");
  const [page, setPage] = useState(tpl.pages[0].file);
  const [src, setSrc] = useState(base + tpl.pages[0].file);
  const [size, setSize] = useState({ w: 600, h: 600 });
  const latest = useRef({ content, assets });
  latest.current = { content, assets };

  const send = () => {
    const w = frame.current?.contentWindow;
    if (w) w.postMessage({ type: "cms:content", content: latest.current.content, assets: latest.current.assets }, location.origin);
  };

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === "cms:ready") {
        if (e.data.page) setPage(e.data.page);
        send();
      }
    };
    addEventListener("message", on);
    return () => removeEventListener("message", on);
  }, []);

  useEffect(() => {
    const t = setTimeout(send, 120);
    return () => clearTimeout(t);
  }, [version, assets]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dw = DEVICES.find((d) => d.id === device)!.w;
  const scale = Math.min(1, (size.w - 24) / dw);
  const go = (file: string) => {
    setPage(file);
    setSrc(base + file + (src.endsWith(file) ? `?r=${Date.now()}` : ""));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-ink-950">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 px-3 py-2">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-400">Live preview</span>
        {tpl.pages.length > 1 && (
          <select aria-label="Preview page" className="input w-auto py-1.5 text-[13px]" value={page} onChange={(e) => go(e.target.value)}>
            {tpl.pages.map((p) => <option key={p.file} value={p.file}>{p.label}</option>)}
          </select>
        )}
        <div className="ml-auto flex gap-1" role="group" aria-label="Device size">
          {DEVICES.map((d) => (
            <button key={d.id} type="button" aria-pressed={device === d.id} onClick={() => setDevice(d.id)} className={`btn btn-sm ${device === d.id ? "border-brand-500 text-brand-300" : ""}`}>{d.label}</button>
          ))}
          <button type="button" className="btn btn-sm" title="Reload preview" aria-label="Reload preview" onClick={() => go(page)}>↻</button>
        </div>
      </div>
      <div ref={box} className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute left-1/2 top-3 origin-top overflow-hidden rounded-lg border border-ink-700 bg-white shadow-2xl" style={{ width: dw, height: (size.h - 24) / scale, transform: `translateX(-50%) scale(${scale})` }}>
          <iframe ref={frame} name="cms-preview" title="Site preview" src={src} className="h-full w-full border-0" />
        </div>
      </div>
    </div>
  );
}
