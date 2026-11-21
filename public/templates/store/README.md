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
| `admin.html` | The shop's own CMS, including Purchased orders, Customer Data, Inventory, Abandoned carts and Reviews |

## How orders work

### On the shop's own Cloudflare database (recommended)
Host the shop from the Studio (Host to External Services → Cloudflare database). Everything then runs on that database, exactly as for a restaurant:
- Customers sign in with a code sent to their mobile (WhatsApp or SMS) or email, and see their orders, bills, points and saved addresses under **My account**.
- Razorpay, Cashfree, PhonePe, Stripe and PayPal charge the exact total; the amount is worked out on the server.
- Orders appear under **Purchased orders**; stock, abandoned-cart reminders, reviews, courier tracking and customer data are all in the site's admin page.

### Without a database
The site has no server, so it can't store orders or take card details itself.

1. The shopper fills in their details and chooses a payment method.
2. They pay by UPI (QR with the exact amount), on your Razorpay or Stripe page, on PayPal, or cash on delivery.
3. They tap **Send on WhatsApp** or **Send by email**. You receive the full order with an order number.
4. Check the payment in your UPI app or payment dashboard before you ship.

## Publish and edit
1. Upload every file to a public GitHub repository and turn on **Settings → Pages → Deploy from a branch → main / (root)**.
2. Create a fine-grained token for **this repository only** with **Contents: Read and write**.
3. Open `admin.html` on the live site, connect the device, then edit products, prices, payments and pages.
