// Which engine does the Studio's "AI" work (translating, reading a pamphlet or menu, writing text):
//   cloudflare: Workers AI on the Studio's Cloudflare database (a free daily allowance, shared by everything);
//   system:     the Picaffectz system, built into the Studio. It runs on this device: no account, no allowance.
// The choice is the Studio's (studio.json → ai.engine); a site's own admin page keeps it with the site (i18n.engine).
export type AiEngine = "cloudflare" | "system" | "custom";
export const AI_ENGINES: { id: AiEngine; name: string; line: string }[] = [
  { id: "cloudflare", name: "Cloudflare AI", line: "Runs on your Cloudflare database. Needs a sign-in, and stops for the day when the free allowance is used up." },
  { id: "system", name: "Picaffectz system", line: "Built into the Studio and runs on this device. No account, no allowance, nothing leaves the device." },
  { id: "custom", name: "Your own AI API", line: "Any OpenAI-compatible API (OpenAI, OpenRouter, Groq, Gemini, a model you host). Your key stays on your Cloudflare database; that provider bills you." },
];
export const engineName = (e: AiEngine) => AI_ENGINES.find((x) => x.id === e)!.name;
export const cleanEngine = (v: unknown): AiEngine => (v === "system" || v === "custom" ? v : "cloudflare");

let engine: AiEngine = "cloudflare";
const subs = new Set<() => void>();
export const aiEngine = () => engine;
export const setAiEngine = (e: unknown) => { const n = cleanEngine(e); if (n !== engine) { engine = n; subs.forEach((f) => f()); } };
export const onAiEngine = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
/** Cloudflare's "the free allowance is used up" (and the like): the moment to offer the Picaffectz system. */
export const allowanceGone = (m: unknown) => /allowance|neuron|quota|\b429\b|capacity/i.test(String(m || ""));
