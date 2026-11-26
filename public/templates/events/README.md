# Event website

Made with Site Studio. A website for an event of any kind (a conference, a concert, a wedding, a marathon, a market…), with its own content manager and a registration page.

| Page | What it shows |
|---|---|
| `index.html` | One page with every section, or the home page when the site has several pages |
| `schedule.html` | The schedule, the venue and the FAQ (several-page mode) |
| `lineup.html` | The speakers, artists or hosts, and the sponsors (several-page mode) |
| `about.html` | About the event, numbers, gallery and what people said (several-page mode) |
| `contact.html` | Message form, contact details and the venue (several-page mode) |
| `register.html` | The registration page: tickets, an RSVP, a team entry, a stall booking… (the theme and **Registration** in the CMS decide which) |
| `admin.html` | The site's own CMS, including the registrations and messages received |
| `supabase/enquiries.sql` | Database setup for saving registrations (only needed for sites on GitHub Pages) |

Switch between one page and several pages in the CMS under **Sections & pages**.

## How registrations work

A registration is saved in the same place as the site's messages: the site's database when it is hosted from the Studio, a JSON file inbox or your Supabase project when you have set one up, or otherwise the visitor's email app opens with the registration filled in, addressed to you. Each registration gets a number (for example `REG-7K2M9Q`) that the visitor sees on the confirmation.
