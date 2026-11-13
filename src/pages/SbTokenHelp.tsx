// Which permissions to tick on Supabase's "Generate token" page (scoped access tokens).
import { Fragment } from "react";
import { SB_TOKEN_SCOPES } from "../lib/supamgmt";

export function SbTokenHelp() {
  return (
    <details className="rounded-lg border border-ink-700 px-3 py-2 text-[12.5px] text-ink-300">
      <summary className="cursor-pointer font-semibold text-ink-200">What to choose on Supabase's token page</summary>
      <p className="mt-1.5 text-ink-400">Name it (e.g. “Picaffectz Studio”), pick an expiry, then set these and press Review access → Generate. Leave everything else at No access.</p>
      <dl className="mt-1.5 grid gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]">
        {SB_TOKEN_SCOPES.map(([k, v]) => <Fragment key={k}><dt className="font-semibold text-ink-200">{k}</dt><dd>{v}</dd></Fragment>)}
      </dl>
      <p className="mt-1.5 text-ink-400">Or use <b>Create legacy token</b> (full access to your account): simpler, but broader.</p>
    </details>
  );
}
