# Shop backend setup (Cloudflare Worker + GitHub files)

This is the free backend that needs no database. A small Cloudflare Worker runs the shop's server code, and every order, customer and wishlist is saved as a JSON file in a **private** GitHub repository.

You get the same features as the Supabase option:
- customer accounts (orders, wishlist, details)
- automatic order emails
- Razorpay or Stripe checkout with the exact order total
- **Orders** and **Customers** in the shop CMS

Allow about 20 minutes. Use test keys first (Razorpay `rzp_test_…`, Stripe `sk_test_…`).

**Good for:** small shops with up to a few thousand orders. Cloudflare's free plan allows 100,000 requests a day, and GitHub allows 5,000 API calls an hour. If you outgrow it, switch to Supabase. The shop's pages stay the same.

## 1. Make a private repository for orders
1. GitHub → **New repository**, named e.g. `shop-data`.
2. Choose **Private**. This matters: orders contain customer names, emails and addresses. The Worker refuses to save anything in a public repository.
3. Tick **Add a README file**, then **Create repository**.

Don't use your website's repository. It's public, and every order would rebuild your site.

## 2. Create a GitHub token for that repository only
1. GitHub → your photo → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Name: `shop worker`. Expiration: up to 1 year. Set a reminder to renew it.
3. **Repository access → Only select repositories →** `shop-data`.
4. **Permissions → Repository permissions → Contents → Read and write.** Metadata (read) is added automatically.
5. **Generate token** and copy it (starts with `github_pat_`).

## 3. Set up email (Resend)
1. Sign up at resend.com.
2. Add your domain under **Domains**, then add the DNS records it shows. Wait for **Verified**.
3. **API Keys → Create API key** with sending access, and copy it.

Before your domain is verified, you can test with the sender `onboarding@resend.dev`, but it only delivers to your own Resend email.

## 4. Create the Worker
1. Sign up at dash.cloudflare.com (the free plan is enough).
2. **Workers & Pages → Create → Create Worker.** Name it `shop` and press **Deploy**.
3. Press **Edit code**. Delete everything in the editor and paste the whole of `cloudflare/worker.js` from this site.
4. Press **Deploy**.
5. Copy the Worker's address shown at the top, e.g. `https://shop.yourname.workers.dev`.

## 5. Add the settings and secrets
Open the Worker → **Settings → Variables and Secrets → Add**. For each entry, choose **Secret** for keys and **Text** for the rest.

| Name | Type | Value |
|---|---|---|
| `DATA_REPO` | Text | `your-github-name/shop-data` |
| `GITHUB_TOKEN` | Secret | the token from step 2 |
| `AUTH_SECRET` | Secret | a random string of at least 32 characters (see below) |
| `SITE_URL` | Text | your shop's address, e.g. `https://your-name.github.io/shop/` |
| `RESEND_API_KEY` | Secret | from step 3 |
| `MAIL_FROM` | Text | e.g. `Fieldnote Goods <orders@yourdomain.com>` |
| `OWNER_EMAIL` | Text | where new-order emails go. This email can also sign in to Orders and Customers. |
| `ADMIN_EMAILS` | Text | optional: other emails allowed into Orders and Customers, comma-separated. If you set this, include your own email too. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Secret | if you use Razorpay |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Secret | if you use Stripe |
| `ALLOWED_ORIGINS` | Text | optional: another site address allowed to call the Worker, e.g. a custom domain |

To make `AUTH_SECRET`: open any browser tab, press F12 → Console, run `crypto.randomUUID() + crypto.randomUUID()`, and copy the result. If you change it later, everyone is signed out.

Press **Deploy** (or **Save and deploy**) after adding them.

## 6. Connect the shop
1. Open `admin.html` on your shop → **Accounts & backend**.
2. Switch on **Use the shop backend**. Choose **Cloudflare Worker + GitHub files (free)**. Paste the Worker URL.
3. Choose whether customers can sign in (**Customer accounts**), then **Save & publish**.
4. Open **Orders** in the CMS and sign in with your `OWNER_EMAIL`. You'll get a 6-digit code by email.

## 7. Payment webhooks (Razorpay and Stripe only)
Webhooks confirm a payment even if the customer closes the page.
- **Razorpay:** Dashboard → **Settings → Webhooks → Add**.
  - URL: `https://shop.yourname.workers.dev/razorpay-webhook`
  - Events: `payment.captured` and `order.paid`
  - Secret: the same value as `RAZORPAY_WEBHOOK_SECRET`
- **Stripe:** **Developers → Webhooks → Add endpoint**.
  - URL: `https://shop.yourname.workers.dev/stripe-webhook`
  - Event: `checkout.session.completed`
  - Copy the signing secret (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.

## 8. Test it
1. Place a cash-on-delivery order. You and the "customer" both get an email, and a file appears in `shop-data/orders/`.
2. Place a UPI order and enter any 12-digit reference. You get a "Check UPI payment" email. In **Orders**, tap **Mark paid**: you and the customer both get the confirmation email.
3. If customer accounts are on, sign in on `account.html`. A file appears in `shop-data/customers/` with an account number like AC-100001.

## What's in the data repository
| Path | What |
|---|---|
| `orders/<order no>.json` | one file per order, including payment status and the email log |
| `customers/<id>.json` | one file per signed-up customer: account number, details, wishlist |
| `refs/<razorpay id>.json` | lets Razorpay webhooks find the order |
| `meta/counter.json` | the next account number |
| `auth/<id>.json` | wrong sign-in codes (a code locks after 5 tries) |

Every change is a commit, so you have full history. To back up, download the repository as a ZIP.

## Updating the Worker
After you update the shop from Site Studio, open the Worker → **Edit code**, paste the new `cloudflare/worker.js`, and press **Deploy**. Your settings and data stay as they are.

## Troubleshooting
- **"DATA_REPO must be a private repository"**: make `shop-data` private under **Settings → General → Danger Zone**.
- **"GITHUB_TOKEN is invalid or expired"**: create a new token (step 2) and replace the secret.
- **"DATA_REPO wasn't found"**: check the spelling (`name/repo`) and that the token has access to that repository.
- **No emails arrive**: check `RESEND_API_KEY`, and that `MAIL_FROM` uses your verified domain.
- **The shop says "Couldn't reach the shop"**: check the Worker URL in the CMS, and that `SITE_URL` matches your shop's address exactly, so the browser allows the request.
