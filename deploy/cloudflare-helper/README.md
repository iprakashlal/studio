# Studio helper (Cloudflare)

Cloudflare's, Resend's, Stripe's and Supabase's APIs don't accept requests from a web page, so the Studio sends
its setup requests through this small Worker on **your** Cloudflare account. It passes each request on once and
keeps nothing except the hashed keys of the Studios connected to it (in the `HELPER` KV namespace).

Set it up from the Studio: **Deploy the helper to Cloudflare**, then open the Worker's address
(`https://studio-helper.<you>.workers.dev`) and press **Connect to my Studio** (or paste the address into the Studio). The first Studio to
connect owns it; other devices join by proving they can manage your Cloudflare account (your API token).

Free plan: 100,000 requests a day, far more than the Studio uses.
