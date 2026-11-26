import { SiteDbSignIn, useSiteDbSigned } from "../pages/Connections";
import { RoleManagement } from "../ui/RoleManagement";
import { PinCard } from "../ui/PinSignIn";

// Who can sign in to this site's admin page: the site's members on its Cloudflare database.
export function PeoplePanel({ cf }: { cf?: { api: string; site: string } | null }) {
  const signed = useSiteDbSigned(cf);
  if (!cf) return <section className="card max-w-3xl p-5 text-sm text-ink-300" aria-label="Who can sign in"><h3 className="mb-1 text-[15px] font-extrabold text-ink-100">Who can sign in</h3>This needs the site on its own Cloudflare database. Connect one under Settings → Hostings, then publish.</section>;
  if (!signed) return <section className="card max-w-3xl p-5 text-sm text-ink-300" aria-label="Who can sign in"><h3 className="mb-1 text-[15px] font-extrabold text-ink-100">Who can sign in</h3><p className="mb-3">Sign in to this site's database to see and change who can sign in.</p><SiteDbSignIn cf={cf} /></section>;
  return <div className="flex max-w-5xl flex-col gap-4"><p className="text-sm text-ink-300">Who can sign in to this admin page (with an emailed 6-digit code, or Sign in with Google if it's on), the role each person has, and what each role may do.</p><RoleManagement api={cf.api} scopeName={"site:" + cf.site} where="site" /><PinCard api={cf.api} what="this site's admin page" /></div>;
}
