# Shop backend setup (Supabase + Resend)

The backend adds customer accounts (orders, wishlist, details), automatic order emails, and Razorpay or Stripe checkout with the exact order total. The shop works without it; turn it on when you're ready.

Allow about 30 minutes. Do it all in **test mode** first (Razorpay `rzp_test_…` keys, Stripe `sk_test_…` keys), then swap in live keys.

## 1. Create the Supabase project
1. Sign up at supabase.com and create a project. Pick the region closest to your customers (for India: Mumbai).
2. Keep the database password somewhere safe.

## 2. Create the tables and access rules
1. Supabase → **SQL Editor → New query**.
2. Paste all of `supabase/schema.sql` and press **Run**.
3. Make yourself the shop admin: run this, with your email:
   ```sql
   insert into public.shop_admins (email) values ('you@example.com') on conflict do nothing;
   ```

## 3. Send emails through Resend
1. Sign up at resend.com, add your domain under **Domains**, and add the DNS records it shows. Wait until it says **Verified**.
2. **API Keys → Create API key** (sending access). Copy it.
3. In Supabase: **Authentication → Emails → SMTP Settings → Enable custom SMTP**:
   - Host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key
   - Sender email: e.g. `orders@yourdomain.com`; sender name: your shop name

   Without this, Supabase only sends a few sign-in emails an hour.
4. Make the sign-in email show a code: **Authentication → Emails → Templates → Magic Link**. Set the subject to `Your sign-in code` and the body to:
   ```html
   <h2>Your sign-in code</h2>
   <p>Enter this code on the shop to sign in:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
   <p>It expires in one hour. If you didn't ask for it, ignore this email.</p>
   ```
5. **Authentication → URL Configuration → Site URL**: your shop's address, e.g. `https://you.github.io/shop/`.

## 4. Deploy the shop function
1. Supabase → **Edge Functions → Deploy a new function → Via Editor**.
2. Name it exactly `shop`. Replace the sample code with all of `supabase/functions/shop/index.ts`. Press **Deploy**.
3. Open the function's **Details** and switch **Verify JWT** (or "Enforce JWT verification") **off**. Razorpay and Stripe call it without a Supabase login; the function checks logins itself.

   With the Supabase CLI instead: `supabase functions deploy shop --no-verify-jwt`.

## 5. Add the function's secrets
Supabase → **Edge Functions → Secrets** (Manage secrets). Add:

| Name | Value |
|---|---|
| `SITE_URL` | Your shop's address, ending with `/`, e.g. `https://you.github.io/shop/` |
| `RESEND_API_KEY` | Your Resend API key |
| `MAIL_FROM` | `Your Shop <orders@yourdomain.com>` (a verified Resend domain) |
| `OWNER_EMAIL` | Where new-order emails go. Separate several with commas. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay → Account & Settings → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | Any long random text; use the same in step 6 |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys → Secret key |
| `STRIPE_WEBHOOK_SECRET` | From step 6 (starts with `whsec_`) |

Only add the Razorpay or Stripe rows for the providers you use. Secret keys live only here, never in the shop's CMS.

## 6. Tell Razorpay and Stripe where to report payments
- **Razorpay:** Account & Settings → Webhooks → Add new webhook
  - URL: `https://<project-ref>.supabase.co/functions/v1/shop/razorpay-webhook`
  - Secret: the same text as `RAZORPAY_WEBHOOK_SECRET`
  - Events: `payment.captured` and `order.paid`
- **Stripe:** Developers → Webhooks → Add endpoint
  - URL: `https://<project-ref>.supabase.co/functions/v1/shop/stripe-webhook`
  - Event: `checkout.session.completed`
  - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`

## 7. Connect the shop
1. Open the shop's `admin.html` → **Accounts & backend**.
2. Switch on **Use the shop backend**. Paste the **Project URL** and the **anon public** key from Supabase → Project Settings → API. Never paste the `service_role` key.
3. Choose whether customers can sign in, use a wishlist, or must sign in to check out.
4. Under **Payments**, switch on the methods you use. With the backend on, Razorpay and Stripe don't need payment links.
5. **Save & publish**, and wait a minute for the site to update.

## 8. Test it
1. Place a cash-on-delivery order on the live shop. You and the "customer" should both get an email.
2. Place a Razorpay test order (card `4111 1111 1111 1111`, any future date, any CVV). Both emails arrive when the payment completes.
3. In `admin.html`, open **Orders**, sign in with your admin email, and change an order to **Shipped**. The customer gets an email.
4. Sign in on the shop's **Account** page and check the order and wishlist appear.

## How payments are confirmed
| Method | Confirmed by | Emails |
|---|---|---|
| Razorpay | Razorpay checkout + webhook, automatically | Customer and owner, on payment |
| Stripe | Stripe webhook, automatically | Customer and owner, on payment |
| Cash on delivery | Order placed | Customer and owner, on order |
| UPI to your UPI ID, PayPal.me | You, in **Orders → Mark paid** | Owner on order; customer and owner when you mark it paid |

Shipped, Delivered and Cancelled send the customer an email. **WhatsApp customer** in Orders opens WhatsApp with a ready message.

## Good to know
- Prices are taken from the live `content.json`, never from the shopper's browser. After changing prices, wait a minute for the site to update before testing.
- Customers see only their own orders, including guest orders placed with the same email. Only emails in `shop_admins` can see all orders and customers.
- Supabase's free plan pauses a project after a week with no activity. Upgrade, or open the shop regularly, before you rely on it.
