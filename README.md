# Site Studio

Create, preview, export and re-edit websites from your browser. Everything is stored as files in GitHub: no database, no server.

- **Two templates:** a single-page **Portfolio** (3D geometric design) and a multi-page **Shop** (home, product listing, product pages, cart, checkout, portfolio page, policies).
- **Live preview** while you edit, at desktop, tablet and phone sizes.
- **Projects dashboard** with categories, template and status filters, search, and full export history.
- **Export as ZIP** or **publish straight to a GitHub repository** in one commit.
- **Every exported site has its own CMS** at `admin.html`, with the same editor, so the site owner can keep it up to date.
- **Re-edit anything:** each export saves a snapshot, and you can import edits made on a live site back into the Studio.

Built with React, TypeScript, Tailwind CSS and Vite.

## How the pieces fit

| Repository | Visibility | Holds |
|---|---|---|
| `site-studio` (this code) | Public | The Studio app, built and served by GitHub Pages |
| `studio-data` | Private recommended | Your projects: `studio.json`, `projects/<id>/content.json`, images and export snapshots |
| One repository per published site | Public | The exported website, its content and its own CMS |

The data repository can be private because the Studio reads it through the GitHub API with your token.


## Themes

Every portfolio and shop can use any of **69 themes** (`src/themes/catalog.ts`). A theme sets colours, fonts and corners, plus:

| Setting | Choices |
|---|---|
| Hero layout | split, reverse, centred, stacked (wide art band / text over a full-width image), minimal |
| Menu | floating pill, full-width bar, transparent, centred |
| Cards | soft, outline, elevated, bold border, frosted glass, flat |
| Buttons | offset shadow, rounded, pill, square, outline, glow |
| Animation | rise, fade, zoom, slide, blur, flip, none |
| Background | blueprint grid, dots, lines, diagonal, waves, crosses, plain |
| Decorative shapes | solid, outlined, soft blobs, none |
| Headings / section labels / width | normal, uppercase, italic, tight · dot, plain, numbered, line, brackets, slash · normal, wide, narrow |
| Portfolio only | About (bento / stack), Skills (3D cube / card grid), Work (card deck / timeline) |
| Shop only | products per row (auto, 2, 3, 4), product card (classic, framed, name over image, minimal) |
| Cursor | normal, dot + trailing ring, inverting blob, spotlight glow, light trail |
| Intro & page transition | none, curtain lift, 0–100 counter, split reveal (also animates links between pages) |
| Heading reveal | none, line-by-line mask, letter cascade, decode / scramble |
| Hover | theme default, lift + glow edge, magnetic buttons, 3D tilt + glare |
| Scrolling | normal, progress bar, smooth inertia, inertia + velocity skew |
| Screen texture | none, film grain, scanlines, vignette |

### Public theme gallery (share with clients)

`https://<your-username>.github.io/studio/#/themes` opens a gallery of every theme. It needs **no sign-in**, so you can send it to anyone. It's also linked as **Themes** in the Studio header.

- **IDs:** every theme has a permanent ID, like `T-07 · Terminal`, which a client can quote to choose a design. IDs live in `src/themes/codes.ts`. New themes take the next free number at the end; never renumber or reuse an ID.
- **Previews:** hover a card for a live preview, or click it for a bigger one. There, you can switch between Portfolio and Shop and between desktop, tablet and phone, step through themes with ← →, and use **Copy ID** or **Copy link**.
- **Shortlist:** star themes, then use **Share shortlist** to copy their IDs and a link that opens just those themes.
- **Links:** `#/themes?t=velocity` opens one theme, `#/themes?v=store` previews as a shop, and `#/themes?list=a,b,c` shows a shared shortlist.

The editor's theme picker shows the same IDs, and you can search it by ID.

### Signature theme: Velocity ★

Velocity (first in the gallery) is a whole portfolio page, not just a restyle. It has:

- a loading counter, a fixed header with a status dot and a full-screen lime menu, and a custom cursor
- a full-screen hero: your name, your portrait (or a 3D wireframe shape), a signature that draws itself, and a "Next up" card
- a lime word band that speeds up as you scroll, and a message that lights up word by word
- a pinned sideways "Moments" strip with photos and quotes
- On/Off cards, career rows that open, a project grid with hover images, and a toolkit list
- learning rows, a partners marquee and a giant contact footer

