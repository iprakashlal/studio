# Restaurant website

Made with Site Studio. A website for a restaurant, café, bakery, bar or any place people come to eat and drink, with its own content manager.

| Page | What it shows |
|---|---|
| `index.html` | One page with every section, or the home page when the site has several pages |
| `menu.html` | The full menu with search and diet filters, offers and ordering links (several-page mode). A good page for a table QR code. |
| `about.html` | The story, highlights, the team, events and reviews (several-page mode) |
| `gallery.html` | All the photos (several-page mode) |
| `contact.html` | The booking form, address, opening hours, map and FAQ (several-page mode) |
| `admin.html` | The site's own CMS, including **Enquiries** (booking requests) |
| `supabase/enquiries.sql` | Database setup for saving booking requests (only needed for sites on GitHub Pages) |

Switch between one page and several pages in the CMS under **Sections & order**. In one-page mode, links to the other pages go to the matching section.

## How booking requests work

- **Published to Cloudflare from the Studio**: requests are saved in the site's database, listed under **Enquiries** in `admin.html`, and emailed to you when "Email me each request" is on.
- **Saved as JSON files** (older inbox): each request becomes a file in a private GitHub repository, through a small function set up with **Enquiry inbox** in the Studio.
- **Without a database**: the form opens the visitor's email app with the request filled in, addressed to your contact email.

A request is not a confirmed booking: call or message the guest to confirm.

## Opening hours

Enter times as `12:00` or `7:30 pm`. A closing time earlier than the opening time runs past midnight. "Open now" follows the restaurant's own clock (Opening hours → Time zone), wherever the visitor is.
