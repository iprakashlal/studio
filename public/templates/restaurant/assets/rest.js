/* Restaurant, café and dine-in runtime. Renders every page from content.json.
   One page with all sections, or several pages (Home, Menu, About, Gallery, Contact).
   The booking form saves to the site's database when it has one (hosted sites, or the form's own
   settings), otherwise it opens the visitor's email app addressed to the restaurant. */
(() => {
"use strict";

/* ============================================================
   DEFAULT CONTENT (also exported as content.json)
   ============================================================ */
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DEFAULT = {
  theme: {
    bg: "#FBF6EE", surface: "#FEFCFA", deep: "#2A1710", text: "#2A1710", soft: "#756760", line: "#DCD5CD", c1: "#B4441C", c2: "#2F5D50", c3: "#E0A53A",
    fontDisplay: "Fraunces", fontBody: "Mulish", radius: 14, preset: "rest-copper-pot",
    layout: "split", nav: "bar", cards: "elevated", buttons: "pill", heading: "serif", shead: "ornament", pattern: "none", width: "normal", motionStyle: "rise", bands: "soft", heroArt: "arch",
    menuStyle: "classic", divider: "none", ornament: "flourish", gallery: "grid",
    cursor: "none", loader: "none", textfx: "none", hoverfx: "none", scrollfx: "none", overlay: "none",
    introBg: "", introFg: "", introTitle: "", introFont: "display", introCase: "upper", logoRadius: 50, scrollEase: "light", lineBreaks: "typed",
  },
  cms: { adminPage: "admin" },
  poweredBy: { show: true },
  brand: { name: "Picaffectz", tagline: "Slow-cooked food, served warm", logo: null, showName: true },
  site: { multiPage: false, crumbs: true, mobileBar: true, pageLabels: { home: "Home", menu: "Menu", about: "Our story", gallery: "Gallery", contact: "Visit & book" } },
  nav: { cta: "Book a table", ctaTarget: "reserve" },
  notice: { on: false, text: "", label: "", target: "offers" },
  sections: [
    { id: "hero", label: "Home", show: true, inNav: false },
    { id: "highlights", label: "Highlights", show: true, inNav: false },
    { id: "about", label: "Our story", show: true, inNav: true },
    { id: "specials", label: "Signature dishes", show: true, inNav: false },
    { id: "food", label: "Menu", show: true, inNav: true },
    { id: "offers", label: "Offers", show: true, inNav: false },
    { id: "gallery", label: "Gallery", show: true, inNav: true },
    { id: "chef", label: "Our team", show: true, inNav: false },
    { id: "events", label: "Events & catering", show: true, inNav: true },
    { id: "press", label: "Featured in", show: true, inNav: false },
    { id: "testimonials", label: "Reviews", show: true, inNav: false },
    { id: "order", label: "Order online", show: true, inNav: false },
    { id: "reserve", label: "Book a table", show: true, inNav: false },
    { id: "contact", label: "Visit us", show: true, inNav: true },
    { id: "faq", label: "FAQ", show: true, inNav: false },
    { id: "cta", label: "Call to action", show: true, inNav: false },
  ],
  hero: {
    eyebrow: "Modern Indian kitchen · Pune",
    title: "Slow-cooked food,\nserved *warm*.",
    lede: "Copper-pot curries, breads from a clay oven and a short menu that changes with the season. Lunch and dinner, every day.",
    ctaPrimary: "Book a table", ctaPrimaryTarget: "reserve", ctaSecondary: "See the menu", ctaSecondaryTarget: "food",
    image: null, images: [], stamp: "Est. 2014 · Cooked over fire", showStatus: true,
    badges: ["Open all week", "Vegetarian and vegan dishes", "Private dining for 20"],
    slides: { enabled: false, items: [], effect: "fade", interval: 6, speed: 1.2, overlay: 45, overlayColor: "#2A1710", overlayStyle: "left", textColor: "light", height: "tall", dots: true, arrows: false, pause: true, hideArt: true, artOpacity: 100 },
  },
  highlights: {
    items: [
      { icon: "flame", title: "Cooked over fire", body: "A clay oven and charcoal grill, lit every morning." },
      { icon: "leaf", title: "Local produce", body: "Vegetables from farms within 60 km, picked the same week." },
      { icon: "bowl", title: "Made from scratch", body: "Spice blends, breads and chutneys are all made in house." },
      { icon: "people", title: "Room for groups", body: "A private room for up to 20 guests." },
    ],
  },
  about: {
    eyebrow: "Our story", title: "A family kitchen that grew",
    body: "Picaffectz began in 2014 with six tables and one handed-down recipe book. The curries are still cooked the slow way, in heavy copper pots, for as long as they need.\n\nToday the kitchen is bigger, but the idea is the same: a short menu, cooked with care, at a fair price.",
    image: null, signature: "Meera & Arjun, founders",
    facts: [{ value: "2014", label: "Cooking since" }, { value: "42", label: "Seats" }, { value: "4.7★", label: "Guest rating" }],
  },
  specials: {
    eyebrow: "Chef's picks", title: "Signature dishes", lede: "The plates our regulars come back for.",
    items: [
      { name: "Copper pot dal", desc: "Black lentils simmered overnight, finished with white butter.", price: "340", tag: "Since day one", diet: "veg", image: null },
      { name: "Charcoal lamb chops", desc: "Marinated for a day, grilled to order, mint chutney.", price: "690", tag: "Chef's special", diet: "nonveg", image: null },
      { name: "Smoked aubergine", desc: "Fire-roasted, whipped yoghurt, pomegranate, crisp shallots.", price: "320", tag: "Vegetarian", diet: "veg", image: null },
    ],
  },
  food: {
    eyebrow: "The menu", title: "What we're cooking", lede: "A short menu that follows the season. Ask us about allergens: we are happy to adapt a dish.",
    currency: "₹", dietMarks: true, filters: true, search: true, photos: true, homeCount: 3, all: "See the full menu",
    pdfUrl: "", pdfLabel: "Download the menu (PDF)", note: "Prices are in rupees and exclude taxes. A 5% service charge applies to tables of eight or more.",
    categories: [
      { name: "Small plates", note: "To share while you decide", image: null, items: [
        { name: "Dahi puri", desc: "Crisp shells, spiced potato, sweet yoghurt, tamarind.", price: "220", diet: "veg", spice: "1", tag: "", allergens: "dairy, gluten", image: null, variants: [], soldOut: false },
        { name: "Paneer tikka", desc: "Clay-oven paneer, bell peppers, mint chutney.", price: "320", diet: "veg", spice: "2", tag: "Bestseller", allergens: "dairy", image: null, variants: [], soldOut: false },
        { name: "Chilli garlic prawns", desc: "Tiger prawns, burnt garlic, curry leaf.", price: "480", diet: "nonveg", spice: "3", tag: "", allergens: "shellfish", image: null, variants: [], soldOut: false },
        { name: "Crispy corn", desc: "Sweet corn kernels, lime, chilli salt.", price: "240", diet: "vegan", spice: "1", tag: "", allergens: "", image: null, variants: [], soldOut: false },
      ] },
      { name: "From the clay oven", note: "", image: null, items: [
        { name: "Tandoori chicken", desc: "Free-range chicken, yoghurt and Kashmiri chilli marinade.", price: "", diet: "nonveg", spice: "2", tag: "", allergens: "dairy", image: null, variants: [{ label: "Half", price: "360" }, { label: "Full", price: "620" }], soldOut: false },
        { name: "Charcoal lamb chops", desc: "Marinated for a day, grilled to order.", price: "690", diet: "nonveg", spice: "2", tag: "Chef's special", allergens: "dairy", image: null, variants: [], soldOut: false },
        { name: "Malai broccoli", desc: "Cream cheese and cardamom marinade, charred edges.", price: "310", diet: "veg", spice: "0", tag: "", allergens: "dairy, nuts", image: null, variants: [], soldOut: false },
      ] },
      { name: "Copper pot curries", note: "Served with steamed rice or two rotis", image: null, items: [
        { name: "Copper pot dal", desc: "Black lentils simmered overnight, white butter.", price: "340", diet: "veg", spice: "1", tag: "Since day one", allergens: "dairy", image: null, variants: [], soldOut: false },
        { name: "Butter chicken", desc: "Smoked tomato gravy, fenugreek, cream.", price: "460", diet: "nonveg", spice: "1", tag: "Bestseller", allergens: "dairy, nuts", image: null, variants: [], soldOut: false },
        { name: "Coastal fish curry", desc: "Catch of the day, coconut, kokum, curry leaf.", price: "520", diet: "nonveg", spice: "2", tag: "", allergens: "fish", image: null, variants: [], soldOut: false },
        { name: "Jackfruit kofta", desc: "Tender jackfruit dumplings in a cashew gravy.", price: "380", diet: "vegan", spice: "1", tag: "New", allergens: "nuts", image: null, variants: [], soldOut: false },
      ] },
      { name: "Breads & rice", note: "", image: null, items: [
        { name: "Butter naan", desc: "", price: "70", diet: "veg", spice: "0", tag: "", allergens: "gluten, dairy", image: null, variants: [], soldOut: false },
        { name: "Garlic naan", desc: "", price: "90", diet: "veg", spice: "0", tag: "", allergens: "gluten, dairy", image: null, variants: [], soldOut: false },
        { name: "Tandoori roti", desc: "Whole wheat.", price: "50", diet: "vegan", spice: "0", tag: "", allergens: "gluten", image: null, variants: [], soldOut: false },
        { name: "Saffron pulao", desc: "Aged basmati, saffron, fried onions.", price: "260", diet: "veg", spice: "0", tag: "", allergens: "", image: null, variants: [], soldOut: false },
      ] },
      { name: "Desserts & drinks", note: "", image: null, items: [
        { name: "Gulab jamun", desc: "Warm, with saffron rabri.", price: "190", diet: "veg", spice: "0", tag: "", allergens: "dairy, gluten", image: null, variants: [], soldOut: false },
        { name: "Mango kulfi", desc: "Alphonso mango, pistachio crumb.", price: "210", diet: "veg", spice: "0", tag: "Seasonal", allergens: "dairy, nuts", image: null, variants: [], soldOut: false },
        { name: "Masala chai", desc: "", price: "90", diet: "veg", spice: "0", tag: "", allergens: "dairy", image: null, variants: [], soldOut: false },
        { name: "Fresh lime soda", desc: "Sweet, salted or both.", price: "120", diet: "vegan", spice: "0", tag: "", allergens: "", image: null, variants: [], soldOut: false },
      ] },
    ],
  },
  offers: {
    eyebrow: "This month", title: "Offers",
    items: [
      { title: "Weekday lunch thali", body: "Two curries, dal, rice, bread and dessert.", when: "Mon–Fri, 12–3 pm", price: "₹399", code: "", image: null },
      { title: "Early dinner", body: "15% off the food bill when you are seated before 7 pm.", when: "Sun–Thu", price: "15% off", code: "EARLY15", image: null },
    ],
  },
  gallery: { eyebrow: "Gallery", title: "A look inside", lede: "", homeCount: 6, all: "See all photos", items: [] },
  chef: {
    eyebrow: "The people", title: "Who's in the kitchen", lede: "",
    members: [
      { name: "Meera Kulkarni", role: "Head chef & co-founder", bio: "Grew up in her grandmother's kitchen in Kolhapur. Runs the pass every evening.", photo: null },
      { name: "Arjun Kulkarni", role: "Front of house", bio: "Knows most regulars by name, and their usual order.", photo: null },
    ],
  },
  events: {
    eyebrow: "Events & catering", title: "Celebrate with us", lede: "Birthdays, team dinners and family gatherings, at our place or yours.",
    items: [
      { icon: "people", title: "Private dining", body: "A separate room for up to 20 guests, with a set menu from ₹1,200 a head." },
      { icon: "cake", title: "Celebrations", body: "Tell us the occasion: we'll plan the menu, the cake and the table." },
      { icon: "truck", title: "Outdoor catering", body: "Live counters and buffet menus for 30 to 300 guests." },
    ],
    button: "Plan an event", type: "Private event",
  },
  press: { title: "As featured in", logos: [{ name: "The City Table", logo: null }, { name: "Good Food Guide", logo: null }, { name: "Pune Eats", logo: null }] },
  testimonials: {
    eyebrow: "Reviews", title: "What guests say",
    items: [
      { quote: "The dal alone is worth the trip. Warm service, and they remembered our anniversary.", name: "Rhea Menon", role: "", company: "", rating: "5" },
      { quote: "Our go-to for family dinners. The kids love the naan and the grandparents love the pace.", name: "Vikram Joshi", role: "", company: "", rating: "5" },
      { quote: "Booked the private room for 18 people. The team handled everything.", name: "Sana Sheikh", role: "", company: "", rating: "5" },
    ],
  },
  order: {
    eyebrow: "At home", title: "Order online", lede: "Pick up from the restaurant or get it delivered.",
    links: [{ label: "Order for pickup", url: "", note: "Ready in 25 minutes" }, { label: "Order for delivery", url: "", note: "Within 6 km" }],
    call: true, whatsapp: true, whatsappText: "Hello, I'd like to place an order.",
  },
  // The Order now page (order.html): its own cart and checkout. Off until the owner switches it on.
  ordering: {
    on: false, label: "Order now", title: "Order online", lede: "Fresh from our kitchen, for delivery or pickup.", bestTitle: "Best sellers", tiles: true,
    modes: { delivery: true, pickup: true, dinein: false }, deliveryMins: 40, pickupMins: 20, dineMins: 15,
    minOrder: 200, deliveryFee: 40, freeAbove: 0, areas: "", areaNote: "", askPin: true, packing: 0, taxPercent: 5, taxLabel: "GST", taxIncluded: false, roundOff: true,
    tips: true, tipOptions: "10, 20, 30", cutlery: true, notes: true, dishNotes: true, askEmail: false,
    schedule: true, slotMins: 30, daysAhead: 1,
    coupons: [],
    pay: { cod: true, codLabel: "", upi: false, upiId: "", payee: "" },
    whatsapp: "", intro: "New order", prefix: "ORD", success: "Thank you! Your order is placed.",
  },
  reserve: { eyebrow: "Reservations", title: "Book a table", lede: "Tell us when you'd like to come. We'll confirm by phone or message.", note: "For groups of more than 10, please call us." },
  hours: {
    title: "Opening hours", format: "12", utcOffset: "+05:30", showStatus: true, note: "Kitchen closes 30 minutes before closing time.",
    openLabel: "Open now", closedLabel: "Closed now",
    days: DAYS.map((day, i) => ({ day, closed: false, open: "12:00", close: i >= 4 && i <= 5 ? "23:30" : "23:00", open2: "", close2: "" })),
  },
  contact: {
    eyebrow: "Visit us", title: "Find us", lede: "",
    email: "hello@picaffectz.example", phone: "+91 20 4000 1234", whatsapp: "", address: "14 Lane 6, Koregaon Park\nPune 411001", mapUrl: "", mapEmbed: true, parking: "Valet parking in the evening",
    form: {
      enabled: true, title: "Request a table", askEmail: true, askGuests: true, maxGuests: 10, askDate: true, askTime: true, slots: ["12:00", "12:30", "13:00", "13:30", "14:00", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"],
      askOccasion: true, occasions: ["Birthday", "Anniversary", "Business meal", "Date night"], askType: true, types: ["Table booking", "Private event", "Catering", "Something else"],
      messageLabel: "Anything we should know?", submit: "Request booking",
      success: "Thank you. We have your request and will confirm it shortly.", consent: "I agree to be contacted about this booking.",
      saveTo: "auto", fileUrl: "", sbUrl: "", sbKey: "", site: "", notify: false, notifyTo: "", notifySubject: "New booking request from {name}",
    },
  },
  faq: {
    eyebrow: "Good to know", title: "Questions guests ask",
    items: [
      { q: "Do I need a reservation?", a: "Walk-ins are welcome. On Friday and Saturday evenings a booking is the safest way to get a table." },
      { q: "Do you have vegan and gluten-free dishes?", a: "Yes. They are marked on the menu, and the kitchen can adapt several others. Please tell your server about any allergy." },
      { q: "Is there parking?", a: "There is valet parking in the evening and street parking during the day." },
      { q: "Can I bring a cake?", a: "Of course. We'll keep it chilled and bring it out when you're ready. No cakeage fee." },
    ],
  },
  cta: { title: "Hungry yet?", body: "Book a table for tonight, or call us and we'll have it ready to take away.", button: "Book a table", target: "reserve" },
  footer: { text: "Slow-cooked food, served warm. Lunch and dinner, every day.", legal: "© {year} Picaffectz. All rights reserved.", links: [{ label: "Privacy", url: "" }, { label: "Terms", url: "" }] },
  seo: { title: "Picaffectz · Modern Indian restaurant in Pune", description: "Copper-pot curries, clay-oven breads and a seasonal menu. Book a table or order online.", titlePattern: "{page} · {site}", keywords: "", author: "", image: null, siteUrl: "", themeColor: "", noindex: false, googleVerification: "", meta: [], cuisine: "Indian", priceRange: "₹₹" },
};

const FONTS = {
  "Unbounded": "Unbounded:wght@400;600;800", "Bricolage Grotesque": "Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800", "Syne": "Syne:wght@400;600;800",
  "Sora": "Sora:wght@400;600;800", "Fraunces": "Fraunces:opsz,wght@9..144,400;9..144,600;9..144,800", "Archivo Black": "Archivo+Black", "DM Serif Display": "DM+Serif+Display",
  "Playfair Display": "Playfair+Display:ital,wght@0,400;0,600;0,800;1,400", "Space Grotesk": "Space+Grotesk:wght@400;600;700", "Outfit": "Outfit:wght@400;500;600;800",
  "Oswald": "Oswald:wght@400;600;700", "Bebas Neue": "Bebas+Neue", "Cormorant Garamond": "Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400", "Libre Baskerville": "Libre+Baskerville:ital,wght@0,400;0,700;1,400",
  "Lexend": "Lexend:wght@400;500;600;800", "Rubik": "Rubik:wght@400;500;700;800", "Instrument Serif": "Instrument+Serif:ital@0;1", "Young Serif": "Young+Serif",
  "Josefin Sans": "Josefin+Sans:wght@400;600;700", "Poppins": "Poppins:wght@400;500;600;800",
  "Manrope": "Manrope:wght@400;500;600;700;800", "Instrument Sans": "Instrument+Sans:wght@400;500;600;700", "IBM Plex Sans": "IBM+Plex+Sans:wght@400;500;600;700", "DM Sans": "DM+Sans:wght@400;500;700",
  "Work Sans": "Work+Sans:wght@400;500;600;700", "Inter": "Inter:wght@400;500;600;700;800", "Nunito Sans": "Nunito+Sans:wght@400;600;700", "Karla": "Karla:wght@400;500;700",
  "Lora": "Lora:ital,wght@0,400;0,500;0,600;0,700;1,400", "Source Serif 4": "Source+Serif+4:wght@400;600;700", "Figtree": "Figtree:wght@400;500;600;700", "Plus Jakarta Sans": "Plus+Jakarta+Sans:wght@400;500;600;700;800",
  "Space Mono": "Space+Mono:wght@400;700", "JetBrains Mono": "JetBrains+Mono:wght@400;500;700", "Mulish": "Mulish:wght@400;600;700",
  "Marcellus": "Marcellus", "Cinzel": "Cinzel:wght@400;600;800", "Abril Fatface": "Abril+Fatface", "Yeseva One": "Yeseva+One", "Prata": "Prata", "Italiana": "Italiana",
  "Philosopher": "Philosopher:ital,wght@0,400;0,700;1,400", "Alfa Slab One": "Alfa+Slab+One", "Righteous": "Righteous", "Quicksand": "Quicksand:wght@400;500;700", "Jost": "Jost:wght@400;500;700", "Raleway": "Raleway:wght@400;500;700",
  "Caveat": "Caveat:wght@500;700", "Cormorant Infant": "Cormorant+Infant:ital,wght@0,400;0,600;1,400", "Bodoni Moda": "Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,600;0,6..96,800;1,6..96,400", "Spectral": "Spectral:ital,wght@0,400;0,600;1,400",
};

/* Line icons (24px grid, stroke = currentColor). Generic drawings. */
const ICONS = {
  cutlery: '<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 3c-2 1.5-3 4-3 7 0 1.5 1 2.5 3 2.5V21M17 3v9.5"/>',
  flame: '<path d="M12 21c3.9 0 6.5-2.6 6.5-6.2 0-3-2-4.8-3-7.3-.6 1.5-1.3 2.4-2.5 3 .3-2.8-.7-5.3-3-7.5 0 3.5-4.5 6-4.5 11.300C5.5 18.3 8.1 21 12 21z"/><path d="M12 21c-1.7 0-2.8-1.2-2.8-2.8 0-1.5 1.1-2.4 2.8-4.2 1.7 1.8 2.8 2.7 2.8 4.2 0 1.6-1.1 2.8-2.8 2.800z"/>',
  leaf: '<path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15M5 19 13 11"/>',
  bowl: '<path d="M3 11h18c0 5-3.5 8.5-9 8.500S3 16 3 11zM8 19.5 7 21.500h10l-1-2M8.5 7.500c0-1.3 1.5-1.3 1.5-2.700M12.5 7.500c0-1.3 1.5-1.3 1.5-2.7"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.500s5.7 1.9 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.500c2.4 0 4 1.5 4.6 4.5"/>',
  cup: '<path d="M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6zM17 10.500h1.500a2.5 2.5 0 0 1 0 5H16.700M8 3.500c0 1.2 1.3 1.2 1.3 2.500M12 3.500c0 1.2 1.3 1.2 1.3 2.5"/>',
  glass: '<path d="M7 3h10l-.8 6.500a4.2 4.2 0 0 1-8.4 0zM12 13.700V21M8.5 21h7M7.5 7.500h9"/>',
  cake: '<path d="M4 20v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7zM2.5 20h19M4 15.500c1.3 1.2 2.7 1.2 4 0s2.7-1.2 4 0 2.7 1.2 4 0 2.7-1.2 4 0M12 11V7.500M12 5.200v.01"/>',
  pizza: '<path d="M12 21 3.5 6.500C8.8 3.2 15.2 3.2 20.5 6.500zM5.2 9.300c4.3-2.4 9.3-2.4 13.6 0M10 12v.01M14 13.500v.01M12 16.500v.01"/>',
  fish: '<path d="M3 12c3-4.5 6.5-6 10.5-6 3 0 5.5 2 7.5 6-2 4-4.5 6-7.5 6-4 0-7.5-1.5-10.5-6zM3 12l-1 4M3 12 2 8M16.5 11v.01M9.5 8c1.5 2.5 1.5 5.5 0 8"/>',
  hat: '<path d="M7 14.500A4.2 4.2 0 0 1 7.5 6.200a4.8 4.8 0 0 1 9 0 4.2 4.2 0 0 1 .5 8.300V20H7zM7 17h10"/>',
  truck: '<path d="M2.5 6.500h11v10h-11zM13.5 10h4l3 3.500v3h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>',
  bag: '<path d="M5 8h14l-1 13H6zM9 8V6.500a3 3 0 0 1 6 0V8"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17.500h.01M12 17.500h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  pin: '<path d="M12 21.500s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10.5" r="2.5"/>',
  phone: '<path d="M5 4h4l1.5 4.5-2.2 1.500a11 11 0 0 0 5.7 5.700l1.5-2.200L20 15v4c0 1-1 2-2 2C10.8 20.5 3.5 13.2 3 6c0-1 1-2 2-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6.500L20.5 7"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.800z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.600A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  music: '<path d="M9 18V5.500l11-2V16M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM20 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.500a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0M12 19.500v.01"/>',
  car: '<path d="M4 16.500v-4l2-5.500h12l2 5.500v4zM4 12.500h16M6.5 16.500V19M17.5 16.500V19M7.5 14.500v.01M16.5 14.500v.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.500v2.500M12 19v2.500M2.5 12H5M19 12h2.500M5.3 5.3 7 7M17 17l1.7 1.700M5.3 18.7 7 17M17 7l1.7-1.7"/>',
  paw: '<path d="M12 20c-3 0-5-1.5-5-3.5 0-2.5 3-4.5 5-4.500s5 2 5 4.500c0 2-2 3.5-5 3.500zM6 11.500a1.8 2.2 0 1 0 0-.01M18 11.500a1.8 2.2 0 1 0 0-.01M9.5 7a1.7 2.2 0 1 0 0-.01M14.5 7a1.7 2.2 0 1 0 0-.01"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.500M15.5 15.5 18 18M6 18l2.5-2.500M15.5 8.5 18 6"/>',
  gift: '<rect x="3.5" y="9" width="17" height="4"/><path d="M5 13v7.500h14V13M12 9v11.500M12 9c-2.5 0-4.5-1-4.5-3s3-2.5 4.5 3zM12 9c2.5 0 4.5-1 4.5-3s-3-2.5-4.5 3z"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
};
const icon = (k, cls = "ic") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ICONS.cutlery}</svg>`;

/* Ornaments: small drawings beside section titles, in the menu and in the hero's stamp (theme.ornament). */
const ORN = {
  flourish: '<path d="M4 12h30c8 0 10-7 16-7s6 7 10 7 4-7 10-7 8 7 16 7h30M54 16c2 2 4 3 6 3s4-1 6-3"/>',
  cutlery: '<path d="M4 12h38M78 12h38M54 4v6a3 3 0 0 0 6 0V4M57 10v10M66 4c-2 2-3 4-3 7 0 1.5 1 2 3 2v7M66 4v9"/>',
  leaf: '<path d="M4 12h36M80 12h36M48 12c4-7 12-7 12 0-4 7-12 7-12 0zM60 12c4-7 12-7 12 0-4 7-12 7-12 0zM46 12h28"/>',
  star: '<path d="M4 12h38M78 12h38M60 4l2.3 5.2 5.7.6-4.2 3.9 1.2 5.6-5-2.9-5 2.9 1.2-5.6-4.2-3.9 5.7-.600zM47 12h.01M73 12h.01"/>',
  wheat: '<path d="M4 12h34M82 12h34M44 12h32M50 12c0-3 2-5 5-5 0 3-2 5-5 5zM50 12c0 3 2 5 5 5 0-3-2-5-5-5zM58 12c0-3 2-5 5-5 0 3-2 5-5 5zM58 12c0 3 2 5 5 5 0-3-2-5-5-5zM66 12c0-3 2-5 5-5 0 3-2 5-5 5zM66 12c0 3 2 5 5 5 0-3-2-5-5-5z"/>',
  dots: '<path d="M4 12h34M82 12h34M48 12h.01M54 12h.01M66 12h.01M72 12h.01"/><circle cx="60" cy="12" r="3"/>',
  diamond: '<path d="M4 12h36M80 12h36M60 5l7 7-7 7-7-7zM60 9l3 3-3 3-3-3zM46 12h.01M74 12h.01"/>',
  steam: '<path d="M4 16h36M80 16h36M48 19h24M51 19c0-4 2-5 9-5s9 1 9 5M56 11c0-2 2-2 2-4s-2-2-2-4M64 11c0-2 2-2 2-4s-2-2-2-4"/>',
  sun: '<path d="M4 12h34M82 12h34M60 6v-3M60 21v-3M51 12h-3M72 12h-3M53.6 5.600l-2-2M68.4 20.400l-2-2M53.6 18.400l-2 2M68.4 3.600l-2 2"/><circle cx="60" cy="12" r="4"/>',
};
const orn = (cls = "orn") => { const k = C.theme.ornament; return ORN[k] ? `<svg class="${cls}" viewBox="0 0 120 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ORN[k]}</svg>` : ""; };

/* ============================================================
   UTILITIES
   ============================================================ */
const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ml = (s) => esc(String(s ?? "").replace(/\r\n?/g, "\n").trim()).replace(/\n/g, "<br>");
/** *words* become highlighted. */
const rich = (s) => ml(s).replace(/\*([^*]+)\*/g, "<em>$1</em>");
const paras = (s) => String(s || "").split(/\n\s*\n/).filter((x) => x.trim()).map((p) => `<p>${rich(p.trim())}</p>`).join("");
const safeUrl = (u) => { u = String(u || "").trim(); return /^(https?:|mailto:|tel:)/i.test(u) ? u : ""; };
const slug = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "item";
const tel = (p) => "tel:" + String(p || "").replace(/[^\d+]/g, "");
function merge(def, val) {
  if (Array.isArray(def)) return Array.isArray(val) ? val : def;
  if (def && typeof def === "object") { const out = {}, v = val && typeof val === "object" && !Array.isArray(val) ? val : {}; for (const k of Object.keys(def)) out[k] = merge(def[k], v[k]); for (const k of Object.keys(v)) if (!(k in out)) out[k] = v[k]; return out; }
  return val === undefined ? def : val;
}
function hexRgb(h) { h = String(h || "#000").replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function lum(h) { const [r, g, b] = hexRgb(h).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; }
/** The text colour that reads best on a colour: white when it is clear enough, else near-black. */
const onColor = (h) => { const l = lum(h); return 1.05 / (l + .05) >= 4.5 || 1.05 / (l + .05) >= (l + .05) / .058 ? "#FFFFFF" : "#10141C"; };
const initials = (s) => String(s || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "•";
let ASSETS = {};
const HOST = (() => { try { const e = document.getElementById("site-host"); return e ? JSON.parse(e.textContent) : null; } catch (e) { return null; } })();
const hostPhoto = (p) => (HOST && /^assets\/uploads\//.test(p) ? HOST.assets + p.split("/").map(encodeURIComponent).join("/") : p);
const imgUrl = (img) => (!img ? "" : img.path ? ASSETS[img.path] || hostPhoto(img.path) : img.url || "");
let C = merge(DEFAULT, {});
const PAGE = document.body.dataset.page || "home";
const PREVIEW = window.name === "cms-preview" && window.parent !== window;
const PAGES = { home: "index.html", menu: "menu.html", about: "about.html", gallery: "gallery.html", contact: "contact.html", page: "page.html", order: "order.html", section: "section.html" };
/* Static pages (privacy, terms…): content.staticPages, shown by assets/pages.js at page.html?p=<name>. */
const spSlug = (p) => String(p.slug || p.title || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || p.id || "";
const spList = () => (C.staticPages || []).filter((p) => p && p.show !== false && String(p.title || "").trim() && spSlug(p));
const spHref = (p) => PAGES.page + "?p=" + encodeURIComponent(spSlug(p));
const spCur = () => { try { return new URLSearchParams(location.search).get("p") || ""; } catch (e) { return ""; } };
/** Which sections each page shows when the site has several pages (home follows the section order). */
const PAGE_SECTIONS = {
  home: ["hero", "highlights", "about", "specials", "food", "offers", "gallery", "testimonials", "press", "order", "cta"],
  menu: ["food", "offers", "order", "cta"],
  about: ["about", "highlights", "chef", "events", "press", "testimonials", "cta"],
  gallery: ["gallery", "cta"],
  contact: ["reserve", "contact", "faq"],
};
/** The page a section lives on in several-page mode. */
const HOME_OF = { food: "menu", order: "menu", about: "about", chef: "about", events: "about", gallery: "gallery", reserve: "contact", contact: "contact", faq: "contact" };
const multi = () => !!C.site.multiPage;
/** On a one-page site, a section whose link in the owner's own menu has "Open in a new tab" on gets a page of its own
    (section.html?s=<id>) and leaves the main page. */
function soloSections() {
  const out = new Set(); if (multi() || !(C.menu && C.menu.custom)) return out;
  const walk = (L) => (L || []).forEach((i) => { if (!i || i.show === false) return; if (i.newTab && i.to && i.to !== "hero" && RENDER[i.to] && shown(i.to)) out.add(i.to); walk(i.children); });
  walk(C.menu.items); return out;
}
const soloCur = () => { try { return new URLSearchParams(location.search).get("s") || ""; } catch (e) { return ""; } };
const soloHref = (id) => PAGES.section + "?s=" + encodeURIComponent(id);
/** The Order now page is on, and there is a menu to order from. */
const orderOn = () => !!(C.ordering && C.ordering.on) && cats().some((c) => c.items.some((d) => !d.noOrder));
/** On one-page sites, section links from other pages go back to the home page. */
const AT = PAGE === "home" ? "" : PAGES.home;
const shown = (id) => { const s = C.sections.find((x) => x.id === id); return !s || s.show !== false; };
/** A link to a section: an anchor on one page, or its page when the site has several. */
function href(id) {
  if (!id) return "#top";
  // Without the booking form, "Book a table" links go to the address and phone instead.
  if (id === "reserve" && !(C.contact.form.enabled && shown("reserve"))) id = "contact";
  if (/^(https?:|mailto:|tel:)/i.test(id)) return id;
  if (id === "ordering") return orderOn() ? PAGES.order : href("food");
  if (!multi() && soloSections().has(id)) return soloHref(id);
  if (!multi()) return (PAGE === "home" ? "" : PAGES.home) + "#" + id;
  if (id === "hero" || id === "home") return PAGES.home;
  const pg = HOME_OF[id] || "home", own = { menu: "food", about: "about", gallery: "gallery" }[pg] === id;
  return PAGES[pg] + (own ? "" : "#" + id);
}
let toastT;
function toast(html) { let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); } t.innerHTML = html; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 3600); }

/* ============================================================
   THEME
   ============================================================ */
let MOTIF = "geometric";
function applyTheme(t) {
  const r = document.documentElement.style;
  r.background = t.bg; r.colorScheme = onColor(t.bg) === "#FFFFFF" ? "dark" : "light";
  if (!PREVIEW) try { localStorage.setItem("site-bg:" + location.pathname.replace(/[^/]*$/, ""), t.bg); } catch (e) {}
  ["bg", "surface", "deep", "text", "soft", "line", "c1", "c2", "c3"].forEach((k) => r.setProperty("--" + k, t[k]));
  ["c1", "c2", "c3", "deep", "surface"].forEach((k) => r.setProperty("--on-" + k, onColor(t[k])));
  r.setProperty("--ink0", t.text); r.setProperty("--soft0", t.soft); r.setProperty("--line0", t.line);
  const ib = t.introBg || t.deep; r.setProperty("--intro-bg", ib); r.setProperty("--intro-fg", t.introFg || onColor(ib));
  r.setProperty("--logo-r", Math.max(0, Math.min(50, t.logoRadius ?? 22)) + "%");
  r.setProperty("--r", (+t.radius || 0) + "px");
  r.setProperty("--fd", `"${t.fontDisplay}",Georgia,serif`); r.setProperty("--fb", `"${t.fontBody}","Helvetica Neue",Arial,sans-serif`);
  if (window.SiteFonts) { const cd = SiteFonts.use(t, "display", imgUrl), cb = SiteFonts.use(t, "body", imgUrl); if (cd) r.setProperty("--fd", `"${cd}","${t.fontDisplay}",Georgia,serif`); if (cb) r.setProperty("--fb", `"${cb}","${t.fontBody}","Helvetica Neue",Arial,sans-serif`); }
  const d = document.documentElement.dataset;
  for (const k of ["layout", "heroArt", "nav", "cards", "buttons", "motionStyle", "pattern", "heading", "shead", "width", "bands", "menuStyle", "divider", "ornament", "gallery", "cursor", "loader", "textfx", "hoverfx", "scrollfx", "overlay"]) d[k] = String(t[k] || "");
  d.scrollease = t.scrollEase || "light"; d.linebreaks = t.lineBreaks || "typed"; d.menu = String(t.navMode || ""); d.menumob = String(t.navModeMob || "");
  d.crumbs = (C.site || {}).crumbs === false ? "off" : "on"; d.introfont = t.introFont || "display"; d.introcase = t.introCase || "upper"; d.dark = String(onColor(t.bg) === "#FFFFFF");
  [[FONTS[t.fontDisplay], "fontlink"], [FONTS[t.fontBody], "fontlink2"]].forEach(([f, id]) => {
    let l = document.getElementById(id); if (!l) { l = document.createElement("link"); l.id = id; l.rel = "stylesheet"; document.head.appendChild(l); }
    const h = f ? "https://fonts.googleapis.com/css2?family=" + f + "&display=swap" : ""; if (h && l.getAttribute("href") !== h) l.setAttribute("href", h);
  });
  if (!PREVIEW) try { localStorage.setItem("site-fonts:" + location.pathname.replace(/[^/]*$/, ""), JSON.stringify(["fontlink", "fontlink2"].map((id) => [id, (document.getElementById(id) || {}).href || ""]))); } catch (e) {}
}
function setTitle() {
  const one = (x) => String(x || "").replace(/\s*\n\s*/g, " ").trim();
  const label = PAGE === "page" ? ((window.SitePages && window.SitePages.find(C, spCur(), PREVIEW)) || {}).title || "" : PAGE === "order" ? (C.ordering || {}).label || "Order now" : PAGE === "section" ? (C.sections.find((x) => x.id === soloCur()) || {}).label || "" : PAGE === "home" || !multi() ? "" : (C.site.pageLabels || {})[PAGE] || "";
  document.title = !label ? one(C.seo.title || C.brand.name) : one((C.seo.titlePattern || "{page} · {site}").replace(/\{page\}/g, label).replace(/\{site\}/g, one(C.brand.name)));
}

/* ============================================================
   OPENING HOURS
   ============================================================ */
const mins = (t) => { const m = /^\s*(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?\s*$/i.exec(String(t || "")); if (!m) return null; let h = +m[1]; const mm = +(m[2] || 0); if (m[3]) { h = (h % 12) + (/pm/i.test(m[3]) ? 12 : 0); } return h > 24 || mm > 59 ? null : h * 60 + mm; };
function fmtTime(t) {
  const n = mins(t); if (n == null) return String(t || "");
  const h = Math.floor(n / 60) % 24, m = n % 60;
  if (C.hours.format === "24") return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  return (h % 12 || 12) + (m ? ":" + String(m).padStart(2, "0") : "") + (h < 12 ? " am" : " pm");
}
/** A day's opening periods in minutes: [[open, close], …]; a close at or before the open runs past midnight. */
function periods(d) {
  if (!d || d.closed) return [];
  return [[d.open, d.close], [d.open2, d.close2]].map(([a, b]) => [mins(a), mins(b)]).filter(([a, b]) => a != null && b != null).map(([a, b]) => [a, b <= a ? b + 1440 : b]);
}
/** The restaurant's own clock (hours.utcOffset, e.g. +05:30), so a visitor elsewhere sees the right status. */
function clock() {
  const m = /^\s*([+-])(\d{1,2}):?(\d{2})?\s*$/.exec(String(C.hours.utcOffset || "")), off = m ? (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +(m[3] || 0)) : -new Date().getTimezoneOffset();
  const d = new Date(Date.now() + off * 60000);
  return { day: (d.getUTCDay() + 6) % 7, min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
/** { open, until | next: { day, at } } for right now. */
function openState() {
  const D = C.hours.days || [], { day, min } = clock();
  if (!D.length) return null;
  for (const [a, b] of periods(D[day])) if (min >= a && min < b) return { open: true, until: b % 1440 };
  for (const [, b] of periods(D[(day + 6) % 7])) if (b > 1440 && min < b - 1440) return { open: true, until: b - 1440 };
  for (let k = 0; k < 8; k++) { const i = (day + k) % 7, nx = periods(D[i]).map(([a]) => a).filter((a) => k > 0 || a > min).sort((x, y) => x - y)[0]; if (nx != null) return { open: false, next: { day: i, at: nx, k } }; }
  return { open: false };
}
const hhmm = (n) => String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
function statusChip() {
  const H = C.hours; if (H.showStatus === false) return "";
  const s = openState(); if (!s) return "";
  const D = H.days || [];
  const more = s.open ? `Closes ${fmtTime(hhmm(s.until))}` : s.next ? `Opens ${s.next.k === 0 ? "" : s.next.k === 1 ? "tomorrow " : esc((D[s.next.day] || {}).day || "") + " "}${fmtTime(hhmm(s.next.at))}` : "";
  return `<span class="ostat ${s.open ? "on" : "off"}"><i aria-hidden="true"></i><b>${esc(s.open ? H.openLabel || "Open now" : H.closedLabel || "Closed now")}</b>${more ? `<span>${more}</span>` : ""}</span>`;
}
function hoursTable() {
  const H = C.hours, D = (H.days || []).filter((d) => d && d.day), today = clock().day;
  if (!D.length) return "";
  const line = (d) => { const p = [[d.open, d.close], [d.open2, d.close2]].filter(([a, b]) => mins(a) != null && mins(b) != null); return d.closed || !p.length ? `<span class="closed">Closed</span>` : p.map(([a, b]) => `${fmtTime(a)} – ${fmtTime(b)}`).join(`<br>`); };
  return `<table class="hours"><caption class="vh">${esc(H.title || "Opening hours")}</caption><tbody>${D.map((d, i) => `<tr${(H.days || []).indexOf(d) === today ? ' class="today"' : ""}><th scope="row">${esc(d.day)} ${(H.days || []).indexOf(d) === today ? `<span class="tod">Today</span>` : ""}</th><td>${line(d)}</td></tr>`).join("")}</tbody></table>${H.note ? `<p class="hours-n">${rich(H.note)}</p>` : ""}`;
}

/* ============================================================
   SECTIONS
   ============================================================ */
const head = (s, cls = "") => (s.eyebrow || s.title || s.lede) ? `<header class="sh ${cls}">${orn()}${s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : ""}${s.title ? `<h2 class="h2">${rich(s.title)}</h2>` : ""}${s.lede ? `<p class="lede">${rich(s.lede)}</p>` : ""}</header>` : "";
const btn = (label, to, kind = "pri") => label ? `<a class="btn ${kind}" href="${esc(href(to))}">${esc(label)}</a>` : "";
const arrow = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
/** A picture's place when there is none: the theme's colours with the name's initials. */
const ph = (name) => `<span class="ph" aria-hidden="true"><b>${esc(initials(name))}</b></span>`;
const DIET = { veg: "Vegetarian", nonveg: "Non-vegetarian", egg: "Contains egg", vegan: "Vegan" };
const dietMark = (d) => (DIET[d] && C.food.dietMarks !== false ? `<span class="diet ${d}" role="img" aria-label="${DIET[d]}" title="${DIET[d]}"></span>` : "");
/** A price as written, with the menu's currency sign in front of a bare number. */
const money = (p) => { p = String(p ?? "").trim(); return !p ? "" : /^\d[\d,]*(\.\d+)?$/.test(p) ? (C.food.currency || "") + p : p; };

/** Without a hero picture: a round stamp drawn in the theme's colours (the restaurant's own line around a plate). */
function heroStamp() {
  const H = C.hero, t = String(H.stamp || C.brand.tagline || C.brand.name || "").replace(/\s+/g, " ").trim().toUpperCase();
  const ring = t ? (t + " · ").repeat(Math.max(1, Math.ceil(64 / (t.length + 3)))) : "";
  return `<div class="stamp" aria-hidden="true"><svg viewBox="0 0 300 300"><defs><path id="st-c" d="M150 150m-118 0a118 118 0 1 1 236 0a118 118 0 1 1-236 0"/></defs>
    <circle class="st-plate" cx="150" cy="150" r="146"/><circle class="st-ring" cx="150" cy="150" r="134"/><circle class="st-rim" cx="150" cy="150" r="96"/><circle class="st-in" cx="150" cy="150" r="86"/>
    <text class="st-t"><textPath href="#st-c" startOffset="0" textLength="738" lengthAdjust="spacing">${esc(ring)}</textPath></text>
    <text class="st-b" x="150" y="${C.theme.ornament === "none" ? 168 : 158}" text-anchor="middle">${esc(initials(C.brand.name))}</text></svg>${orn("orn st-o")}</div>`;
}
/** Without a hero picture: an emblem drawn from the restaurant's own name, in the theme's colours.
    The Picture frame setting chooses which one, so every frame shows with or without a photo. */
function heroEmblem() {
  const H = C.hero, T = C.theme, art = T.heroArt || "default";
  if (art === "circle") return heroStamp();
  const name = String(C.brand.name || "").replace(/\s+/g, " ").trim(), ini = esc(initials(name));
  const line = String(H.stamp || C.brand.tagline || "").replace(/\s+/g, " ").trim();
  const o = orn("orn emb-o"), nm = `<span class="emb-name">${esc(name)}</span>`, ln = line ? `<span class="emb-line">${esc(line)}</span>` : "";
  const wrap = (k, inner) => `<div class="emb emb-${k}" aria-hidden="true"><div class="emb-b">${inner}</div></div>`;
  if (art === "arch") return wrap("arch", `${o}<b class="emb-ini">${ini}</b>${nm}${ln}`);
  if (art === "frame") return wrap("frame", `${ln}${nm}${o || '<i class="emb-rule"></i>'}<b class="emb-ini">${ini}</b>`);
  if (art === "offset") return wrap("offset", `${nm}<b class="emb-ini">${ini}</b>${ln}`);
  if (art === "blob") return wrap("blob", `<b class="emb-ini">${ini}</b>${o}${ln || nm}`);
  if (art === "tilt") {
    // A small printed card of what is on today: the specials, or else the first dishes on the menu.
    const sp = (C.specials.items || []).filter((x) => x && x.name), all = sp.length ? sp : (C.food.categories || []).flatMap((k) => k.items || []).filter((x) => x && x.name);
    const rows = all.slice(0, 4).map((x) => `<li><span>${esc(x.name)}</span><i></i>${x.price ? `<b>${esc(money(x.price))}</b>` : ""}</li>`).join("");
    return wrap("tilt", `<span class="emb-line">${esc((sp.length ? C.specials.eyebrow || C.specials.title : C.food.eyebrow || C.food.title) || "Menu")}</span>${o || '<i class="emb-rule"></i>'}${rows ? `<ul class="emb-rows">${rows}</ul>` : `<b class="emb-ini">${ini}</b>`}${nm}`);
  }
  if (art === "stamp") {
    // A scalloped seal: a disc edged with small half-circles, the line running round the top.
    const n = 30, sc = Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return `<circle cx="${(150 + 132 * Math.cos(a)).toFixed(1)}" cy="${(150 + 132 * Math.sin(a)).toFixed(1)}" r="15"/>`; }).join("");
    const t = (line || name).toUpperCase(), ring = t ? (t + " · ").repeat(Math.max(1, Math.ceil(54 / (t.length + 3)))) : "";
    return `<div class="emb emb-seal" aria-hidden="true"><svg viewBox="0 0 300 300"><defs><path id="sl-c" d="M150 150m-100 0a100 100 0 1 1 200 0a100 100 0 1 1-200 0"/></defs>
      <g class="sl-disc">${sc}<circle cx="150" cy="150" r="132"/></g><circle class="sl-ring" cx="150" cy="150" r="118"/><circle class="sl-ring2" cx="150" cy="150" r="78"/>
      <text class="sl-t"><textPath href="#sl-c" startOffset="0" textLength="626" lengthAdjust="spacing">${esc(ring)}</textPath></text>
      <text class="sl-b" x="150" y="${T.ornament === "none" ? 170 : 160}" text-anchor="middle">${ini}</text></svg>${orn("orn sl-o")}</div>`;
  }
  // Plain: a plate set with a fork and a knife, the initials in the middle.
  return `<div class="emb emb-plate" aria-hidden="true"><svg viewBox="0 0 400 300"><circle class="pl-a" cx="200" cy="150" r="128"/><circle class="pl-b" cx="200" cy="150" r="92"/><circle class="pl-c" cx="200" cy="150" r="84"/>
    <g class="pl-k"><path d="M28 62v54a12 12 0 0 0 24 0V62M40 62v176M40 128v0"/><path d="M360 238V62c-16 14-22 46-18 84h18"/></g>
    <text class="pl-t" x="200" y="${line ? 162 : 172}" text-anchor="middle">${ini}</text>${line ? `<text class="pl-l" x="200" y="192" text-anchor="middle" textLength="${Math.min(128, line.length * 7.2).toFixed(0)}" lengthAdjust="spacingAndGlyphs">${esc(line.toUpperCase().slice(0, 26))}</text>` : ""}</svg></div>`;
}
function heroHTML() {
  const H = C.hero, T = C.theme, vid = imgUrl(H.video), im = imgUrl(H.image);
  // A hero video plays silently on a loop in the picture's place (the picture is its cover); still for visitors who asked for less motion.
  const film = vid ? `<video src="${esc(vid)}"${im ? ` poster="${esc(im)}"` : ""}${matchMedia("(prefers-reduced-motion: reduce)").matches ? "" : " autoplay"} muted loop playsinline aria-hidden="true"></video>` : "";
  const more = (Array.isArray(H.images) ? H.images : []).map(imgUrl).filter(Boolean).slice(0, 2);
  const collage = T.layout === "collage" && im && more.length && !vid;
  const media = vid ? `<div class="hero-media" data-edit="hero.video">${film}</div>`
    : collage ? `<div class="hero-media col n${more.length + 1}" data-edit="hero.images"><img src="${esc(im)}" alt="">${more.map((u) => `<img src="${esc(u)}" alt="">`).join("")}</div>`
    : im ? `<div class="hero-media" data-edit="hero.image"><img src="${esc(im)}" alt=""></div>` : `<div class="hero-media none" data-edit="hero.stamp">${heroEmblem()}</div>`;
  const badges = (H.badges || []).filter(Boolean).length ? `<ul class="badges">${H.badges.filter(Boolean).map((b) => `<li>${icon("star", "bi")}${esc(b)}</li>`).join("")}</ul>` : "";
  const pic = im || vid, bg = (T.layout === "full" || T.layout === "framed") && pic;
  return `<section class="hero${pic ? " has-img" : " no-img"}" id="hero">${bg ? `<div class="hero-bg" data-edit="${vid ? "hero.video" : "hero.image"}"${im ? ` style="background-image:url('${esc(im)}')"` : ""}>${film}</div>` : ""}
    <div class="wrap hero-in"><div class="hero-text">${H.showStatus !== false ? statusChip() : ""}${H.eyebrow ? `<p class="eyebrow">${esc(H.eyebrow)}</p>` : ""}<h1 class="h1 fit">${rich(H.title)}</h1>${H.lede ? `<p class="hero-lede">${rich(H.lede)}</p>` : ""}
      <div class="cta-row">${btn(H.ctaPrimary, H.ctaPrimaryTarget)}${btn(H.ctaSecondary, H.ctaSecondaryTarget, "sec")}</div>${badges}</div>
      ${bg ? "" : media}</div></section>`;
}
function highlightsHTML() {
  const I = (C.highlights.items || []).filter((x) => x && (x.title || x.body));
  if (!I.length) return "";
  return `<section class="highlights" id="highlights"><div class="wrap"><ul class="hl">${I.map((x, i) => `<li class="hl-i rv" style="--i:${i}"><span class="hl-ic">${icon(x.icon)}</span><div><h2 class="h3">${esc(x.title)}</h2>${x.body ? `<p>${rich(x.body)}</p>` : ""}</div></li>`).join("")}</ul></div></section>`;
}
function aboutHTML() {
  const A = C.about, im = imgUrl(A.image), F = (A.facts || []).filter((f) => f && (f.value || f.label));
  return `<section class="about band" id="about"><div class="wrap"><div class="about-grid${im ? "" : " solo"}">
      <div class="about-text">${head(A, "left")}<div class="prose">${paras(A.body)}</div>${A.signature ? `<p class="sig">${esc(A.signature)}</p>` : ""}
        ${F.length ? `<dl class="facts">${F.map((f) => `<div><dd>${esc(f.value)}</dd><dt>${esc(f.label)}</dt></div>`).join("")}</dl>` : ""}</div>
      ${im ? `<div class="about-side"><div class="about-img" data-edit="about.image"><img src="${esc(im)}" alt="" loading="lazy"></div></div>` : ""}</div></div></section>`;
}
function specialsHTML() {
  const S = C.specials, I = (S.items || []).filter((x) => x && x.name);
  if (!I.length) return "";
  return `<section class="specials" id="specials"><div class="wrap">${head(S)}<div class="sp-grid">${I.map((x, i) => { const im = imgUrl(x.image); return `<article class="card sp rv" style="--i:${i}">
      <div class="sp-media">${im ? `<button type="button" class="zoom" data-zoom="${esc(im)}" data-cap="${esc(x.name)}" aria-label="Photo of ${esc(x.name)}"><img src="${esc(im)}" alt="" loading="lazy"></button>` : ph(x.name)}${x.tag ? `<span class="sp-tag">${esc(x.tag)}</span>` : ""}</div>
      <div class="sp-body"><h3 class="h3">${dietMark(x.diet)}${esc(x.name)}</h3>${x.desc ? `<p>${rich(x.desc)}</p>` : ""}${x.price ? `<p class="sp-price">${esc(money(x.price))}</p>` : ""}</div></article>`; }).join("")}</div></div></section>`;
}
/* ---------- The menu: categories of dishes, with search, diet filters and a jump bar. ---------- */
const cats = () => (C.food.categories || []).filter((c) => c && (c.name || "").trim()).map((c, i) => ({ ...c, id: "mc-" + slug(c.name) + "-" + i, items: (c.items || []).filter((d) => d && (d.name || "").trim()) })).filter((c) => c.items.length);
function dishHTML(d) {
  const F = C.food, im = F.photos !== false ? imgUrl(d.image) : "", V = (d.variants || []).filter((v) => v && (v.label || v.price));
  const sp = Math.max(0, Math.min(3, +d.spice || 0));
  const extra = [sp ? `<span class="spice" role="img" aria-label="Spice level ${sp} of 3" title="Spice level ${sp} of 3">${`<i></i>`.repeat(sp)}</span>` : "", d.allergens ? `<span class="alg">Contains: ${esc(d.allergens)}</span>` : ""].filter(Boolean).join("");
  return `<li class="dish${im ? " has-img" : ""}${d.soldOut ? " sold" : ""}" data-diet="${esc(d.diet || "")}" data-q="${esc(((d.name || "") + " " + (d.desc || "") + " " + (d.tag || "")).toLowerCase())}">
      ${im ? `<button type="button" class="dish-pic zoom" data-zoom="${esc(im)}" data-cap="${esc(d.name)}" aria-label="Photo of ${esc(d.name)}"><img src="${esc(im)}" alt="" loading="lazy"></button>` : `<span class="dish-pic none" aria-hidden="true">${ph(d.name)}</span>`}
      <div class="dish-main"><div class="dish-top"><h4 class="dish-n">${dietMark(d.diet)}<span>${esc(d.name)}</span>${d.tag ? `<em class="dtag">${esc(d.tag)}</em>` : ""}${d.soldOut ? `<em class="dtag out">Sold out</em>` : ""}</h4><span class="dish-dots" aria-hidden="true"></span>${d.price && !V.length ? `<span class="dish-p">${esc(money(d.price))}</span>` : ""}</div>
        ${d.desc ? `<p class="dish-d">${rich(d.desc)}</p>` : ""}${V.length ? `<ul class="dish-v">${V.map((v) => `<li><span>${esc(v.label)}</span><b>${esc(money(v.price))}</b></li>`).join("")}</ul>` : ""}${extra ? `<p class="dish-x">${extra}</p>` : ""}</div></li>`;
}
function foodHTML() {
  const F = C.food, all = cats();
  if (!all.length) return "";
  const full = PAGE === "menu" || !multi(), L = full ? all : all.slice(0, Math.max(1, +F.homeCount || 3));
  const diets = [...new Set(all.flatMap((c) => c.items.map((d) => d.diet)).filter((d) => DIET[d]))];
  const tools = full ? `<div class="mtools">
      ${F.search !== false && all.reduce((n, c) => n + c.items.length, 0) > 8 ? `<label class="msearch"><span class="vh">Search the menu</span>${icon("search", "ms-ic")}<input type="search" id="menu-q" placeholder="Search the menu" autocomplete="off"></label>` : ""}
      ${F.filters !== false && diets.length > 1 ? `<div class="chips mdiet" role="group" aria-label="Filter by diet"><button type="button" class="chip" aria-pressed="true" data-diet="">All</button>${["veg", "vegan", "egg", "nonveg"].filter((d) => diets.includes(d)).map((d) => `<button type="button" class="chip" aria-pressed="false" data-diet="${d}"><span class="diet ${d}" aria-hidden="true"></span>${DIET[d]}</button>`).join("")}</div>` : ""}
      ${orderOn() ? `<a class="btn pri morder" href="${PAGES.order}">${icon("bag", "ic")}${esc(C.ordering.label || "Order now")}</a>` : ""}
      ${safeUrl(F.pdfUrl) ? `<a class="link mpdf" href="${esc(safeUrl(F.pdfUrl))}" target="_blank" rel="noopener">${esc(F.pdfLabel || "Download the menu")} ${arrow}</a>` : ""}</div>` : "";
  const jump = L.length > 1 ? `<nav class="mcats" aria-label="Menu sections"><div class="mcats-in">${L.map((c, i) => `<a href="#${c.id}" data-cat="${c.id}"${i === 0 ? ' class="on"' : ""}>${esc(c.name)}</a>`).join("")}</div></nav>` : "";
  return `<section class="food band" id="food"><div class="wrap">${head(F)}${tools}${jump}<div class="mbody">${L.map((c, i) => { const im = imgUrl(c.image); return `<section class="mcat${i === 0 ? " on" : ""}${im ? " has-img" : ""}" id="${c.id}" aria-label="${esc(c.name)}">
        <header class="mcat-h">${im ? `<div class="mcat-img"><img src="${esc(im)}" alt="" loading="lazy"></div>` : ""}<h3 class="mcat-t">${esc(c.name)}</h3>${c.note ? `<p class="mcat-n">${rich(c.note)}</p>` : ""}${orn("orn mcat-o")}</header>
        <ul class="dishes">${c.items.map(dishHTML).join("")}</ul></section>`; }).join("")}<p class="mnone" hidden>No dishes match. Try another word or filter.</p></div>
    ${F.note && full ? `<p class="mnote">${rich(F.note)}</p>` : ""}
    ${!full && all.length ? `<p class="more center"><a class="btn sec" href="${PAGES.menu}">${esc(F.all || "See the full menu")} ${arrow}</a></p>` : ""}</div></section>`;
}
function offersHTML() {
  const O = C.offers, I = (O.items || []).filter((x) => x && x.title);
  if (!I.length) return "";
  return `<section class="offers" id="offers"><div class="wrap">${head(O)}<div class="of-grid">${I.map((x, i) => { const im = imgUrl(x.image); return `<article class="offer rv${im ? " has-img" : ""}" style="--i:${i}">${im ? `<div class="of-img"><img src="${esc(im)}" alt="" loading="lazy"></div>` : ""}
      <div class="of-main"><h3 class="h3">${esc(x.title)}</h3>${x.body ? `<p>${rich(x.body)}</p>` : ""}${x.when ? `<p class="of-when">${icon("clock", "of-ic")}${esc(x.when)}</p>` : ""}</div>
      <div class="of-side">${x.price ? `<b class="of-price">${esc(x.price)}</b>` : ""}${x.code ? `<button type="button" class="of-code" data-copy="${esc(x.code)}" aria-label="Copy the code ${esc(x.code)}"><small>Code</small>${esc(x.code)}</button>` : ""}</div></article>`; }).join("")}</div></div></section>`;
}
const galleryItems = () => (C.gallery.items || []).map((g) => ({ src: imgUrl(g && g.image), cap: (g && g.caption) || "" })).filter((g) => g.src);
function galleryHTML() {
  const G = C.gallery, all = galleryItems();
  if (!all.length) return PREVIEW ? `<section class="gallery band" id="gallery"><div class="wrap">${head(G)}<p class="empty" data-edit="gallery.items">Add photos under Gallery and they show here.</p></div></section>` : "";
  const full = PAGE === "gallery" || !multi(), L = full ? all : all.slice(0, Math.max(1, +G.homeCount || 6));
  return `<section class="gallery band" id="gallery"><div class="wrap">${head(G)}<div class="gal">${L.map((g, i) => `<button type="button" class="gal-i zoom rv" style="--i:${i % 8}" data-zoom="${esc(g.src)}" data-cap="${esc(g.cap)}" data-set="gallery" aria-label="${esc(g.cap || "Photo " + (i + 1))}"><img src="${esc(g.src)}" alt="${esc(g.cap)}" loading="lazy">${g.cap ? `<span class="gal-c">${esc(g.cap)}</span>` : ""}</button>`).join("")}</div>
    ${!full && all.length > L.length ? `<p class="more center"><a class="btn sec" href="${PAGES.gallery}">${esc(G.all || "See all photos")} ${arrow}</a></p>` : ""}</div></section>`;
}
function chefHTML() {
  const T = C.chef, M = (T.members || []).filter((m) => m && m.name);
  if (!M.length) return "";
  return `<section class="team" id="chef"><div class="wrap">${head(T)}<div class="people${M.length < 3 ? " few" : ""}">${M.map((m, i) => { const p = imgUrl(m.photo); return `<article class="person rv" style="--i:${i}"><div class="pp">${p ? `<img src="${esc(p)}" alt="${esc(m.name)}" loading="lazy">` : `<span>${esc(initials(m.name))}</span>`}</div><div><h3 class="h3">${esc(m.name)}</h3><p class="role">${esc(m.role)}</p>${m.bio ? `<p class="bio">${rich(m.bio)}</p>` : ""}</div></article>`; }).join("")}</div></div></section>`;
}
function eventsHTML() {
  const E = C.events, I = (E.items || []).filter((x) => x && x.title);
  if (!I.length) return "";
  const to = href("reserve"), q = E.type ? (to.includes("#") ? to.replace("#", "?type=" + encodeURIComponent(E.type) + "#") : to + "?type=" + encodeURIComponent(E.type)) : to;
  return `<section class="events band" id="events"><div class="wrap">${head(E)}<div class="ev-grid">${I.map((x, i) => `<article class="card ev rv" style="--i:${i}"><span class="svc-ic">${icon(x.icon)}</span><h3 class="h3">${esc(x.title)}</h3>${x.body ? `<p>${rich(x.body)}</p>` : ""}</article>`).join("")}</div>
    ${E.button && shown("reserve") && C.contact.form.enabled ? `<p class="more center"><a class="btn pri" href="${esc(q)}" data-type="${esc(E.type || "")}">${esc(E.button)}</a></p>` : ""}</div></section>`;
}
function pressHTML() {
  const L = (C.press.logos || []).filter((l) => l && (l.name || l.logo));
  if (!L.length) return "";
  return `<section class="clients" id="press"><div class="wrap">${C.press.title ? `<p class="clients-t">${esc(C.press.title)}</p>` : ""}<ul class="logos">${L.map((l) => `<li title="${esc(l.name)}">${l.logo ? `<img src="${esc(imgUrl(l.logo))}" alt="${esc(l.name)}">` : `<span>${esc(l.name)}</span>`}</li>`).join("")}</ul></div></section>`;
}
/** Five stars, filled up to the rating. */
const starRow = (n) => { const r = Math.max(0, Math.min(5, Math.round(+n || 0))); return "★".repeat(r) + `<span class="off">${"★".repeat(5 - r)}</span>`; };
function testimonialsHTML() {
  const T = C.testimonials;
  if (!T.items.length) return "";
  const G = T.google && T.google.rating && T.items.some((q) => q.source === "google") ? T.google : null;
  return `<section class="testimonials band" id="testimonials"><div class="wrap">${head(T)}${G ? `<p class="g-sum"><a href="${esc(G.url || "#")}" target="_blank" rel="noopener"><span class="stars" aria-hidden="true">${starRow(G.rating)}</span> <b>${(+G.rating).toFixed(1)}</b> from ${esc(String(G.count))} reviews on Google</a></p>` : ""}<div class="quotes">${T.items.map((q, i) => `<figure class="card quote rv" style="--i:${i}"><span class="qm" aria-hidden="true">“</span>${q.rating ? `<span class="stars" role="img" aria-label="${+q.rating} out of 5 stars">${starRow(q.rating)}</span>` : ""}<blockquote>${rich(q.quote)}</blockquote>
      <figcaption><span class="qa">${esc(initials(q.name))}</span><span><b>${esc(q.name)}</b><small>${[q.role, q.company].filter(Boolean).map(esc).join(", ")}</small></span></figcaption></figure>`).join("")}</div></div></section>`;
}
const waUrl = (text) => "https://wa.me/" + String(C.contact.whatsapp || "").replace(/\D/g, "") + (text ? "?text=" + encodeURIComponent(text) : "");
function orderHTML() {
  const O = C.order, K = C.contact, L = (O.links || []).filter((l) => l && l.label && safeUrl(l.url));
  const call = O.call !== false && K.phone, wa = O.whatsapp !== false && K.whatsapp;
  const own = orderOn();
  if (!L.length && !call && !wa && !own) return "";
  return `<section class="order" id="order"><div class="wrap"><div class="order-box">${head(O, "left")}<div class="order-acts">
      ${own ? `<a class="order-a own" href="${PAGES.order}">${icon("bag", "oa-ic")}<span><b>${esc(C.ordering.label || "Order now")}</b><small>${esc([C.ordering.modes.delivery ? "Delivery" : "", C.ordering.modes.pickup ? "Pickup" : "", C.ordering.modes.dinein ? "At the table" : ""].filter(Boolean).join(" · ") || "Order from our own menu")}</small></span>${arrow}</a>` : ""}
      ${L.map((l) => `<a class="order-a" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${icon("bag", "oa-ic")}<span><b>${esc(l.label)}</b>${l.note ? `<small>${esc(l.note)}</small>` : ""}</span>${arrow}</a>`).join("")}
      ${call ? `<a class="order-a" href="${esc(tel(K.phone))}">${icon("phone", "oa-ic")}<span><b>Call to order</b><small>${esc(K.phone)}</small></span>${arrow}</a>` : ""}
      ${wa ? `<a class="order-a" href="${esc(waUrl(O.whatsappText))}" target="_blank" rel="noopener">${icon("mail", "oa-ic")}<span><b>Order on WhatsApp</b><small>Send us your order</small></span>${arrow}</a>` : ""}</div></div></div></section>`;
}
function reserveHTML() {
  const R = C.reserve, F = C.contact.form;
  if (!F.enabled) return "";
  const field = (id, label, input, req) => `<label class="fld" for="f-${id}"><span>${esc(label)}${req ? ' <i aria-hidden="true">*</i>' : ""}</span>${input}</label>`;
  const max = Math.max(1, Math.min(40, +F.maxGuests || 10)), slots = (F.slots || []).filter(Boolean);
  const row = (a, b) => (a || b ? `<div class="row2">${a}${b}</div>` : "");
  const form = `<form class="card form" id="enquiry" novalidate>
      ${F.title ? `<h3 class="h3">${esc(F.title)}</h3>` : ""}
      ${F.askType !== false && (F.types || []).filter(Boolean).length > 1 ? field("type", "I'd like to", `<select id="f-type" name="type">${F.types.filter(Boolean).map((t) => `<option>${esc(t)}</option>`).join("")}</select>`) : ""}
      <div class="row2">${field("name", "Name", `<input id="f-name" name="name" required autocomplete="name">`, 1)}${field("phone", "Phone", `<input id="f-phone" name="phone" type="tel" required autocomplete="tel" inputmode="tel">`, 1)}</div>
      ${row(F.askDate !== false ? field("date", "Date", `<input id="f-date" name="date" type="date" required>`, 1) : "", F.askTime !== false ? field("time", "Time", slots.length ? `<select id="f-time" name="time" required><option value="">Choose…</option>${slots.map((s) => `<option value="${esc(s)}">${esc(fmtTime(s))}</option>`).join("")}</select>` : `<input id="f-time" name="time" type="time" required>`, 1) : "")}
      ${row(F.askGuests !== false ? field("guests", "Guests", `<select id="f-guests" name="guests" required>${Array.from({ length: max }, (_, i) => `<option${i === 1 ? " selected" : ""}>${i + 1}</option>`).join("")}<option>More than ${max}</option></select>`, 1) : "", F.askOccasion && (F.occasions || []).filter(Boolean).length ? field("occasion", "Occasion", `<select id="f-occasion" name="occasion"><option value="">None</option>${F.occasions.filter(Boolean).map((o) => `<option>${esc(o)}</option>`).join("")}</select>`) : "")}
      ${F.askEmail !== false ? field("email", "Email", `<input id="f-email" name="email" type="email" autocomplete="email">`) : ""}
      ${field("message", F.messageLabel || "Anything we should know?", `<textarea id="f-message" name="message" rows="3"></textarea>`)}
      <input class="hp-f" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      ${F.consent ? `<label class="consent"><input type="checkbox" name="consent" required> <span>${esc(F.consent)}</span></label>` : ""}
      <p class="form-msg" role="status" aria-live="polite"></p>
      <button class="btn pri" type="submit">${esc(F.submit || "Send")} ${arrow}</button></form>`;
  const K = C.contact;
  return `<section class="reserve band" id="reserve"><div class="wrap"><div class="rs-grid"><div class="rs-side">${head(R, "left")}${R.note ? `<p class="rs-note">${rich(R.note)}</p>` : ""}
      ${K.phone ? `<p class="rs-call"><a class="link" href="${esc(tel(K.phone))}">${icon("phone", "ci2")}${esc(K.phone)}</a></p>` : ""}${C.hours.showStatus !== false ? statusChip() : ""}</div>${form}</div></div></section>`;
}
function contactHTML() {
  const K = C.contact, addr = String(K.address || "").trim();
  const line = (ic, label, val, link, ext) => val ? `<li>${icon(ic, "ci")}<span><small>${esc(label)}</small>${link ? `<a href="${esc(link)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${ml(val)}</a>` : ml(val)}</span></li>` : "";
  const dir = safeUrl(K.mapUrl) || (addr ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addr.replace(/\n/g, ", ")) : "");
  const map = K.mapEmbed !== false && addr ? `<div class="map" data-q="${esc((C.brand.name + ", " + addr).replace(/\n/g, ", "))}"><button type="button" class="map-b">${icon("pin", "map-ic")}<b>Show the map</b><small>Opens Google Maps here</small></button></div>` : "";
  return `<section class="contact" id="contact"><div class="wrap">${head(K)}<div class="visit">
      <aside class="contact-info"><ul class="cl">${line("pin", "Address", addr, dir, 1)}${line("phone", "Phone", K.phone, K.phone ? tel(K.phone) : "")}${line("mail", "Email", K.email, K.email ? "mailto:" + K.email : "")}${line("car", "Parking", K.parking, "")}</ul>
        <div class="cta-row">${dir ? `<a class="btn pri" href="${esc(dir)}" target="_blank" rel="noopener">Get directions</a>` : ""}${K.whatsapp ? `<a class="btn sec" href="${esc(waUrl(""))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}</div></aside>
      <div class="card hours-card"><div class="hours-h"><h3 class="h3">${esc(C.hours.title || "Opening hours")}</h3>${statusChip()}</div>${hoursTable()}</div>
      ${map}</div></div></section>`;
}
function faqHTML() {
  const F = C.faq;
  if (!F.items.length) return "";
  return `<section class="faq band" id="faq"><div class="wrap faq-grid">${head(F, "left")}<div class="qa-list">${F.items.map((q) => `<details class="qa-i"><summary>${esc(q.q)}<span class="pm" aria-hidden="true"></span></summary><div class="qa-a">${paras(q.a)}</div></details>`).join("")}</div></div></section>`;
}
function ctaHTML() {
  const X = C.cta;
  if (!X.title) return "";
  return `<section class="cta" id="cta"><div class="wrap"><div class="cta-box"><div>${orn("orn cta-o")}<h2 class="h2">${rich(X.title)}</h2>${X.body ? `<p>${rich(X.body)}</p>` : ""}</div>${btn(X.button, X.target || "reserve", "inv")}</div></div></section>`;
}
const RENDER = { hero: heroHTML, highlights: highlightsHTML, about: aboutHTML, specials: specialsHTML, food: foodHTML, offers: offersHTML, gallery: galleryHTML, chef: chefHTML, events: eventsHTML, press: pressHTML, testimonials: testimonialsHTML, order: orderHTML, reserve: reserveHTML, contact: contactHTML, faq: faqHTML, cta: ctaHTML };

/* ============================================================
   PAGE
   ============================================================ */
/** The pages in the menu when the site has several (a page with nothing to show is left out). */
const mpages = () => ["menu", "about", ...(shown("gallery") && galleryItems().length ? ["gallery"] : []), "contact"].filter((p) => p !== "menu" || (shown("food") && cats().length));
function logoCss(def) {
  const B = C.brand, h = Math.max(20, Math.min(96, +B.logoSize || def));
  return B.logoFit === "wide" ? `height:${h}px;width:auto;max-width:min(${h * 6}px,52vw);object-fit:contain;border-radius:0` : `width:${h}px;height:${h}px${h !== def ? `;font-size:${Math.round(h * 0.36)}px` : ""}`;
}
function heroLogo() {
  const B = C.brand, on = PAGE === "home" && B.logoOnHero, src = on ? imgUrl(B.logo) : "";
  if (window.SiteLogo) window.SiteLogo.hero(src, { video: on ? imgUrl(B.logoVideo) : "", at: "#hero h1", size: B.heroLogoSize, radius: C.theme.logoRadius, wide: B.logoFit === "wide", edit: "brand.logo" });
}
function noticeHTML() {
  const N = C.notice || {};
  if (!N.on || !String(N.text || "").trim()) return "";
  let gone = false; try { gone = !PREVIEW && sessionStorage.getItem("site-notice") === N.text; } catch (e) {}
  if (gone) return "";
  return `<div class="notice" role="region" aria-label="Announcement"><p>${rich(N.text)}${N.label ? ` <a href="${esc(href(N.target || "offers"))}">${esc(N.label)}</a>` : ""}</p><button type="button" class="notice-x" aria-label="Close this announcement">×</button></div>`;
}
function navHTML() {
  const B = C.brand, logo = imgUrl(B.logo);
  const items = multi()
    ? mpages().map((p) => ({ label: C.site.pageLabels[p] || p, url: PAGES[p], on: PAGE === p }))
    : C.sections.filter((s) => s.show !== false && s.inNav && RENDER[s.id]).map((s) => ({ label: s.label, url: AT + "#" + s.id }));
  if (orderOn() && C.ordering.inNav !== false) items.push({ label: C.ordering.label || "Order now", url: PAGES.order, on: PAGE === "order" });
  spList().filter((p) => p.inNav).forEach((p) => items.push({ label: p.navLabel || p.title, url: spHref(p), on: PAGE === "page" && spSlug(p) === spSlug({ slug: spCur() }) }));
  const half = Math.ceil(items.length / 2), a = (i) => `<a href="${esc(i.url)}"${i.on ? ' aria-current="page"' : ""}>${esc(i.label)}</a>`;
  return `<header class="nav" id="top"><div class="wrap nav-in">
      <a class="brand" href="${multi() || PAGE !== "home" ? PAGES.home : "#top"}">${imgUrl(B.logoVideo) ? `<video class="logo" src="${esc(imgUrl(B.logoVideo))}"${logo ? ` poster="${esc(logo)}"` : ""} autoplay muted loop playsinline aria-hidden="true" style="${logoCss(40)}"></video>` : logo ? `<img class="logo" src="${esc(logo)}" alt="" style="${logoCss(40)}">` : `<span class="logo mark" style="${logoCss(40).replace(/height:(\d+)px;width:auto.*/, "width:$1px;height:$1px")}">${esc(initials(B.name))}</span>`}${B.showName !== false ? `<span class="bn">${esc(B.name)}</span>` : ""}</a>
      <nav class="links" aria-label="Main" style="--half:${half}">${items.map(a).join("")}</nav>
      ${C.nav.cta ? `<a class="btn pri nav-cta" href="${esc(href(C.nav.ctaTarget || "reserve"))}">${esc(C.nav.cta)}</a>` : ""}
      <button class="burger" type="button" aria-expanded="false" aria-controls="mnav" aria-label="Menu"><span></span><span></span></button></div>
    <nav class="mnav" id="mnav" aria-label="Main">${items.map((i) => `<a href="${esc(i.url)}">${esc(i.label)}</a>`).join("")}${C.nav.cta ? `<a class="btn pri" href="${esc(href(C.nav.ctaTarget || "reserve"))}">${esc(C.nav.cta)}</a>` : ""}</nav></header>`;
}
function pageHead() {
  const S = { menu: C.food, about: C.about, gallery: C.gallery, contact: C.reserve }[PAGE];
  if (!S) return "";
  return `<section class="phead" id="page"><div class="wrap"><p class="crumbs"><a href="${PAGES.home}">${esc(C.site.pageLabels.home || "Home")}</a> / ${esc(C.site.pageLabels[PAGE] || PAGE)}</p><h1 class="h1">${rich(S.title || C.site.pageLabels[PAGE])}</h1>${S.lede ? `<p class="hero-lede">${rich(S.lede)}</p>` : ""}</div></section>`;
}
function footerHTML() {
  const F = C.footer, B = C.brand, K = C.contact, D = (C.hours.days || []).filter((d) => d && d.day);
  const cols = multi() ? mpages().map((p) => `<a href="${PAGES[p]}">${esc(C.site.pageLabels[p] || p)}</a>`) : C.sections.filter((s) => s.show !== false && s.inNav && RENDER[s.id]).map((s) => `<a href="${AT}#${s.id}">${esc(s.label)}</a>`);
  spList().filter((p) => p.inFooter !== false).forEach((p) => cols.push(`<a href="${esc(spHref(p))}">${esc(p.navLabel || p.title)}</a>`));
  if (ckOn()) cols.push(`<a href="#cookie-settings">${esc(C.consent.reopenLabel || "Cookie settings")}</a>`);
  // The week in short: neighbouring days with the same hours share a line.
  const key = (d) => (d.closed ? "x" : [d.open, d.close, d.open2, d.close2].join("|")), groups = [];
  D.forEach((d) => { const g = groups[groups.length - 1]; if (g && g.k === key(d)) g.to = d.day; else groups.push({ k: key(d), from: d.day, to: d.day, d }); });
  const short = (n) => String(n).slice(0, 3);
  const hrs = groups.map((g) => `<span><b>${esc(short(g.from))}${g.to !== g.from ? "–" + esc(short(g.to)) : ""}</b> ${g.d.closed || mins(g.d.open) == null ? "Closed" : `${fmtTime(g.d.open)} – ${fmtTime(g.d.close)}${mins(g.d.open2) != null ? `, ${fmtTime(g.d.open2)} – ${fmtTime(g.d.close2)}` : ""}`}</span>`).join("");
  return `<footer class="foot" id="footer"><div class="wrap">${orn("orn foot-o")}<div class="foot-grid">
      <div><a class="brand" href="${multi() || PAGE !== "home" ? PAGES.home : "#top"}">${imgUrl(B.logo) ? `<img class="logo" src="${esc(imgUrl(B.logo))}" alt=""${B.logoFit === "wide" ? ` style="height:40px;width:auto;max-width:200px;object-fit:contain;border-radius:0"` : ""}>` : `<span class="logo mark">${esc(initials(B.name))}</span>`}<span class="bn">${esc(B.name)}</span></a><p>${rich(F.text)}</p></div>
      <nav aria-label="Footer">${cols.join("")}</nav>
      <div class="fc">${K.address ? `<span>${ml(K.address)}</span>` : ""}${K.phone ? `<a href="${esc(tel(K.phone))}">${esc(K.phone)}</a>` : ""}${K.email ? `<a href="mailto:${esc(K.email)}">${esc(K.email)}</a>` : ""}</div>
      ${hrs ? `<div class="fh"><b class="fh-t">${esc(C.hours.title || "Opening hours")}</b>${hrs}</div>` : ""}</div>
    <div class="foot-legal"><span>${esc(String(F.legal || "").replace(/\{year\}/g, new Date().getFullYear()))}</span><span>${(F.links || []).filter((l) => l.label).map((l) => safeUrl(l.url) ? `<a href="${esc(safeUrl(l.url))}">${esc(l.label)}</a>` : `<span>${esc(l.label)}</span>`).join("")}</span></div></div></footer>`;
}
/** Phones: Call, Directions, Menu and Book stay within the thumb's reach. */
function mobileBar() {
  const K = C.contact, addr = String(K.address || "").trim();
  if (C.site.mobileBar === false || PAGE === "order") return "";
  const dir = safeUrl(K.mapUrl) || (addr ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addr.replace(/\n/g, ", ")) : "");
  const b = [K.phone ? `<a href="${esc(tel(K.phone))}">${icon("phone")}<span>Call</span></a>` : "", dir ? `<a href="${esc(dir)}" target="_blank" rel="noopener">${icon("pin")}<span>Directions</span></a>` : "",
    shown("food") && cats().length ? `<a href="${esc(href("food"))}">${icon("cutlery")}<span>Menu</span></a>` : "", orderOn() ? `<a class="pri" href="${PAGES.order}">${icon("bag")}<span>Order</span></a>` : "", shown("reserve") && C.contact.form.enabled ? `<a${orderOn() ? "" : ' class="pri"'} href="${esc(href("reserve"))}">${icon("calendar")}<span>Book</span></a>` : ""].filter(Boolean).slice(-4);
  return b.length > 1 ? `<nav class="mbar" aria-label="Quick actions">${b.join("")}</nav>` : "";
}
/** What the Order now page (assets/order.js) needs from this file. */
const ORDER_API = { C: () => C, PAGES, DIET, PREVIEW, esc, rich, money, imgUrl, icon, toast, cats, dietMark, slug, ph, tel, clock, periods, openState, fmtTime, hhmm, statusChip, backend: () => backend(), postEnquiry: (d, pg, cart) => postEnquiry(d, pg, cart) };
function orderPage() {
  if (!orderOn()) return `<section class="phead"><div class="wrap"><h1 class="h1">${esc((C.ordering || {}).label || "Order now")}</h1><p class="hero-lede">${PREVIEW ? "Online ordering is switched off. Turn it on under Online ordering to see this page." : "Online ordering isn't available right now."}</p></div></section>`;
  return window.RestOrder ? window.RestOrder.page(ORDER_API) : "";
}
/** One section on a page of its own (see soloSections). */
function sectionPage() {
  const id = soloCur(), sec = C.sections.find((x) => x.id === id), body = sec && RENDER[id] && id !== "hero" && shown(id) ? RENDER[id]() : "";
  const crumbs = `<p class="crumbs"><a href="${PAGES.home}">${esc((C.site.pageLabels || {}).home || "Home")}</a> / ${esc((sec && sec.label) || "")}</p>`;
  if (!body) return `<section class="phead"><div class="wrap">${crumbs}<h1 class="h1">${esc((sec && sec.label) || "Page")}</h1><p class="hero-lede">${PREVIEW ? "This section is hidden or has nothing to show yet." : "There is nothing here right now."}</p></div></section>`;
  return `<div class="solo-top"><div class="wrap">${crumbs}</div></div>${body}`;
}
function staticPage() {
  const S = window.SitePages; if (!S) return "";
  const p = S.find(C, spCur(), PREVIEW), o = { home: PAGES.home, homeLabel: C.site.pageLabels.home || "Home", preview: PREVIEW };
  return p ? S.article(p, o) : S.missing(o);
}
let iconKey = "";
function setIcon() {
  const B = C.brand, t = C.theme, acc = t.c1, rad = Math.max(0, Math.min(50, t.logoRadius ?? 22)), src = imgUrl(B.logo), key = [src, B.name, rad, acc].join("|");
  if (key === iconKey) return; iconKey = key;
  let l = document.querySelector("link[rel=icon]"); if (!l) { l = document.createElement("link"); l.rel = "icon"; document.head.appendChild(l); }
  document.querySelectorAll('link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach((x) => x.remove());
  if (src) {
    l.removeAttribute("type"); l.href = src;
    const im = new Image(); im.crossOrigin = "anonymous";
    im.onload = () => { try {
      if (iconKey !== key || !im.width || Math.abs(im.width - im.height) < 3) return;
      const cv = document.createElement("canvas"); cv.width = cv.height = 128; const s = Math.min(128 / im.width, 128 / im.height);
      cv.getContext("2d").drawImage(im, (128 - im.width * s) / 2, (128 - im.height * s) / 2, im.width * s, im.height * s);
      const u = cv.toDataURL("image/png"); if (iconKey === key) { l.type = "image/png"; l.href = u; }
    } catch (e) { /* the photo host doesn't allow copying: the logo itself stays as the icon */ } };
    im.src = src;
    return;
  }
  const ini = String(B.name || "").split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2).toUpperCase() || "•";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${(rad * 0.64).toFixed(1)}" fill="${esc(acc)}"/><text x="32" y="34" dominant-baseline="middle" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="${ini.length > 1 ? 26 : 34}" fill="${onColor(acc)}">${esc(ini)}</text></svg>`;
  l.type = "image/svg+xml"; l.href = "data:image/svg+xml," + encodeURIComponent(svg);
}
/** What search engines read about the place: name, address, phone, hours, cuisine and the menu's address. */
function jsonLd() {
  let s = document.getElementById("ld-restaurant");
  if (PREVIEW || PAGE !== "home") { if (s) s.remove(); return; }
  const K = C.contact, S = C.seo, D = C.hours.days || [], base = String(S.siteUrl || "").replace(/\/+$/, "");
  const o = { "@context": "https://schema.org", "@type": "Restaurant", name: C.brand.name };
  if (S.description) o.description = S.description; if (base) { o.url = base + "/"; if (shown("food") && cats().length) o.hasMenu = base + "/" + (multi() ? PAGES.menu : "#food"); }
  if (K.phone) o.telephone = K.phone; if (K.email) o.email = K.email; if (K.address) o.address = String(K.address).replace(/\n/g, ", ");
  if (S.cuisine) o.servesCuisine = String(S.cuisine).split(",").map((x) => x.trim()).filter(Boolean); if (S.priceRange) o.priceRange = S.priceRange;
  if (C.contact.form.enabled && shown("reserve")) o.acceptsReservations = true;
  const spec = D.flatMap((d, i) => (d && !d.closed ? [[d.open, d.close], [d.open2, d.close2]].filter(([a, b]) => mins(a) != null && mins(b) != null).map(([a, b]) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: DAYS[i] || d.day, opens: hhmm(mins(a)), closes: hhmm(mins(b) % 1440) })) : []));
  if (spec.length) o.openingHoursSpecification = spec;
  const G = C.testimonials.google; if (G && G.rating && G.count) o.aggregateRating = { "@type": "AggregateRating", ratingValue: +G.rating, reviewCount: +G.count };
  if (!s) { s = document.createElement("script"); s.type = "application/ld+json"; s.id = "ld-restaurant"; document.head.appendChild(s); }
  s.textContent = JSON.stringify(o).replace(/</g, "\\u003c");
}
let adP;
function addons() {
  const A = C.addons || {}, any = (A.chat && A.chat.on) || (A.badge && A.badge.on) || (A.api && A.api.on) || (A.code || []).some((x) => x && x.on !== false && x.code);
  if (!any && !window.SiteAddons) return;
  (adP ||= new Promise((ok, no) => { if (window.SiteAddons) return ok(); const s = document.createElement("script"); s.src = "assets/addons.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    .then(() => window.SiteAddons.mount(C, { preview: PREVIEW, home: PAGE === "home", site: C.brand.name })).catch(() => {});
}
let fsP;
function festival() {
  const F = C.festival || {};
  if (!(F.on !== false && (F.v >= 2 || F.allowed)) && !window.SiteFestival) return;
  (fsP ||= new Promise((ok, no) => { if (window.SiteFestival) return ok(); const s = document.createElement("script"); s.src = "assets/festival.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    .then(() => window.SiteFestival.mount(C, { preview: PREVIEW, site: C.brand.name })).catch(() => {});
}
let ssP;
function social() {
  const S = C.social || {};
  if (!S.on && !window.SiteSocial) return;
  (ssP ||= new Promise((ok, no) => { if (window.SiteSocial) return ok(); const s = document.createElement("script"); s.src = "assets/social.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    .then(() => window.SiteSocial.mount(C, { footer: "footer.foot", before: ".foot-legal", imgUrl })).catch(() => {});
}
let svP;
function video() {
  const V = C.video || {};
  if (!V.on && !window.SiteVideo) return;
  (svP ||= new Promise((ok, no) => { if (window.SiteVideo) return ok(); const s = document.createElement("script"); s.src = "assets/video.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    .then(() => window.SiteVideo.mount(C, { sections: "#main > section", home: PAGE === "home", imgUrl })).catch(() => {});
}
/** The footer's link that reopens the consent choices (while the banner is on). */
const ckOn = () => !!(C.consent && C.consent.on && C.consent.footerLink !== false);
/* Regional languages (assets/lang.js): the chosen language is put into the content before the page is drawn, then
   the page's fixed wording is translated and the language switcher added. */
let lgP, lgFail = false;
const langOn = () => { const n = C.i18n || {}; return !!n.on && (n.langs || []).some((l) => l && l.on !== false); };
function langGate() {
  if (window.SiteLang) { if (PREVIEW) window.SiteLang.force((C.i18n || {}).preview || ""); window.SiteLang.apply(C); return false; }
  if (!langOn() || lgFail) return false;
  (lgP ||= new Promise((ok, no) => { const s = document.createElement("script"); s.src = "assets/lang.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); })).then(render, () => { lgFail = true; render(); });
  return true;
}
function lang() { if (window.SiteLang) window.SiteLang.mount(C, { navs: [".nav .links", "#mnav"], keep: "a.btn", again: render }); }
let csP;
function consent() {
  if (!(C.consent || {}).on && !window.SiteConsent) return;
  (csP ||= new Promise((ok, no) => { if (window.SiteConsent) return ok(); const s = document.createElement("script"); s.src = "assets/consent.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    .then(() => window.SiteConsent.mount(C, { preview: PREVIEW, pageUrl: (id) => { const p = spList().find((x) => x.id === id); return p ? spHref(p) : ""; } })).catch(() => {});
}
/* The owner's own menu with sub-menus (assets/menu.js), in place of the automatic links. */
let mnP;
const menuOn = () => !!(C.menu && C.menu.custom && (C.menu.items || []).some((i) => i && i.show !== false && String(i.label || "").trim()));
function menuGo(it) {
  const t = it.to || "";
  if (t === "none") return { url: "" };
  if (t === "url") { const u = String(it.url || "").trim(); return { url: safeUrl(u) || (/^(#|\/|\.\/|[\w-]+\.html)/.test(u) ? u : "") }; }
  if (t === "page") { const p = spList().find((x) => x.id === it.page); return p ? { url: spHref(p), on: PAGE === "page" && spSlug(p) === spSlug({ slug: spCur() }) } : { url: "" }; }
  const url = href(t === "home" ? "hero" : t);
  if (!multi() && soloSections().has(t)) return { url, on: PAGE === "section" && soloCur() === t, self: true };
  return { url: t === "home" && !multi() ? AT + "#top" : url, on: (multi() && url === PAGES[PAGE]) || (PAGE === "section" && soloCur() === t) };
}
function menu() {
  if (!menuOn()) return;
  const done = () => { const w = document.getElementById("sm-wait"); if (w) w.remove(); };
  if (!window.SiteMenu && !document.getElementById("sm-wait")) { const w = document.createElement("style"); w.id = "sm-wait"; w.textContent = ".nav .links,#mnav{visibility:hidden}"; document.head.appendChild(w); setTimeout(done, 2500); }
  (mnP ||= new Promise((ok, no) => { if (window.SiteMenu) return ok(); const s = document.createElement("script"); s.src = "assets/menu.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    .then(() => {
      window.SiteMenu.mount(C, { navs: [".nav .links", "#mnav"], keep: "a.btn", resolve: menuGo, onPick: () => { const b = $(".burger"), m = $("#mnav"); b && b.setAttribute("aria-expanded", "false"); m && m.classList.remove("open"); } });
      done();
    }).catch(done);
}
/* Maintenance mode (assets/maint.js): while content.maintenance.on, visitors see the maintenance page instead of the
   site. The editor's preview shows it too (with a button to see the site), and on its "Maintenance page" entry
   (?maintenance=1) while it is off. */
const MNT_Q = /[?&]maintenance=1(&|$)/.test(location.search);
let mntP, mntPass = false;
function maintGate(again) {
  const on = (PREVIEW && MNT_Q) || !!(C.maintenance || {}).on;
  if (!on || mntPass) { if (window.SiteMaint) window.SiteMaint.hide(); return false; }
  (mntP ||= new Promise((ok, no) => { if (window.SiteMaint) return ok(); const s = document.createElement("script"); s.src = "assets/maint.js"; s.onload = () => ok(); s.onerror = no; document.head.appendChild(s); }))
    .then(() => {
      if (window.SiteMaint.wanted(C, PREVIEW)) window.SiteMaint.show(C, { name: C.brand.name, logo: imgUrl(C.brand.logo), preview: PREVIEW, again });
      else { mntPass = true; again(); }
    }).catch(() => { mntPass = true; again(); });
  return true;
}
function render() {
  // A several-page link opened while the site is one page goes to that section.
  if (PAGE === "order" && !PREVIEW && !orderOn()) { location.replace(PAGES.home); return; }
  // A section's own page: only while its link still says so; otherwise the visitor goes to that section on the main page.
  if (PAGE === "section" && !PREVIEW && !soloSections().has(soloCur())) { location.replace(multi() ? href(soloCur()) : PAGES.home + (RENDER[soloCur()] ? "#" + soloCur() : "")); return; }
  if (!PREVIEW && !multi() && !["home", "page", "order", "section"].includes(PAGE)) { location.replace(PAGES.home + "#" + ({ menu: "food", contact: "reserve" }[PAGE] || PAGE)); return; }
  if (langGate()) return;
  applyTheme(C.theme); setTitle(); setIcon();
  if (maintGate(render)) return;
  const special = { page: staticPage, order: orderPage, section: sectionPage }[PAGE];
  const solo = soloSections();
  const ids = special ? [] : multi() ? (PAGE === "home" ? C.sections.map((s) => s.id).filter((id) => PAGE_SECTIONS.home.includes(id)) : PAGE_SECTIONS[PAGE] || []) : C.sections.map((s) => s.id).filter((id) => !solo.has(id));
  const body = special ? special() : ids.filter((id) => RENDER[id] && shown(id)).map((id) => RENDER[id]()).join("");
  const bar = mobileBar();
  document.documentElement.classList.toggle("has-mbar", !!bar);
  $("#app").innerHTML = `<a class="skip" href="#main">Skip to content</a>${noticeHTML()}${navHTML()}<main id="main">${multi() && !special && PAGE !== "home" ? pageHead() : ""}${body}</main>${footerHTML()}${bar}`;
  bind();
  if (PAGE === "order" && window.RestOrder && orderOn()) window.RestOrder.bind(ORDER_API);
  if (PAGE === "page" && window.SitePages) window.SitePages.after(window.SitePages.find(C, spCur(), PREVIEW));
  jsonLd(); slides(); heroLogo(); video(); social(); menu(); lang(); consent(); addons(); festival();
  if (window.SiteFX) try { window.SiteFX.init({ root: $("#app"), brand: C.theme.introTitle || C.brand.name, badge: C.poweredBy }); } catch (e) {}
}

/* ============================================================
   BEHAVIOUR
   ============================================================ */
function bind() {
  const b = $(".burger"), m = $("#mnav");
  if (b) b.onclick = () => { const o = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", String(o)); m.classList.toggle("open", o); };
  $$("#mnav a").forEach((a) => a.addEventListener("click", () => { b && b.setAttribute("aria-expanded", "false"); m.classList.remove("open"); }));
  const nav = $(".nav"); const onS = () => nav && nav.classList.toggle("scrolled", scrollY > 8);
  if (!bind.scroll) { bind.scroll = true; addEventListener("scroll", () => { const n = $(".nav"); n && n.classList.toggle("scrolled", scrollY > 8); }, { passive: true }); } onS();
  // Reveal on scroll
  const rv = $$(".rv");
  if (C.theme.motionStyle === "none" || matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) rv.forEach((e) => e.classList.add("in"));
  else { const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" }); rv.forEach((e) => io.observe(e)); }
  const x = $(".notice-x"); if (x) x.onclick = () => { try { sessionStorage.setItem("site-notice", C.notice.text); } catch (e) {} x.parentNode.remove(); };
  const f = $("#enquiry"); if (f) { f.addEventListener("submit", submit); bindForm(f); }
  bindMenu(); bindZoom();
  $$(".of-code").forEach((c) => c.addEventListener("click", () => { const t = c.dataset.copy; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast("Code copied: <b>" + esc(t) + "</b>"), () => toast("Code: <b>" + esc(t) + "</b>")); }));
  const mp = $(".map-b"); if (mp) mp.onclick = () => { const h = mp.parentNode, fr = document.createElement("iframe"); fr.title = "Map"; fr.loading = "lazy"; fr.referrerPolicy = "no-referrer-when-downgrade"; fr.src = "https://www.google.com/maps?q=" + encodeURIComponent(h.dataset.q) + "&output=embed"; h.innerHTML = ""; h.appendChild(fr); };
  // The map shows by itself (it loads when it is scrolled near); with “wait for a tap” on, nothing goes to Google before the tap.
  if (mp && !C.contact.mapTap) mp.onclick();
}
/** The booking form: no dates in the past, and "Plan an event" picks the kind of request. */
function bindForm(f) {
  const d = $("#f-date", f);
  if (d) { const n = new Date(), iso = (x) => x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); d.min = iso(n); const far = new Date(n); far.setMonth(far.getMonth() + 6); d.max = iso(far); }
  const pick = (t) => { const s = $("#f-type", f); if (!s || !t) return; const o = [...s.options].find((x) => x.value === t || x.text === t); if (o) s.value = o.value; };
  try { pick(new URLSearchParams(location.search).get("type")); } catch (e) {}
  $$("a[data-type]").forEach((a) => a.addEventListener("click", (e) => { if (!$("#reserve")) return; e.preventDefault(); pick(a.dataset.type); $("#reserve").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); setTimeout(() => { const n = $("#f-name", f); n && n.focus({ preventScroll: true }); }, 500); }));
}
/** The menu: search, diet filters, and the bar that jumps between its sections (or switches them, in the tabbed style). */
function bindMenu() {
  const body = $(".mbody"); if (!body) return;
  const tabs = C.theme.menuStyle === "tabs", q = $("#menu-q"), links = $$(".mcats a"), secs = $$(".mcat", body);
  let diet = "";
  const apply = () => {
    const w = q ? q.value.trim().toLowerCase() : ""; let any = false;
    const filtering = !!(w || diet);
    secs.forEach((s) => {
      let n = 0;
      $$(".dish", s).forEach((d) => { const ok = (!w || d.dataset.q.includes(w)) && (!diet || d.dataset.diet === diet || (diet === "veg" && d.dataset.diet === "vegan")); d.hidden = !ok; if (ok) n++; });
      s.classList.toggle("empty", !n); if (n) any = true;
    });
    body.classList.toggle("filtering", filtering);
    const none = $(".mnone", body); if (none) none.hidden = any;
  };
  if (q) q.addEventListener("input", apply);
  $$(".mdiet .chip").forEach((c) => c.addEventListener("click", () => { diet = c.dataset.diet; $$(".mdiet .chip").forEach((x) => x.setAttribute("aria-pressed", String(x === c))); apply(); }));
  const setOn = (id) => { links.forEach((a) => a.classList.toggle("on", a.dataset.cat === id)); if (tabs) secs.forEach((s) => s.classList.toggle("on", s.id === id)); const on = links.find((a) => a.dataset.cat === id); if (on && on.parentNode.scrollWidth > on.parentNode.clientWidth) on.parentNode.scrollTo({ left: on.offsetLeft - 16, behavior: "smooth" }); };
  links.forEach((a) => a.addEventListener("click", (e) => { if (tabs) { e.preventDefault(); setOn(a.dataset.cat); return; } setOn(a.dataset.cat); }));
  if (!tabs && links.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { const v = es.filter((e) => e.isIntersecting).sort((x, y) => x.boundingClientRect.top - y.boundingClientRect.top)[0]; if (v) links.forEach((a) => a.classList.toggle("on", a.dataset.cat === v.target.id)); }, { rootMargin: "-30% 0px -60% 0px" });
    secs.forEach((s) => io.observe(s));
  }
}
/** Photos open large: the gallery steps through its photos, a dish photo opens by itself. */
function bindZoom() {
  $$(".zoom").forEach((z) => z.addEventListener("click", () => {
    const set = z.dataset.set ? $$('.zoom[data-set="' + z.dataset.set + '"]') : [z]; let i = Math.max(0, set.indexOf(z));
    const last = document.activeElement, ov = document.createElement("div"); ov.className = "lb"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Photo");
    ov.innerHTML = `<button type="button" class="lb-x" aria-label="Close">×</button>${set.length > 1 ? `<button type="button" class="lb-n prev" aria-label="Previous photo">‹</button><button type="button" class="lb-n next" aria-label="Next photo">›</button>` : ""}<figure><img alt=""><figcaption></figcaption></figure>`;
    const show = () => { const s = set[i]; $("img", ov).src = s.dataset.zoom; $("img", ov).alt = s.dataset.cap || ""; $("figcaption", ov).textContent = (s.dataset.cap || "") + (set.length > 1 ? (s.dataset.cap ? " · " : "") + (i + 1) + " / " + set.length : ""); };
    const close = () => { ov.remove(); removeEventListener("keydown", key); document.documentElement.classList.remove("lb-open"); last && last.focus && last.focus(); };
    const step = (n) => { i = (i + n + set.length) % set.length; show(); };
    const key = (e) => { if (e.key === "Escape") close(); else if (e.key === "ArrowRight" && set.length > 1) step(1); else if (e.key === "ArrowLeft" && set.length > 1) step(-1); else if (e.key === "Tab") { const B = $$("button", ov); if (!B.length) return; const k = B.indexOf(document.activeElement); e.preventDefault(); B[(k + (e.shiftKey ? -1 : 1) + B.length) % B.length].focus(); } };
    ov.addEventListener("click", (e) => { if (e.target === ov || e.target.classList.contains("lb-x")) close(); else if (e.target.classList.contains("prev")) step(-1); else if (e.target.classList.contains("next")) step(1); });
    addEventListener("keydown", key); document.body.appendChild(ov); document.documentElement.classList.add("lb-open"); show(); $(".lb-x", ov).focus();
  }));
}

/* Hero background slides (assets/slides.js, loaded when switched on). */
let slP, slGen = 0;
function slides() {
  const S = C.hero.slides, g = ++slGen, host = $("#hero");
  const H = document.documentElement;
  if (!host || !S || !S.enabled || !(S.items || []).some((x) => x && (x.image || x.video))) { if (window.SiteSlides) window.SiteSlides.stop(); H.classList.remove("hs-top", "hs-top-light"); return; }
  (slP ||= new Promise((ok, no) => { if (window.SiteSlides) return ok(window.SiteSlides); const s = document.createElement("script"); s.src = "assets/slides.js"; s.onload = () => ok(window.SiteSlides); s.onerror = no; document.head.appendChild(s); }))
    .then((w) => {
      if (g !== slGen) return;
      w.mount(host, S, { imgUrl, title: ".h1", text: ".hero-lede", hide: ".hero-media,.hero-bg" });
      // The photos run up behind the header, so the header and the hero read as one piece (not a strip above the photos).
      const nav = $(".nav"), top = !!nav && !host.previousElementSibling && H.dataset.nav !== "dark" && H.dataset.layout !== "panel" && host.classList.contains("hs-host");
      H.classList.toggle("hs-top", top); H.classList.toggle("hs-top-light", top && host.classList.contains("hs-light"));
      if (top) { const fit = () => H.style.setProperty("--nav-h", nav.offsetHeight + "px"); fit(); if (!slides.bound) { slides.bound = true; addEventListener("resize", fit); } }
    }).catch(() => {});
}
/** Where bookings go: the hosted site's database, the form's own Supabase settings, or email. */
function backend() {
  const F = C.contact.form;
  if (F.saveTo === "file") return /^https:\/\//.test(F.fileUrl || "") ? { file: F.fileUrl } : null;
  if (HOST && HOST.api && HOST.site) return { cf: HOST.api, site: HOST.site };
  if (HOST && HOST.db && HOST.key && HOST.site) return { url: HOST.db, key: HOST.key, site: HOST.site };
  if (/^https:\/\//.test(F.sbUrl || "") && F.sbKey && F.site) return { url: String(F.sbUrl).replace(/\/+$/, ""), key: F.sbKey, site: F.site };
  return null;
}
/** Saves a request in the site's enquiry inbox. Says how it went: "cf", "db", "file", or "" when the site has no inbox. */
async function postEnquiry(data, page, cart) {
  const cfg = backend(); if (!cfg) return "";
  const pg = page || location.pathname;
  if (cfg.file) { const r = await fetch(cfg.file, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit", data, page: pg }) }); if (!r.ok) throw new Error("save " + r.status); return "file"; }
  if (cfg.cf) { const r = await fetch(cfg.cf + "/enquire/" + encodeURIComponent(cfg.site), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, page: pg, ...(cart ? { cart } : {}) }) }); if (!r.ok) throw new Error("save " + r.status); return "cf"; }
  const r = await fetch(cfg.url + "/rest/v1/site_enquiries", { method: "POST", headers: { apikey: cfg.key, ...(/^sb_/.test(cfg.key) ? {} : { Authorization: "Bearer " + cfg.key }), "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ site: cfg.site, data, page: pg }) });
  if (!r.ok) throw new Error("save " + r.status); return "db";
}
async function submit(e) {
  e.preventDefault();
  const f = e.currentTarget, msg = $(".form-msg", f), btnEl = $("button[type=submit]", f), F = C.contact.form;
  const data = Object.fromEntries(new FormData(f).entries());
  if (data.website) return; // spam trap
  delete data.website; data.consent = data.consent ? "yes" : "";
  const bad = [...f.querySelectorAll("[required]")].find((i) => (i.type === "checkbox" ? !i.checked : !String(i.value).trim()));
  const em = $("#f-email", f), ph = $("#f-phone", f), dt = $("#f-date", f);
  const say = (el, t) => { msg.className = "form-msg bad"; msg.textContent = t; el && el.focus(); };
  if (bad) return say(bad, bad.type === "checkbox" ? "Please tick the box to continue." : "Please fill in the required fields.");
  if (ph && String(ph.value).replace(/\D/g, "").length < 7) return say(ph, "Please enter a phone number we can reach you on.");
  if (em && em.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value)) return say(em, "Please enter a valid email address.");
  if (dt && dt.value && dt.min && dt.value < dt.min) return say(dt, "Please choose today or a later date.");
  const okMsg = F.success || "Thank you. We'll be in touch.";
  if (PREVIEW) { msg.className = "form-msg ok"; msg.textContent = "Preview: the form works on the live site. " + (backend() ? (backend().file ? "Requests are saved as JSON files and listed under Enquiries in the admin page. No email is sent." : "Requests are saved to Enquiries in the admin page.") : F.saveTo === "file" ? "Set up the enquiry inbox in the Studio, then publish." : "It opens the visitor's email app addressed to " + (C.contact.email || "your email") + "."); return; }
  btnEl.disabled = true; msg.className = "form-msg"; msg.textContent = "Sending…";
  const cfg = backend();
  if (!cfg && F.saveTo === "file") { msg.className = "form-msg bad"; msg.textContent = "This form isn't connected yet. Please call us instead."; btnEl.disabled = false; return; }
  try {
    if (cfg && cfg.file) {
      const r = await fetch(cfg.file, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit", data, page: location.pathname }) });
      if (!r.ok) throw new Error("save " + r.status);
      f.reset(); msg.className = "form-msg ok"; msg.textContent = okMsg;
    } else if (cfg && cfg.cf) {
      const r = await fetch(cfg.cf + "/enquire/" + encodeURIComponent(cfg.site), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, page: location.pathname }) });
      if (!r.ok) throw new Error("save " + r.status);
      f.reset(); msg.className = "form-msg ok"; msg.textContent = okMsg;
    } else if (cfg) {
      const r = await fetch(cfg.url + "/rest/v1/site_enquiries", { method: "POST", headers: { apikey: cfg.key, ...(/^sb_/.test(cfg.key) ? {} : { Authorization: "Bearer " + cfg.key }), "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ site: cfg.site, data, page: location.pathname }) });
      if (!r.ok) throw new Error("save " + r.status);
      f.reset(); msg.className = "form-msg ok"; msg.textContent = okMsg;
    } else {
      const to = C.contact.email || "";
      const body = Object.entries(data).filter(([, v]) => v).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)}: ${v}`).join("\n");
      location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent((data.type || "Booking request") + " from " + (data.name || "the website"))}&body=${encodeURIComponent(body)}`;
      msg.className = "form-msg ok"; msg.textContent = "Your email app should open with the request filled in. Press Send there to reach us.";
    }
  } catch (x) {
    msg.className = "form-msg bad"; msg.innerHTML = C.contact.phone ? `Couldn't send just now. Please call us on <a href="${esc(tel(C.contact.phone))}">${esc(C.contact.phone)}</a>.` : "Couldn't send just now. Please try again in a moment.";
  }
  btnEl.disabled = false;
}

/* ============================================================
   BOOT
   ============================================================ */
if (PREVIEW) {
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || e.source !== window.parent) return;
    const d = e.data || {};
    if (d.type === "cms:content" && d.content && typeof d.content === "object") { ASSETS = d.assets || {}; const y = scrollY; C = merge(DEFAULT, d.content); render(); scrollTo(0, y); }
  });
  window.parent.postMessage({ type: "cms:ready", page: (location.pathname.split("/").pop() || "index.html") + (PAGE === "page" && spCur() ? "?p=" + encodeURIComponent(spCur()) : MNT_Q ? "?maintenance=1" : "") }, location.origin);
  render();
} else {
  const CKEY = "site-content:" + location.pathname.replace(/[^/]*$/, "");
  let shownTxt = "";
  try { const c = sessionStorage.getItem(CKEY); if (c) { C = merge(DEFAULT, JSON.parse(c)); render(); shownTxt = c; } } catch (e) {}
  // A first visit: the page's outline shows while the content is fetched (the first render replaces it).
  if (!shownTxt && window.SiteSkeleton) window.SiteSkeleton.show($("#app"));
  const giveUp = setTimeout(() => { if (!shownTxt) { render(); shownTxt = "default"; } }, 6000);
  const fromFile = () => fetch("content.json", { cache: "no-store" }).then((r) => (r.ok ? r.text() : null));
  // Hosted on the Studio's Cloudflare database: content is a public file there.
  const fromCf = () => fetch(HOST.api + "/p/" + encodeURIComponent(HOST.site) + "/content.json", { cache: "no-store" }).then((r) => (r.ok ? r.text() : null)).catch(() => null).then((t) => t || fromFile());
  const fromDb = () => HOST.api ? fromCf() : fetch(HOST.db + "/rest/v1/site_content?select=content&site=eq." + encodeURIComponent(HOST.site), { cache: "no-store", headers: { apikey: HOST.key, ...(/^sb_/.test(HOST.key) ? {} : { Authorization: "Bearer " + HOST.key }) } })
    .then((r) => (r.ok ? r.json() : null)).then((j) => (j && j[0] && j[0].content ? JSON.stringify(j[0].content) : null)).catch(() => null).then((t) => t || fromFile());
  (HOST ? fromDb() : fromFile()).then((txt) => {
    clearTimeout(giveUp);
    if (!txt) { if (!shownTxt) render(); return; }
    try { sessionStorage.setItem(CKEY, txt); } catch (e) {}
    if (txt === shownTxt) return;
    C = merge(DEFAULT, JSON.parse(txt)); render();
  }).catch(() => { clearTimeout(giveUp); if (!shownTxt) render(); });
}
})();

// Menu when scrolling (theme.navMode; theme.navModeMob for phones): "" theme default, fixed, hide (hide on scroll down, show on scroll up), scroll (scrolls away)
(function(){let lastY=scrollY;const de=document.documentElement;
  addEventListener("scroll",()=>{const y=scrollY,d=y-lastY;
    if(((matchMedia("(max-width:760px)").matches&&de.dataset.menumob)||de.dataset.menu)!=="hide"||document.querySelector(".nav [aria-expanded=true]")){de.classList.remove("menu-away");lastY=y;return}
    if(Math.abs(d)<6)return;de.classList.toggle("menu-away",d>0&&y>140);lastY=y},{passive:true});
  document.addEventListener("focusin",e=>{if(e.target.closest&&e.target.closest(".nav"))de.classList.remove("menu-away")});
})();
