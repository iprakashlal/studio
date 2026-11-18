// Reading the words in a picture on this device (Tesseract, bundled with the Studio under runtime/tess/).
// Nothing is fetched from another site and nothing is uploaded. English print reads best; photos should be
// straight and sharp.
const base = () => new URL("runtime/tess/", location.href).href;

type Worker = { recognize: (img: string | Blob) => Promise<{ data: { text: string; confidence: number } }>; terminate: () => Promise<unknown> };
let worker: Promise<Worker> | null = null;

/** Starts the reader once (about 7 MB from the Studio's own files the first time, then cached by the browser). */
function start(step?: (s: string) => void): Promise<Worker> {
  return (worker ||= (async () => {
    const T: any = await import("tesseract.js");
    const create = T.createWorker || T.default?.createWorker;
    return (await create("eng", 1, {
      workerPath: base() + "worker.min.js", corePath: base(), langPath: base(), gzip: true, workerBlobURL: false,
      logger: (m: any) => { if (step && m?.status) step(/recogni/i.test(m.status) ? `Reading the picture: ${Math.round((m.progress || 0) * 100)}%` : "Starting the reader"); },
    })) as Worker;
  })().catch((e) => { worker = null; throw new Error("The on-device reader couldn't start (" + String(e?.message || e).slice(0, 120) + "). Reload the Studio and try again."); }));
}

/** The text of a picture (a data: address or a file), line by line as printed. */
export async function readPicture(img: string | Blob, step?: (s: string) => void): Promise<{ text: string; sure: number }> {
  const w = await start(step);
  const r = await w.recognize(img);
  return { text: String(r?.data?.text || "").replace(/[ \t]+\n/g, "\n").trim(), sure: Math.round(r?.data?.confidence || 0) };
}
/** Frees the reader's memory (it starts again when next needed). */
export async function stopReader() { const w = worker; worker = null; try { await (await w)?.terminate(); } catch { /* already gone */ } }