It reuses Hero, About, Work, Projects, Skills, Learning and Contact. Its own content sits under **Design → Velocity layout**: status, menu label, signature text or image, Next up, message, moments, on/off cards, partners and the footer tagline. That tab appears while **Hero layout** is *Velocity* and **Page layout** is *Classic page*. Defaults are in `src/schema/velocity-defaults.json`, and the code is the `vx` section of `public/templates/portfolio/index.html`. On a shop, Velocity applies its colours and fonts only.

### Motion themes

13 award-style themes (tag **Motion**, marked **fx** in the gallery) switch on the interaction effects: Solare and Solare Day (letter-spaced serif, split intro, line reveals, grain), Tech Lead and Tech Lead Dark (clean stat-card look with a cursor spotlight and scroll progress), Kinetic Noir, Editorial Motion, Decode, Liquid Chrome, Gallery, Brutal Motion, Orbit Lab, Velvet Cinema and Studio Pop. Every effect is also a separate setting under **Design → Interactions**.

The effects live in one dependency-free file, `src/fx/fx.js`. `npm run sync:fx` copies it into each template as `assets/fx.js` (this runs automatically before `dev` and `build`), and exported sites include it. Cursor and hover effects only run with a mouse, and visitors who ask their device for reduced motion get a still page.

Pick one in **New project**, or later under **Design → Theme & layout** (also in each site's own CMS). Choosing a theme only changes `content.theme`; your content stays. Every setting stays editable after picking. The templates read these values as `data-*` attributes on `<html>` and switch their CSS, so exported sites need no extra files. Add a theme by adding one row to `ROWS` in `catalog.ts`.

## Set up (about 10 minutes)

1. **Create two repositories** on GitHub:
   - `site-studio`: **public**, empty.
   - `studio-data`: **private**, empty (leave "Add a README" unticked).
2. **Upload this code** to `site-studio`. Keep the folder structure, including `.github/workflows/deploy.yml`.
3. In `site-studio`, open **Settings → Pages** and set **Source** to **GitHub Actions**. The workflow builds and deploys automatically on every push. Watch the **Actions** tab until it's green.
4. **Create a fine-grained token:** GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens.
   - Repository access: `studio-data`, plus each site repository you'll publish to.
   - Permissions: **Contents: Read and write** (Metadata read-only is added automatically).
5. Open `https://<username>.github.io/site-studio/`, fill in `studio-data`, paste the token, and choose a username and a strong password.

Use **Try a demo** on the login screen to explore first; nothing is saved in demo mode.

## Everyday use

1. **New project** → pick a template and starting content (for example *Prakash Lal* for your own portfolio).
2. Edit by category on the left; the preview on the right updates as you type. **Save** commits to `studio-data`.
3. **Export ZIP** downloads the full site. Or **Publish to GitHub**: create an empty public repository first, add it to your token, then publish. Turn on **Settings → Pages → Deploy from a branch → main / (root)** in that repository once.
4. Hand over the site: the owner opens `admin.html` on the live site with a token for that repository only.
5. Later: **Details → Import content from site** pulls the owner's edits back, so you can redesign without losing them. When publishing, switch off *Replace the site's content* to update only the design and CMS.

## Central control: Studio and live sites stay in step

Each published project is linked to its site's repository. When you open the Studio, every linked project checks whether the content on the live site was changed in the site's own CMS. Opening a project runs the same check.

- **Only the site changed:** the Studio copies the content and images in automatically. The card shows **Updated from live site**.
- **Both changed since they were last in step:** the card shows **Live site edited · review**. In the project you choose **Use the site's version** or **Keep the Studio's version**. Keeping the Studio's version means the next publish with content replaces the site's.
- **A site that was never published from the Studio** (for example one uploaded from a ZIP): use Project details → **Link and load its live content**.

Drafts saved in a site's CMS aren't pulled in, only published content. The Studio's GitHub token needs read access to the site repositories.

## Site CMS: drafts, admin address and site-wide controls

- **Save** keeps your edits as a draft (`cms/draft.json` in the site's repository) without changing the live site. Reopening the CMS loads the draft. **Save & publish** makes it live and removes the draft; **Delete draft** goes back to what's live. The draft sits in the same repository as the site, so anyone who can read that repository can read it.
- **Admin page** (Settings) renames the CMS page, e.g. `yoursite/studio-desk` instead of `yoursite/admin`. Publishing moves the page in one commit and the old address stops working. Exports and Studio publishes use the same name, and order emails link to it.
- **Intro screen** (Theme & layout) sets the intro text and its background and text colours for every theme, including signature preloaders and the panel between pages.
- **Smooth scrolling strength** (Light / Medium / Heavy). Trackpads and touch screens always scroll natively.
- **Logo shape** from square (0) to circle (50). It also shapes the browser-tab icon, which shows the logo or your initials.
- **Menu, footer and layout titles** are all editable, including the words the Motion layouts show (“Drag to explore”, “List view”…).
- **Heading line breaks**: press Enter in a title to break the line there. With “As typed”, a heading typed on one line stays on one line and shrinks a little to fit.

## Studio name, logo and other devices

- **Settings → Studio name & logo:** rename the Studio (default *Picaffectz Studio*) and upload a square logo. They're saved in `studio.json` and `studio-assets/logo.png`, so every signed-in device shows them. The logo is also the browser-tab icon. Visitors to the public theme gallery see the default name.
- **Settings → Sign in on another device:** shows a QR code, a link and a code like `5RXC-LZJK-SJS3`. Open the link (or scan the code) on the new phone or computer and type the code. It then asks for a username and password for that device. The link carries your login encrypted with the code (PBKDF2, 310k rounds, then AES-GCM), the code is never part of the link, and links expire after 15 minutes. Each site's own CMS has the same option under Account.

## Login and security

- Your GitHub token is encrypted with your password (PBKDF2, 310,000 rounds, AES-256-GCM) and stored **only in that browser**. Nothing about the login is committed anywhere. Set up each device once.
- Passwords need 12+ characters and a mix of words, numbers or symbols. Wrong passwords trigger growing delays.
- Sessions end after 30 minutes without activity.
- Use fine-grained tokens limited to the repositories you need, with an expiry date. Turn on GitHub two-factor login.

## Shop orders, payments and customer accounts

Shops work in two modes:

- **Static (default):** no server. Customers pay by UPI, Razorpay or Stripe payment page, PayPal or cash on delivery, then send you the order on WhatsApp or by email with one tap.
- **With the shop backend (optional, per shop):** choose a free Supabase project, or a free Cloudflare Worker that stores orders as files in a private GitHub repo, plus Resend for email. Turn it on in the shop's **Accounts & backend** settings and follow `supabase/SETUP.md` or `cloudflare/SETUP.md` in the exported site. It adds:
  - customer sign-in with an email code, account numbers, order tracking, wishlist and saved details
  - Razorpay and Stripe checkout with the exact total, confirmed automatically through webhooks
  - automatic emails to the customer and you when a payment goes through, and to the customer when an order ships, is delivered or is cancelled
  - **Orders** and **Customers** panels in the shop's own CMS, with Mark paid for UPI/PayPal and one-tap WhatsApp to customers

The backend keeps prices honest: the server prices every order from the live `content.json`, never from the shopper's browser. Customers see only their own orders; only emails listed in `shop_admins` (Supabase) or `OWNER_EMAIL` / `ADMIN_EMAILS` (Cloudflare) see everything.

## Develop locally

```bash
npm install
npm run dev      # Studio at http://localhost:5173
npm run build    # dist/ = Studio + runtime/admin.js (the CMS shipped in every site)
```

### File map

```
src/
  pages/        Studio screens: login, dashboard, project editor, settings
  site-admin/   The CMS bundled into every exported site (cms/admin.js)
  editor/       Shared schema-driven editor, live preview, backup panel
  schema/       Field definitions for each template
  lib/          GitHub client, encryption, studio storage, exporter
  ui/           Buttons, dialogs, toasts, login screens
worker/         shop-worker.ts: the Cloudflare backend (GitHub files); bundled with the shared
                shop function by scripts/build-worker.mjs into templates/store/cloudflare/worker.js
public/templates/
  portfolio/    index.html, content.json, starters/, manifest.json
  store/        8 pages, assets/store.js, assets/store.css, content.json, manifest.json,
                supabase/ (schema.sql, functions/shop/index.ts, SETUP.md)
                cloudflare/ (worker.js, SETUP.md)
```

### Add a template

1. Add a folder in `public/templates/<id>/` with its pages, a `content.json` and a `manifest.json` listing the files to export.
2. Each page must render from `content.json` and accept live previews: when `window.name === "cms-preview"`, post `{type:"cms:ready"}` to the parent and re-render on `{type:"cms:content", content, assets}` from the same origin.
3. Describe its editable fields in `src/schema/<id>.ts` and register it in `src/schema/index.ts`.
