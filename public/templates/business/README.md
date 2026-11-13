# Business website

Made with Site Studio. A professional website for a company, agency, firm or practice, with its own content manager.

| Page | What it shows |
|---|---|
| `index.html` | One page with every section, or the home page when the site has several pages |
| `services.html` | Services, process, pricing and FAQ (several-page mode) |
| `work.html` | Case studies, clients and testimonials (several-page mode) |
| `about.html` | Company story, mission, values, numbers and team (several-page mode) |
| `contact.html` | Enquiry form, contact details and FAQ (several-page mode) |
| `admin.html` | The site's own CMS, including **Enquiries** |
| `supabase/enquiries.sql` | Database setup for saving enquiries (only needed for sites on GitHub Pages) |

Switch between one page and several pages in the CMS under **Sections & pages**. In one-page mode, links to the other pages go to the matching section.

## How enquiries work

- **Saved as JSON files** (Where enquiries go → Save to a JSON file): each enquiry becomes a file in a private GitHub repository, through a small function on your Netlify set up with **Enquiry inbox** in the Studio. No email is sent. Read them under Enquiries in the Studio or the admin page.
- **Hosted on Netlify with Supabase** (Host outside GitHub in the Studio): enquiries are saved to your Supabase project automatically. Re-run the setup SQL from the Studio once so the `site_enquiries` table exists.
- **On GitHub Pages with Supabase**: run `supabase/enquiries.sql` in Supabase → SQL Editor (change the site ID and email at the bottom), then add the Project URL, public key and site ID under **Contact → Enquiry form** in the CMS.
- **Without Supabase**: the form opens the visitor's email app with the enquiry filled in, addressed to your contact email.

Read enquiries under **Enquiries** in `admin.html` (or in the Studio). Only emails listed in `site_admins` for your site can see them.
