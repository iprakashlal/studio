// Translating a site into a language, as a job that runs outside the editor's screens: it keeps going when the
// Languages section is closed, and one language is done at a time (others wait in line).
// The job never gives up on a text because a call failed: failed calls are tried again in smaller batches with a
// pause in between, and if the translator can't be reached at all the job stops and says why, leaving those texts
// "Not translated" (never silently in the site's own language).
import { cfTranslate, signedInApi } from "./cfdb";

export type JobState = {
  running: boolean; lang: string; name: string;
  /** Texts in this run, how many are finished, and what the job is doing now. */
  total: number; done: number; phase: string;
  /** Languages waiting their turn. */
  queue: string[];
  /** How the last run ended, per language. */
  last: Record<string, { ok: boolean; text: string }>;
};
export type JobAsk = { root: any; lang: string; name: string; from: string; again: boolean; texts: () => string[]; bump: () => void };

const norm = (s: string) => String(s).replace(/\s+/g, " ").trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let state: JobState = { running: false, lang: "", name: "", total: 0, done: 0, phase: "", queue: [], last: {} };
const subs = new Set<() => void>(); const waiting: JobAsk[] = [];
const set = (p: Partial<JobState>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
export const jobState = () => state;
export const onJob = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/** Latin-script text that should have come back in another script. */
const latinShare = (s: string) => (s.match(/[A-Za-z]/g) || []).length / Math.max(1, (s.match(/\p{L}/gu) || []).length);
/** A "translation" that is just the original again: a sentence the translator left alone. */
export const untouched = (src: string, out: string, lang: string) => lang !== "en" && norm(src) === norm(out) && src.trim().split(/\s+/).length >= 2 && latinShare(src) > 0.6;
/** The texts a run should send: everything without a translation, and sentences that were left in the site's own language. */
export function pending(root: any, lang: string, texts: string[], again: boolean): string[] {
  const d = root?.i18n?.t?.[lang] || {};
  return [...new Set(texts)].filter((s) => { if (!norm(s) || !/\p{L}/u.test(s)) return false; if (again) return true; const v = String(d[s] ?? d[norm(s)] ?? ""); return !v.trim() || untouched(s, v, lang); });
}
const fatal = (m: string) => /updated once|Sign in|Only members|Workers AI|allowance|isn't signed in/i.test(m);

async function run(a: JobAsk) {
  const say = (ok: boolean, text: string) => set({ last: { ...state.last, [a.lang]: { ok, text } } });
  set({ running: true, lang: a.lang, name: a.name, total: 0, done: 0, phase: "Getting ready" });
  try {
    const api = await signedInApi();
    if (!api) throw new Error("Translating is done by your Cloudflare database, and this device isn't signed in to one. You can still type each translation in.");
    const d: Record<string, string> = (((a.root.i18n ||= {}).t ||= {})[a.lang] ||= {});
    let todo = pending(a.root, a.lang, a.texts(), a.again);
    if (!todo.length) { say(true, `Everything is already translated into ${a.name}.`); return; }
    const total = todo.length; let done = 0, lastErr = ""; const sameTwice = new Map<string, number>();
    set({ total, done: 0, phase: `Translating into ${a.name}` });
    // Rounds: big batches first, then smaller ones for whatever is left; a pause before a round that follows failures.
    const ROUNDS: [size: number, lanes: number, wait: number][] = [[10, 4, 0], [5, 3, 1500], [2, 3, 4000], [1, 2, 8000], [1, 1, 15000], [1, 1, 30000]];
    for (const [r, [size, lanes, wait]] of ROUNDS.entries()) {
      if (!todo.length) break;
      if (r > 0) { set({ phase: `Translating into ${a.name}: ${todo.length} left, trying again` }); if (lastErr) await sleep(wait); }
      const parts: string[][] = []; for (let i = 0; i < todo.length; i += size) parts.push(todo.slice(i, i + size));
      const missed: string[] = []; let next = 0, failedCalls = 0; lastErr = "";
      const lane = async () => {
        for (;;) {
          const part = parts[next++]; if (!part) return;
          let out: (string | null)[] = [];
          try { out = await cfTranslate(api, { to: a.name, from: a.from, texts: part }); }
          catch (e: any) { const m = String(e?.message || e); if (fatal(m)) throw e; lastErr = m; failedCalls++; }
          part.forEach((s, k) => {
            const v = out[k];
            if (v && v.trim()) {
              // The same sentence back: ask once more on its own; if the translator insists, that is its answer (a name, a code).
              if (untouched(s, v, a.lang) && (sameTwice.get(s) || 0) < 1) { sameTwice.set(s, (sameTwice.get(s) || 0) + 1); missed.push(s); return; }
              d[s] = v; done++;
            } else missed.push(s);
          });
          set({ done }); a.bump();
        }
      };
      await Promise.all(Array.from({ length: Math.min(lanes, parts.length) }, lane));
      todo = missed;
      // Every call of a round failing means the translator can't be reached right now: don't burn through the rounds.
      if (failedCalls && failedCalls === parts.length && r >= 2) break;
    }
    a.bump();
    if (!todo.length) say(true, `${done} text${done === 1 ? "" : "s"} translated into ${a.name}. Read them through: a machine translation is a first draft.`);
    else say(false, `${done} of ${total} texts translated into ${a.name}. ${todo.length} could not be translated${lastErr ? ` (${lastErr.replace(/\.$/, "")})` : ""}. They are listed under “Not translated”: press Translate what's missing to try again, or type them in.`);
  } catch (e: any) {
    const m = String(e?.message || e);
    say(false, /Unknown scope|Not found/i.test(m) ? "Translating needs the database updated once (Settings → Hostings → Update the database). You can still type each translation in." : m || "Translating didn't work. Try again.");
  } finally { a.bump(); }
}
/** Starts translating a language, or puts it in line behind the one being done. */
export function translateInBackground(a: JobAsk) {
  if ((state.running && state.lang === a.lang) || waiting.some((w) => w.lang === a.lang)) return;
  waiting.push(a); set({ queue: waiting.map((w) => w.lang) });
  if (state.running) return;
  (async () => {
    for (;;) { const nextUp = waiting.shift(); set({ queue: waiting.map((w) => w.lang) }); if (!nextUp) break; await run(nextUp); }
    set({ running: false, phase: "" });
  })();
}
