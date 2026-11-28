// Settings → Help: guided walk-throughs of the Studio, end to end. Each one moves between screens by itself and points at
// the real buttons. A step's target is a CSS selector, "h:Heading" (the card with that heading) or "b:Text" (a button or link); "a || b" takes the first one on screen.
export type GuideStep = { /** Go to this screen first (a # address). */ go?: string; /** Press this first (a CSS selector). */ click?: string; sel?: string; title: string; text: string };
export type Guide = { id: string; title: string; blurb: string; steps: GuideStep[] };

const tab = (k: string) => `a[role=tab][href="#/settings${k ? "/" + k : ""}"]`;
export const GUIDES: Guide[] = [
  {
    id: "project", title: "Create a project, end to end", blurb: "From the first button to a live site: new project, editing, saving, publishing.",
    steps: [
      { go: "#/", title: "Your projects", text: "Every site you make is a card on this dashboard. This tour goes from making one to putting it live." },
      { sel: '[data-tour="new-project"]', title: "1 · Start a project", text: "Press + New project, pick the type (Portfolio, Business, Store or Restaurant), give it a name, choose a theme and press Create." },
      { sel: "article", title: "2 · Your project card", text: "The coloured bar on top is the type's colour. The chip shows its status, and the logo you upload for the project replaces the initials." },
      { sel: '[data-tour="card-actions"]', title: "3 · Open, Quick Setup, Overview", text: "Open edits the site. Quick Setup holds who signs in to the admin page and publishing. Overview shows orders, carts and enquiries. Each turns the card over into a window." },
      { click: 'article a[href^="#/p/"]', sel: 'nav[aria-label="Content categories"]', title: "4 · The menu", text: "Every part of the site is a section here. Advanced setup, just above Settings, holds sign-in people, email, WhatsApp/SMS codes, the backend and payments." },
      { sel: "#menu-search", title: "5 · Find a setting", text: "Type a word like phone, logo or hours and the menu shows where it lives." },
      { sel: '[data-tour="edit"]', title: "6 · Change things", text: "Edit words, photos and choices. Nothing is live yet: you are changing a draft." },
      { sel: '[data-tour="preview"]', title: "7 · See it as you type", text: "The preview shows your changes at once. On a phone, switch between Edit and Preview at the top." },
      { sel: '[data-tour="save"]', title: "8 · Save", text: "Keeps your work safe in the Studio. It does not change the live site." },
      { sel: '[data-tour="tools"]', title: "9 · Publish and host", text: "These buttons export the site or publish it (for example Publish to Cloudflare). The first publish sets up the site's database, its email (Resend key) and the owner's emailed sign-in code." },
      { go: "#/", sel: "article", title: "10 · Back on the dashboard", text: "The card now says what to do next, such as Publish this site. Press it to open Quick Setup on the publish tab." },
      { title: "That's the whole path", text: "New project, edit, save, publish. Replay this any time from Settings → Help." },
    ],
  },
  {
    id: "settings", title: "Studio settings", blurb: "General, Customize, Hostings and Updates: what each one is for.",
    steps: [
      { go: "#/settings", sel: '[role=tablist][aria-label="Settings"]', title: "Settings tabs", text: "General, AI, Customize, Hostings, Updates and Migration. On a phone this is the Settings section drop-down." },
      { sel: "[aria-label=\"Account\"] || h:Account", title: "General · Account", text: "Who you are signed in as, and Sign out. Your choices here (layout, toggles, tour) are saved in the Studio's database, so they follow you to any device." },
      { go: "#/settings/ai", sel: "h:AI engine", title: "AI · AI engine", text: "Connect the AI that writes and translates for you. The key is kept encrypted. The AI choices for Design yourself and for drawing pictures are on this tab too." },
      { go: "#/settings/customize", sel: tab("customize"), title: "Customize", text: "How your Studio and every site's admin look: name and logo, the Powered by badge, extra pages, sign-in email and admin menus." },
      { sel: "h:Admin menus", title: "Customize · Admin menus", text: "Rename, regroup or hide sections of the admin menu. A custom menu you save here wins over the default layout." },
      { go: "#/settings/hostings", sel: "h:Hosting accounts", title: "Hostings · Hosting accounts", text: "Connect GitHub, Netlify and Cloudflare once. Tokens stay encrypted on this device, and one Cloudflare token can also be kept on the Studio's database so other devices need none." },
      { sel: "h:Sites and hosting accounts", title: "Hostings · Sites and hosting accounts", text: "Where each site is hosted and which Cloudflare account it uses. A site on another account takes its own token from inside that project." },
      { go: "#/settings/update", sel: tab("update"), title: "Updates", text: "Push this Studio build to your live sites, and update the Studio itself." },
      { title: "Help", text: "You are here: Settings → Help replays these tours any time." },
    ],
  },
  {
    id: "migration", title: "Migration", blurb: "Move the Studio's app and database to Cloudflare or Netlify and Supabase.",
    steps: [
      { go: "#/settings/migration", sel: tab("migration"), title: "Migration", text: "Move this Studio to a host you own, with its data. Your sites keep working while it moves." },
      { sel: "h:This Studio runs on", title: "Where it runs now", text: "The first name is where the Studio app is hosted. The second is its database. Both can be Cloudflare." },
      { sel: "h:1 ·", title: "1 · Where the Studio runs", text: "Choose Cloudflare (free, no traffic limit) or Netlify for the app." },
      { sel: "h:2 ·", title: "2 · Where its files live", text: "Choose the database: Cloudflare D1 or Supabase. This is where projects, members and settings are saved." },
      { sel: "h:3 ·", title: "3 · Your Studio", text: "Confirm your email with a code, then move. Afterwards the Studio opens at its new address." },
      { sel: "h:Studio updates", title: "Updates after moving", text: "A moved Studio updates itself when it opens and a newer build is out. You can also press Update here." },
    ],
  },
  {
    id: "partners", title: "Studio Partners", blurb: "Give a client their own Studio, share sites with it and keep it updated.",
    steps: [
      { go: "#/partners", sel: "h:Studio Partners", title: "Studio Partners", text: "Client Studios you set up and look after. Clients sign in with an emailed code and can edit and publish the sites you share." },
      { sel: "b:+ Add a client Studio || [aria-label=\"Add a client Studio\"]", title: "1 · Add a client Studio", text: "Choose where their Studio runs (your accounts or theirs), where its files live, and confirm their email." },
      { sel: '[aria-label="Shared sites"]', title: "2 · Share a site", text: "Pick one of your projects and press Share. Shared sites stay in step both ways: each card shows who changed what." },
      { sel: '[aria-label="Limits"]', title: "3 · Limits and features", text: "Choose which themes they can use, how many sites of each type they can make, and which Studio features are hidden." },
      { sel: "b:Update the Cloudflare token", title: "4 · Their Cloudflare token", text: "Needed only when their app lives on their own Cloudflare account. It is kept on a database so updates work from any device." },
      { sel: "b:Update their Studio", title: "5 · Update their Studio", text: "Puts the latest Studio build on their app. Move their Studio moves it to other accounts, and Remove card forgets it here." },
    ],
  },
];
const EVENT = "studio:guide";
export const guide = {
  play(id: string) { dispatchEvent(new CustomEvent(EVENT, { detail: { id } })); },
  EVENT,
};
