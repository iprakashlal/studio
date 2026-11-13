// A Studio outside GitHub keeps its files and sign-in in Supabase or in the Studio's database on Cloudflare.
// Both work the same way to the rest of the Studio: an emailed code to sign in, members per Studio, and a Repo.
import type { Repo } from "./repo";
import type { Session } from "./auth";
import { sbClient, sendCode, signedInEmail, verifyCode } from "./supa";
import { StudioSbRepo, studioRole, type StudioHostCfg } from "./studiohost";
import { CfRepo, cfRole, cfSendCode, cfSession, cfSignedIn, cfVerifyCode } from "./cfdb";

export type Backend = {
  kind: "supabase" | "cloudflare"; label: string;
  sendCode(email: string): Promise<unknown>;
  verifyCode(email: string, code: string): Promise<unknown>;
  signedIn(): Promise<string | null>;
  /** This Studio's role for the signed-in email (owner, member, partner) or null. */
  role(studio?: string): Promise<string | null>;
  signOut(): Promise<void>;
  repo(studio?: string): Repo;
};

export function backendOf(cfg: StudioHostCfg): Backend {
  if (cfg.kind === "cloudflare") {
    const api = cfg.api;
    return {
      kind: "cloudflare", label: "Cloudflare",
      sendCode: (e) => cfSendCode(api, e.trim()), verifyCode: (e, c) => cfVerifyCode(api, e.trim(), c.trim()),
      signedIn: () => cfSignedIn(api), role: (s = cfg.studio) => cfRole(api, "studio:" + s),
      signOut: async () => cfSession.clear(api), repo: (s = cfg.studio) => new CfRepo(api, "studio:" + s),
    };
  }
  return {
    kind: "supabase", label: "Supabase",
    sendCode: (e) => sendCode(cfg, e), verifyCode: (e, c) => verifyCode(cfg, e, c),
    signedIn: () => signedInEmail(cfg), role: (s = cfg.studio) => studioRole({ ...cfg, studio: s }),
    signOut: async () => { await sbClient(cfg).auth.signOut().catch(() => {}); }, repo: (s = cfg.studio) => new StudioSbRepo(cfg, s, sbClient(cfg)),
  };
}

/** Signed in to a Studio that runs outside GitHub (Supabase or Cloudflare). */
export const isHosted = (s: Session) => s.cfg.owner === "supabase" || s.cfg.owner === "cloudflare";
