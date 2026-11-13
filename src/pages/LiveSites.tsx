// Live sites: every place a project is published (Netlify or Cloudflare, and/or GitHub), when each last changed, whether it
// matches the Studio's copy, and a button to pull its content into the project.
import { useEffect, useState } from "react";
import type { Session } from "../lib/auth";
import { GitHubRepo, explain, type Repo } from "../lib/repo";
import { siteAddress , hostRepo } from "../lib/hosting";
import { changedSections, sameContent, type ProjectMeta, type Studio, type StudioIndex } from "../lib/studio";
import { fmtDate, merge, timeAgo } from "../lib/util";
import { Modal, Spinner, useConfirm, useToast } from "../ui/kit";
import { TEMPLATES } from "../schema";

type Site = { key: string; kind: "hosted" | "github"; name: string; url: string; where: string; repo: Repo; primary: boolean };
type Info = { state: "loading" } | { state: "error"; msg: string } | { state: "empty" }
  | { state: "ok"; at: string | null; same: boolean; sections: string[]; content: any };

export function liveSitesOf(p: ProjectMeta, token: string): Site[] {
  const out: Site[] = [];
  if (p.host) out.push({ key: "hosted", kind: "hosted", name: p.host.kind === "cloudflare" ? "Cloudflare" : "Netlify", url: siteAddress(p.host), where: p.host.cf ? "content in Cloudflare" : "content in Supabase", repo: hostRepo(p.host), primary: true });
  if (p.publish) {
    const t = p.publish;
    out.push({ key: "github", kind: "github", name: "GitHub", url: `https://${t.owner}.github.io/${t.repo === `${t.owner}.github.io` ? "" : t.repo + "/"}`, where: `${t.owner}/${t.repo}`, repo: new GitHubRepo(t, token), primary: !p.host });
  }
  return out;
}

const LABELS: Record<string, string> = { hero: "Hero", about: "About", work: "Work", projects: "Projects", learning: "Learning", contact: "Contact", footer: "Footer", theme: "Design", brand: "Brand", seo: "Title & metadata", cms: "Admin page", products: "Products", catalog: "Catalogue", pages: "Pages", checkout: "Checkout", payments: "Payments", backend: "Shop backend", nav: "Menu", sections: "Sections", skills: "Skills" };
const label = (k: string) => LABELS[k] || k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

/** current: what the editor holds (template defaults filled in); live content gets the same defaults before comparing. */
export function LiveSitesDialog({ studio, project, session, dirty, current, defaults, onIndex, onImported, onClose }: { studio: Studio; project: ProjectMeta; session: Session; dirty: boolean; current: any; defaults: any; onIndex: (i: StudioIndex) => void; onImported: (c: any) => void; onClose: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const sites = liveSitesOf(project, session.token);
  const [info, setInfo] = useState<Record<string, Info>>({});
  const [busy, setBusy] = useState("");
  const [n, setN] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      const mine = current;
      await Promise.all(sites.map(async (s) => {
        setInfo((m) => ({ ...m, [s.key]: { state: "loading" } }));
        try {
          const f = await s.repo.getJSON("content.json");
          const at = f ? await s.repo.lastChange("content.json").catch(() => null) : null;
          // The live copy gets the same defaults and upgrades the editor applies (e.g. an older Hero photo moving to the disc).
          const norm = f ? merge(defaults || {}, JSON.parse(JSON.stringify(f.data))) : null;
          if (norm) TEMPLATES[project.template]?.prepare?.(norm);
          const v: Info = !f ? { state: "empty" } : { state: "ok", at, same: sameContent(mine, norm), sections: changedSections(mine, norm), content: f.data };
          if (live) setInfo((m) => ({ ...m, [s.key]: v }));
        } catch (e) { if (live) setInfo((m) => ({ ...m, [s.key]: { state: "error", msg: explain(e) } })); }
      }));
    })();
    return () => { live = false; };
  }, [n]);

  const pull = async (s: Site) => {
    const msg = `The project's content is replaced with what's live on ${s.name} now${s.primary ? ", including edits made in its own admin page" : ""}.${dirty ? " Your unsaved edits are lost." : ""}`;
    if (!(await confirm(`Pull from ${s.name}?`, msg, "Pull", dirty))) return;
    setBusy(s.key);
    try {
      const r = await studio.importFromSite(project.id, s.repo, s.primary);
      let missing = 0;
      // Photos of a secondary copy aren't reachable from the Studio later, so keep copies of the ones it lacks.
      if (!s.primary) missing = await studio.copyMissingAssets(project.id, r.content, s.repo);
      onIndex(r.index);
      onImported(r.content);
      toast(`Pulled from ${s.name}.${missing ? ` ${missing} photo(s) weren't found.` : ""}${!s.primary && project.host ? ` Publish to ${project.host.kind === "cloudflare" ? "Cloudflare" : "Netlify"} to make it live there.` : ""}`);
      setN((x) => x + 1);
    } catch (e) { toast(explain(e), "bad"); }
    setBusy("");
  };

  return (
    <Modal title="Live sites" wide onClose={onClose} footer={<><button className="btn" onClick={() => setN((x) => x + 1)}>Refresh</button><button className="btn btn-pri" onClick={onClose}>Done</button></>}>
      {!sites.length ? <p className="text-sm text-ink-300">This project isn't published yet. Publish to GitHub or Host to External Services, or link an existing site in Project details.</p> : (
        <>
          <p className="text-sm text-ink-300">Compares each live site's content with what's in the editor{dirty ? ", including your unsaved edits" : ""}. Pulling replaces the project's content with that site's.</p>
          {sites.map((s) => {
            const i = info[s.key];
            return (
              <section key={s.key} className="flex flex-col gap-2 rounded-xl border border-ink-700 bg-ink-950 p-4" aria-label={`${s.name} site`}>
                <div className="flex flex-wrap items-center gap-2">
                  <b>{s.name}</b>
                  <span className={`chip ${s.primary ? "border-emerald-400/60 text-emerald-200" : "border-ink-500 text-ink-300"}`}>{s.primary ? "Kept in step" : "Copy"}</span>
                  <a className="ml-auto text-sm text-brand-300 underline" href={s.url} target="_blank" rel="noopener">{s.url} ↗</a>
                </div>
                <span className="text-xs text-ink-400">{s.where}{s.primary ? " · edits made in its admin page come into the project automatically" : " · not checked automatically"}</span>
                {!i || i.state === "loading" ? <Spinner label="Checking…" />
                  : i.state === "error" ? <p className="text-[13px] text-amber-200">Couldn't check: {i.msg}</p>
                  : i.state === "empty" ? <p className="text-[13px] text-ink-300">No content published there yet.</p>
                  : (
                    <>
                      <p className="text-[13px]">
                        <span className="text-ink-300">Last updated </span>
                        <b title={i.at ? fmtDate(i.at) : ""}>{i.at ? `${timeAgo(i.at)} (${fmtDate(i.at)})` : "unknown"}</b>
                      </p>
                      {i.same
                        ? <p className="flex items-center gap-2 text-[13px] text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-400" />Same as the editor</p>
                        : <p className="flex flex-wrap items-center gap-2 text-[13px] text-amber-100"><span className="h-2 w-2 rounded-full bg-amber-400" />Different from the editor{i.sections.length ? ` in: ${i.sections.map(label).join(", ")}` : ""}</p>}
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn btn-sm" disabled={!!busy || i.same} onClick={() => pull(s)}>{busy === s.key ? "Pulling…" : `Pull from ${s.name}`}</button>
                      </div>
                    </>
                  )}
              </section>
            );
          })}
        </>
      )}
    </Modal>
  );
}
