import { SiteDbSignIn, useSiteDbSigned } from "../pages/Connections";
import { PeopleCard } from "../ui/People";

// Who can sign in to this site's admin page: the site's members on its Cloudflare database.
export function PeoplePanel({ cf }: { cf?: { api: string; site: string } | null }) {
  const signed = useSiteDbSigned(cf);
  if (!cf) return <section className="card max-w-3xl p-5 text-sm text-ink-300" aria-label="Who can sign in"><h3 className="mb-1 text-[15px] font-extrabold text-ink-100">Who can sign in</h3>This needs the site on its own Cloudflare database. Connect one under Settings → Hostings, then publish.</section>;
  if (!signed) return <section className="card max-w-3xl p-5 text-sm text-ink-300" aria-label="Who can sign in"><h3 className="mb-1 text-[15px] font-extrabold text-ink-100">Who can sign in</h3><p className="mb-3">Sign in to this site's database to see and change who can sign in.</p><SiteDbSignIn cf={cf} /></section>;
  return <div className="max-w-3xl"><PeopleCard api={cf.api} scopeName={"site:" + cf.site} what="this site's admin page" label="Who can sign in to this admin page" intro={<>Only these email addresses can open this admin page, with an emailed 6-digit code (or Sign in with Google, if it's on under Settings). <b>Owners</b> can change everything, including these people; <b>members</b> can edit the site's content.</>} /></div>;
}
