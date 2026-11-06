# Online shop

Made with Site Studio. A multi-page shop with its own content manager.

| Page | What it shows |
|---|---|
| `index.html` | Home: hero, featured products, categories, banner, reviews |
| `shop.html` | All products with category filter, search and sort |
| `product.html?p=…` | One product: photos, options, quantity, add to cart |
| `cart.html` | Cart with shipping and tax |
| `checkout.html` | Customer details, payment method, order confirmation |
| `portfolio.html` | Your story and past work |
| `policies.html` | Shipping, refund, privacy and terms |
| `account.html` | Customer sign-in, order tracking, wishlist and details (needs the backend) |
| `admin.html` | The shop's own CMS, including Orders and Customers |
| `supabase/` | Optional backend, choice 1: Supabase database setup, server function and `SETUP.md` |
| `cloudflare/` | Optional backend, choice 2: a free Cloudflare Worker that keeps orders as files in a private GitHub repo (`worker.js`, `SETUP.md`) |

## How orders work

### With the shop backend (recommended)
Choose a backend under **Accounts & backend** in `admin.html`:
- **Supabase**: a free database project. Follow `supabase/SETUP.md`.
- **Cloudflare Worker + GitHub files**: no database; orders are JSON files in a private GitHub repo. Follow `cloudflare/SETUP.md`.

Both work the same way, with Resend for email:
- Customers can sign in with an email code to track orders, keep a wishlist and save their details. Each gets an account number like AC-100001.
- Razorpay and Stripe charge the exact order total. Customers and you get an email as soon as a payment goes through.
- Cash-on-delivery orders email both of you straight away. UPI and PayPal orders wait until you press **Mark paid** in **Orders**.
- **Orders** and **Customers** in `admin.html` list everything, searchable by order number, account number or email, with one-tap WhatsApp messages to customers.

### Without the backend
The site has no server, so it can't store orders or take card details itself.

1. The shopper fills in their details and chooses a payment method.
2. They pay by UPI (QR with the exact amount), on your Razorpay or Stripe page, on PayPal, or cash on delivery.
3. They tap **Send on WhatsApp** or **Send by email**. You receive the full order with an order number.
4. Check the payment in your UPI app or payment dashboard before you ship.

## Publish and edit
1. Upload every file to a public GitHub repository and turn on **Settings → Pages → Deploy from a branch → main / (root)**.
2. Create a fine-grained token for **this repository only** with **Contents: Read and write**.
3. Open `admin.html` on the live site, connect the device, then edit products, prices, payments and pages.
