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
