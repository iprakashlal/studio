// The Picaffectz system's writer: new website text for a brand, composed on this device from the Studio's own
// phrase bank. No AI service, no allowance. The reference (a page's text, a PDF or pasted text) is only read to tell
// what kind of business it is; none of its wording is reused. It never invents facts: no years, numbers, prices,
// awards or client names. What the owner writes in the notes is used as it is.
import type { Brief } from "./cfdb";

type Pair = [string, string];
type Pack = { id: string; label: string; re: RegExp; eyebrow: string[]; titles: string[]; texts: string[]; cta: string[]; taglines: string[]; svcTitle: string; svcIntro: string; services: Pair[]; faq: Pair[]; ctaTitle: string[]; ctaText: string[] };

// {brand} is the name, {city} is " in <City>" when the notes name a place (else nothing).
const PACKS: Pack[] = [
  { id: "restaurant", label: "Restaurant", re: /restaurant|dine|dining|cuisine|menu|chef|biryani|tandoor|thali|kitchen|bistro|eatery|buffet|curry|grill|pizza|dishes?\b/gi,
    eyebrow: ["Restaurant{city}", "Kitchen & dining{city}", "Good food{city}"], titles: ["Good food, cooked with care", "Fresh plates, warm welcome", "Come hungry, leave happy"],
    texts: ["{brand} serves food made fresh every day, in a place where you can take your time.", "At {brand} the menu is short, the cooking is honest and there is always room for one more at the table."],
    cta: ["Book a table", "See the menu"], taglines: ["Fresh food, warm welcome", "Cooked with care, served with a smile"],
    svcTitle: "What to expect", svcIntro: "A menu made fresh each day, and a team that looks after you.",
    services: [["Made fresh", "Every dish is cooked to order with fresh ingredients."], ["Something for everyone", "Vegetarian and non-vegetarian dishes, with lighter options too."], ["Family tables", "Space for families and groups, with a relaxed pace."], ["Takeaway", "Call ahead and your order is packed and ready."], ["Celebrations", "Birthdays and get-togethers, planned with you."], ["Catering", "Our kitchen, at your event."]],
    faq: [["Do I need to book a table?", "Walk-ins are welcome. On busy evenings a booking is the surest way to get a table."], ["Do you have vegetarian dishes?", "Yes. They are marked on the menu, and the kitchen is happy to guide you."], ["Do you take party orders?", "Yes. Tell us the date and the number of guests and we will plan it with you."], ["Can I order for takeaway?", "Yes. Call us and we will have it ready."]],
    ctaTitle: ["Hungry yet?", "A table is waiting"], ctaText: ["Book a table at {brand}, or call us for takeaway.", "Come by {brand} today. We would love to cook for you."] },
  { id: "cafe", label: "Café or bakery", re: /caf[eé]|coffee|espresso|bakery|bakes?|cakes?|pastr|dessert|brew|tea room|patisserie|cookies|ice cream|gelato/gi,
    eyebrow: ["Café & bakes{city}", "Coffee, cakes and good company", "Freshly baked{city}"], titles: ["Fresh bakes and good coffee", "Your everyday café", "Baked this morning"],
    texts: ["{brand} is a friendly spot for coffee, fresh bakes and an unhurried chat.", "Everything at {brand} is made in small batches, so it is always fresh."],
    cta: ["See the menu", "Visit us"], taglines: ["Fresh bakes, good coffee", "Made in small batches"],
    svcTitle: "On the counter", svcIntro: "Baked fresh and brewed to order.",
    services: [["Coffee & tea", "Brewed to order, the way you like it."], ["Fresh bakes", "Breads, cakes and pastries baked through the day."], ["Custom cakes", "Cakes made to order for birthdays and celebrations."], ["Light meals", "Sandwiches and snacks for any time of day."], ["Party orders", "Boxes and platters for the office or home."]],
    faq: [["Do you take cake orders?", "Yes. Order a little ahead so we can bake it fresh for you."], ["Do you have eggless options?", "Yes. Ask at the counter and we will show you what is available today."], ["Can I sit and work?", "Of course. Stay as long as you like."]],
    ctaTitle: ["Fancy something fresh?", "Come in for a cup"], ctaText: ["Drop by {brand} today, or call to place an order.", "See you at {brand}."] },
  { id: "clinic", label: "Clinic or health", re: /clinic|doctor|dr\.|hospital|patient|treatment|health ?care|dental|dentist|physio|diagnos|medical|therapy|consultation|surgery|ayurved|homeo/gi,
    eyebrow: ["Care you can trust{city}", "Clinic{city}", "Health & care"], titles: ["Care that puts you first", "Good health starts with being heard", "Clear advice, gentle care"],
    texts: ["{brand} offers careful, unhurried care, with every step explained in plain words.", "At {brand} you are listened to first. Then we plan your care together."],
    cta: ["Book an appointment", "Call the clinic"], taglines: ["Care that listens", "Gentle, clear and careful"],
    svcTitle: "How we can help", svcIntro: "Consultation, treatment and follow-up in one place.",
    services: [["Consultation", "Time to talk through your concern, with clear answers."], ["Diagnosis", "The checks you need, explained before and after."], ["Treatment", "A plan that fits you, with options where there are any."], ["Follow-up", "We stay in touch until you are well."], ["Preventive care", "Regular check-ups that catch problems early."]],
    faq: [["Do I need an appointment?", "An appointment saves you waiting. Call or book online."], ["What should I bring?", "Any earlier reports and a list of medicines you take."], ["Do you see children and seniors?", "Yes. Tell us when you book, so we can plan the time."]],
    ctaTitle: ["Need to see us?", "We are here to help"], ctaText: ["Book an appointment at {brand}.", "Call {brand} and we will find a time that suits you."] },
  { id: "salon", label: "Salon or beauty", re: /salon|beauty|hair|makeup|make-up|bridal|spa\b|skin|facial|nails?|grooming|parlou?r|massage|wax/gi,
    eyebrow: ["Salon & beauty{city}", "Hair · Skin · Makeup", "Look good, feel good"], titles: ["Step out feeling your best", "Your time to be looked after", "Beauty, done with care"],
    texts: ["{brand} is a calm, clean space where trained hands look after your hair, skin and style.", "At {brand} we listen to what you want, then take our time to get it right."],
    cta: ["Book an appointment", "See our services"], taglines: ["Look good, feel good", "Your time to shine"],
    svcTitle: "Our services", svcIntro: "From a quick trim to the big day.",
    services: [["Hair", "Cuts, colour and styling to suit you."], ["Skin care", "Facials and treatments chosen for your skin."], ["Makeup", "For parties, shoots and special days."], ["Bridal", "The full plan for the bride, with a trial beforehand."], ["Grooming", "Neat, quick and comfortable."], ["Spa", "Time to rest and reset."]],
    faq: [["Do I need to book?", "Booking ahead means no waiting. Walk-ins are welcome when there is a free chair."], ["Do you do bridal packages?", "Yes. Tell us the date and we will plan it with a trial."], ["Which products do you use?", "Professional products, chosen to suit your hair and skin. Tell us about any allergy."]],
    ctaTitle: ["Ready for a fresh look?", "Book your chair"], ctaText: ["Book your appointment at {brand}.", "Call {brand} and choose a time."] },
  { id: "fitness", label: "Gym or fitness", re: /gym|fitness|workout|yoga|trainer|training plan|crossfit|pilates|zumba|strength|weight loss|membership/gi,
    eyebrow: ["Fitness{city}", "Train · Move · Feel better", "Your gym{city}"], titles: ["Stronger, one session at a time", "Fitness that fits your life", "Start where you are"],
    texts: ["{brand} helps you build a routine you can keep, with trainers who know your name.", "Whatever your starting point, {brand} has a plan and a place for you."],
    cta: ["Book a trial session", "See the plans"], taglines: ["Stronger every day", "Fitness that fits you"],
    svcTitle: "Ways to train", svcIntro: "Pick what suits you, change it when you like.",
    services: [["Personal training", "One trainer, one plan, made for your goal."], ["Group classes", "Train together and keep each other going."], ["Strength", "Learn the lifts safely and build up steadily."], ["Yoga & mobility", "Move better and recover well."], ["Nutrition guidance", "Simple eating habits that support your training."]],
    faq: [["I am a beginner. Can I join?", "Yes. We start with the basics and move at your pace."], ["Can I try before joining?", "Yes. Book a trial session and see how it feels."], ["What should I bring?", "Comfortable clothes, shoes and a water bottle."]],
    ctaTitle: ["Ready to start?", "Your first session is waiting"], ctaText: ["Book a trial at {brand}.", "Come and train with {brand}."] },
  { id: "legal", label: "Law or advisory", re: /law ?firm|lawyer|advocate|legal|litigation|attorney|court|contract|compliance|notary|solicitor/gi,
    eyebrow: ["Legal advice{city}", "Advocates & advisors", "Clear counsel"], titles: ["Clear legal advice when it matters", "Your matter, handled with care", "Straight answers, steady hands"],
    texts: ["{brand} explains where you stand in plain words, and stays with you until the matter is closed.", "At {brand} every client gets direct access to the person handling their matter."],
    cta: ["Book a consultation", "Talk to us"], taglines: ["Clear counsel, steady hands", "Plain words, careful work"],
    svcTitle: "Areas of work", svcIntro: "Advice and representation, explained step by step.",
    services: [["Consultation", "A first meeting to understand your matter and your options."], ["Documentation", "Agreements and notices drafted clearly and correctly."], ["Disputes", "Careful preparation and steady representation."], ["Business advice", "Day-to-day legal support for companies."], ["Property matters", "Checks and paperwork done properly."]],
    faq: [["What happens in the first meeting?", "We listen, look at your papers and explain your options and the likely steps."], ["How are fees decided?", "We explain the fees before any work begins."], ["Is what I tell you confidential?", "Yes. Everything you share stays with us."]],
    ctaTitle: ["Have a legal question?", "Talk it through with us"], ctaText: ["Book a consultation with {brand}.", "Call {brand} to arrange a meeting."] },
  { id: "finance", label: "Accounts or finance", re: /account(ant|ing)|chartered|audit|tax|gst|bookkeeping|financial|wealth|investment|insurance|loan|payroll/gi,
    eyebrow: ["Accounts & tax{city}", "Finance made clear", "Advisors"], titles: ["Your numbers, in good order", "Finance explained in plain words", "Less paperwork, more clarity"],
    texts: ["{brand} keeps your accounts tidy and your filings on time, and explains what the numbers mean.", "With {brand} you always know where you stand and what comes next."],
    cta: ["Book a call", "Talk to us"], taglines: ["Numbers in good order", "Clarity for your finances"],
    svcTitle: "What we do", svcIntro: "Regular work done on time, and advice when you need it.",
    services: [["Accounting", "Books kept accurately, month after month."], ["Tax", "Returns prepared and filed on time."], ["GST & compliance", "Registrations, filings and reminders handled."], ["Audit", "Careful reviews with clear reports."], ["Advisory", "Plans for growth, funding and the year ahead."]],
    faq: [["Can you take over from my current accountant?", "Yes. We handle the handover and tell you what we need."], ["How do we share documents?", "Whichever way is easy for you. We keep them organised and safe."], ["Do you work with small businesses?", "Yes, from a first registration to yearly filings."]],
    ctaTitle: ["Want your accounts sorted?", "Let's look at your numbers"], ctaText: ["Book a call with {brand}.", "Talk to {brand} about what you need."] },
  { id: "property", label: "Property or construction", re: /real estate|property|properties|builder|construction|apartment|villa|plots?\b|contractor|civil work|renovation|developer|flats?\b/gi,
    eyebrow: ["Property{city}", "Building & construction", "Homes & spaces"], titles: ["Spaces built to last", "Find the right place, with the right people", "Good work, on time"],
    texts: ["{brand} plans carefully, builds properly and keeps you informed at every stage.", "From the first visit to the handover, {brand} gives you straight answers."],
    cta: ["Book a site visit", "Talk to us"], taglines: ["Built with care", "Straight answers, solid work"],
    svcTitle: "What we do", svcIntro: "One team from plan to handover.",
    services: [["Planning", "Clear plans and honest estimates before work starts."], ["Construction", "Quality materials and supervised work."], ["Renovation", "Old spaces made new, with little disruption."], ["Buying & selling", "Help with choosing, paperwork and closing."], ["After-care", "We remain a call away after the handover."]],
    faq: [["Can I visit a site?", "Yes. Book a visit and we will walk you through."], ["How do you keep me updated?", "Regular updates with photos, and one person to call."], ["Do you help with paperwork?", "Yes. We guide you through each document."]],
    ctaTitle: ["Planning a project?", "Let's talk about your space"], ctaText: ["Book a visit with {brand}.", "Call {brand} to get started."] },
  { id: "interior", label: "Interiors or architecture", re: /interior|architect|decor|furniture|modular|kitchen design|wardrobe|landscape|space planning/gi,
    eyebrow: ["Interiors{city}", "Design & build", "Spaces that feel like you"], titles: ["Spaces that feel like home", "Thoughtful design, carefully built", "Your space, well made"],
    texts: ["{brand} designs spaces around how you live and work, then builds them with care.", "At {brand} good design starts with listening."],
    cta: ["Book a design visit", "See our work"], taglines: ["Thoughtful design, well built", "Spaces that feel like you"],
    svcTitle: "What we do", svcIntro: "Design and making, under one roof.",
    services: [["Home interiors", "Rooms planned around your day."], ["Kitchens & wardrobes", "Storage that works, made to measure."], ["Offices & shops", "Spaces that suit your brand and your team."], ["Design consultation", "Layouts, materials and colours chosen with you."], ["Turnkey projects", "One team from drawing to handover."]],
    faq: [["How do we begin?", "With a visit to see the space and hear what you want."], ["Will I see the design first?", "Yes. You approve the design and materials before work begins."], ["How long does a project take?", "It depends on the space. You get a schedule before we start."]],
    ctaTitle: ["Thinking of a new look?", "Let's plan your space"], ctaText: ["Book a design visit with {brand}.", "Talk to {brand} about your space."] },
  { id: "education", label: "Coaching or education", re: /school|coaching|tuition|classes|academy|students?|courses?|training institute|learning|exam|syllabus|teacher|tutor|college/gi,
    eyebrow: ["Learning{city}", "Classes & coaching", "Academy"], titles: ["Learning that builds confidence", "Good teaching, small batches", "Understand it, don't just memorise it"],
    texts: ["{brand} teaches in small groups, so every student is noticed and every doubt is cleared.", "At {brand} students learn the why, not just the answer."],
    cta: ["Enquire about classes", "Book a demo class"], taglines: ["Learning with confidence", "Small batches, clear concepts"],
    svcTitle: "What we offer", svcIntro: "Classes planned around the student.",
    services: [["Regular classes", "Steady teaching through the year."], ["Doubt sessions", "Extra time for questions."], ["Tests & feedback", "Regular practice, with feedback that helps."], ["Study material", "Clear notes and practice sets."], ["Parent updates", "Progress shared openly."]],
    faq: [["How big are the batches?", "Small, so that each student gets attention."], ["Can we attend a demo class?", "Yes. Ask us for the next one."], ["How do you share progress?", "Through regular tests and updates to parents."]],
    ctaTitle: ["Want to know more?", "Come and see a class"], ctaText: ["Ask {brand} about batches and timings.", "Book a demo class at {brand}."] },
  { id: "tech", label: "Software or digital agency", re: /software|web ?development|mobile app|apps?\b|saas|digital marketing|seo|agency|ui\/?ux|cloud|developers?|it services|automation|website design|branding/gi,
    eyebrow: ["Design & technology", "Digital studio{city}", "Software & web"], titles: ["Digital work that does its job", "Built well, shipped on time", "Clear ideas, careful building"],
    texts: ["{brand} plans, designs and builds digital products that are easy to use and easy to run.", "With {brand} you get one small team, clear updates and work you can see as it takes shape."],
    cta: ["Start a project", "Talk to us"], taglines: ["Built well, shipped on time", "Clear ideas, careful work"],
    svcTitle: "What we do", svcIntro: "Bring us in for one part, or for all of it.",
    services: [["Websites", "Fast, clear sites that are easy to update."], ["Apps", "Mobile and web apps built to last."], ["Design", "Interfaces people understand at first glance."], ["Marketing", "Search, social and campaigns that bring the right visitors."], ["Support", "Updates and fixes after launch."]],
    faq: [["How do projects start?", "With a call to understand the goal, then a plan and an estimate."], ["Will I see progress?", "Yes. You see working versions as we go."], ["Do you help after launch?", "Yes. We stay on for updates and support."]],
    ctaTitle: ["Have a project in mind?", "Let's build it properly"], ctaText: ["Tell {brand} what you need.", "Start a conversation with {brand}."] },
  { id: "industry", label: "Manufacturing or industry", re: /manufactur|industrial|machine|machinery|fabricat|engineering works|supplier|exporter|equipment|welding|tools|components?|factory|oem\b|pumps?|valves?/gi,
    eyebrow: ["Manufacturing{city}", "Engineering & supply", "Built to work"], titles: ["Built to work, day after day", "Reliable products, dependable supply", "Made right, delivered on time"],
    texts: ["{brand} makes and supplies products that are built properly and backed by service.", "At {brand} quality is checked at every step, and delivery dates are kept."],
    cta: ["Request a quote", "See our products"], taglines: ["Made right, delivered on time", "Built to work"],
    svcTitle: "What we offer", svcIntro: "Products, service and support from one supplier.",
    services: [["Products", "A range made to consistent standards."], ["Custom orders", "Made to your drawing or requirement."], ["Quality checks", "Inspected before it leaves us."], ["Delivery", "Packed well and sent on schedule."], ["Service & spares", "Support after the sale."]],
    faq: [["Do you take custom orders?", "Yes. Share your requirement and we will advise."], ["How do I get a quote?", "Send the details and quantity. We reply with price and delivery time."], ["Do you provide service?", "Yes. Our team supports what we supply."]],
    ctaTitle: ["Need a quote?", "Tell us your requirement"], ctaText: ["Send your requirement to {brand}.", "Talk to {brand} about what you need."] },
  { id: "jewellery", label: "Jewellery", re: /jewell?er|gold|diamond|silver|necklace|earrings?|bangles?|ornaments?|hallmark|gemstone/gi,
    eyebrow: ["Jewellery{city}", "Crafted to treasure", "Fine jewellery"], titles: ["Jewellery to treasure", "Crafted with care, worn with joy", "For the moments that matter"],
    texts: ["{brand} offers jewellery made with care, and honest advice on every piece.", "At {brand} you can take your time, ask anything and choose with confidence."],
    cta: ["See the collection", "Visit the store"], taglines: ["Crafted to treasure", "Made for your moments"],
    svcTitle: "What you will find", svcIntro: "Everyday pieces and designs for special days.",
    services: [["Everyday wear", "Light pieces for daily use."], ["Bridal", "Sets for the big day, chosen with you."], ["Custom designs", "Your idea, made by our craftsmen."], ["Gifts", "Something special for every budget."], ["Care & repair", "Cleaning, polishing and repairs."]],
    faq: [["Can you make a custom design?", "Yes. Bring a picture or an idea and we will work it out with you."], ["Do you provide a bill and details?", "Yes. Every piece comes with a proper bill and its details."], ["Do you repair old jewellery?", "Yes. Bring it in and we will take a look."]],
    ctaTitle: ["Looking for something special?", "Come and see the collection"], ctaText: ["Visit {brand} or get in touch.", "Ask {brand} about designs and custom orders."] },
  { id: "retail", label: "Shop or fashion", re: /shop|store|boutique|fashion|clothing|apparel|sarees?|kurta|footwear|handmade|handloom|collection|gifts?|decor items|order online|free shipping|cart/gi,
    eyebrow: ["Shop{city}", "New arrivals", "Made to be loved"], titles: ["Things you will love to own", "Chosen with care, made to last", "Fresh picks, fair prices"],
    texts: ["{brand} brings together well-made things, picked one by one.", "Every piece at {brand} is chosen for how it is made and how it feels to use."],
    cta: ["Shop now", "See what's new"], taglines: ["Chosen with care", "Well made, fairly priced"],
    svcTitle: "Why shop with us", svcIntro: "Good products and an easy way to buy them.",
    services: [["Carefully chosen", "Only what we would buy ourselves."], ["Quality checked", "Looked over before it is packed."], ["Easy ordering", "Order in a few taps."], ["Safe delivery", "Packed well and sent quickly."], ["Friendly help", "Message us with any question."]],
    faq: [["How long does delivery take?", "It depends on where you are. You see the estimate before you pay."], ["Can I return an item?", "See our returns page, or message us and we will help."], ["How can I pay?", "Choose from the options at checkout."]],
    ctaTitle: ["Seen something you like?", "Have a look around"], ctaText: ["Shop at {brand} today.", "Message {brand} with any question."] },
  { id: "travel", label: "Travel or stays", re: /travel|tours?\b|holiday|trip|itinerary|resort|hotel|homestay|rooms?\b|booking|tickets?|visa|trek|cab|taxi/gi,
    eyebrow: ["Travel{city}", "Trips & stays", "Go somewhere good"], titles: ["Trips planned with care", "Travel easy, come back happy", "A good stay starts here"],
    texts: ["{brand} plans the details, so you can enjoy the journey.", "With {brand} you get honest advice, clear prices and someone to call along the way."],
    cta: ["Plan my trip", "Check availability"], taglines: ["Travel easy", "Trips planned with care"],
    svcTitle: "What we arrange", svcIntro: "As much or as little as you want us to handle.",
    services: [["Trip planning", "Routes and days that suit your pace."], ["Stays", "Comfortable places, checked by us."], ["Transport", "Pick-ups and travel sorted in advance."], ["Group trips", "Family and group travel made simple."], ["On-trip help", "Someone to call if plans change."]],
    faq: [["Can you plan around my dates and budget?", "Yes. Tell us both and we will suggest options."], ["What is included?", "You get a clear list before you confirm."], ["What if my plans change?", "Tell us as early as you can and we will help."]],
    ctaTitle: ["Where to next?", "Start planning"], ctaText: ["Tell {brand} your dates.", "Ask {brand} for ideas and prices."] },
  { id: "events", label: "Events or photography", re: /wedding|events?\b|photograph|videograph|decorat|caterer|planner|studio shoot|pre-wedding|candid|celebration|party planner|dj\b/gi,
    eyebrow: ["Events & celebrations{city}", "Moments, well kept", "Photography & events"], titles: ["Your day, beautifully done", "Moments worth keeping", "Planned well, enjoyed fully"],
    texts: ["{brand} looks after the details, so you can be fully present on the day.", "At {brand} we listen first, then plan every part with you."],
    cta: ["Check your date", "See our work"], taglines: ["Moments worth keeping", "Your day, done well"],
    svcTitle: "What we do", svcIntro: "For big days and small gatherings.",
    services: [["Weddings", "From the first function to the last."], ["Photography", "Natural pictures that tell the story."], ["Films", "The day, to watch again."], ["Decor", "Settings that suit the occasion."], ["Planning", "One team to coordinate it all."]],
    faq: [["How early should we book?", "As soon as your date is fixed, so we can hold it for you."], ["Can we customise a package?", "Yes. Tell us what you need and we will shape it."], ["When do we get the photos?", "We tell you the timeline when you book."]],
    ctaTitle: ["Is your date free?", "Let's plan your day"], ctaText: ["Ask {brand} about your date.", "Tell {brand} about your event."] },
  { id: "auto", label: "Vehicles or repairs", re: /car\b|cars\b|bike|garage|automobile|vehicle|servicing|repair|workshop|tyres?|detailing|mechanic|spare parts|electrician|plumb|ac service|appliance/gi,
    eyebrow: ["Service & repair{city}", "Workshop", "Done right"], titles: ["Honest service, done right", "Fixed properly, the first time", "Service you can rely on"],
    texts: ["{brand} checks carefully, explains the work and charges fairly.", "At {brand} you are told what is needed and what can wait."],
    cta: ["Book a service", "Call us"], taglines: ["Honest work, fair prices", "Fixed properly"],
    svcTitle: "What we do", svcIntro: "Regular service and repairs by trained hands.",
    services: [["Regular service", "Checks and care that prevent trouble."], ["Repairs", "Faults found and fixed properly."], ["Genuine parts", "Quality parts, with a bill."], ["Pick-up & drop", "Ask us when you book."], ["Emergency help", "Call us if you are stuck."]],
    faq: [["How long does a service take?", "We give you a time when you book and keep you posted."], ["Will you tell me the cost first?", "Yes. You approve the estimate before work begins."], ["Is the work guaranteed?", "Ask us about the cover on the work done."]],
    ctaTitle: ["Due for a service?", "Book your slot"], ctaText: ["Book with {brand} today.", "Call {brand} and we will take it from there."] },
  { id: "general", label: "Business", re: /$^/g,
    eyebrow: ["Welcome to {brand}", "Trusted{city}", "Here to help"], titles: ["Good work, done with care", "We are here to help", "Reliable, friendly and fair"],
    texts: ["{brand} does careful work, keeps its word and treats every customer well.", "At {brand} you get clear answers, fair prices and work done properly."],
    cta: ["Get in touch", "Talk to us"], taglines: ["Good work, done with care", "Reliable and fair"],
    svcTitle: "What we do", svcIntro: "Tell us what you need and we will guide you.",
    services: [["Our work", "Done carefully, checked before it reaches you."], ["Advice", "Honest guidance on what suits you."], ["Fair prices", "Clear costs, explained up front."], ["On time", "We keep to the dates we give."], ["Support", "We are a call away afterwards."]],
    faq: [["How do I get started?", "Call or message us and tell us what you need."], ["How much will it cost?", "We explain the cost before any work begins."], ["Where are you?", "Our address and timings are on the contact page."]],
    ctaTitle: ["How can we help?", "Let's talk"], ctaText: ["Get in touch with {brand}.", "Call or message {brand} today."] },
];
const VALUES: Pair[] = [["Honesty", "Straight answers and fair prices."], ["Care", "We treat your work as our own."], ["Quality", "Done properly, checked twice."], ["On time", "We keep to what we promise."], ["Respect", "For your time, your budget and your trust."], ["Listening", "We start by understanding what you need."]];
const PROCESS: Pair[] = [["Tell us what you need", "A call, a message or a visit: whichever is easy."], ["We suggest a plan", "Clear options, costs and timing."], ["We do the work", "Carefully, with updates along the way."], ["We stay in touch", "After it is done, we are still a call away."]];
const ABOUT = ["{brand} is a team that takes pride in doing things properly. We keep things simple: listen well, be honest, and do the work with care.", "{brand} was started with one idea: treat every customer the way we would like to be treated. That means clear answers, fair prices and work we are proud of.", "At {brand} we believe good work speaks for itself. We take the time to understand what you need, and we do not cut corners."];
const MISSION = ["To do honest, careful work for every customer.", "To make every customer glad they chose us.", "To keep things simple, fair and well done."];
const VISION = ["To be the name people{city} recommend to their friends.", "To grow by word of mouth, one happy customer at a time."];
const PERSON = {
  eyebrow: ["Hello, I'm {brand}", "{brand}", "Portfolio"], roles: ["I help people and teams turn ideas into finished work.", "I make things that are clear, useful and carefully finished.", "I solve problems with care and see the work through."],
  about: ["I enjoy work that asks for both thought and care. I like to understand the problem first, keep things simple, and finish what I start.", "I have learned most by doing: taking on real work, listening to the people it is for, and improving it step by step."],
  skills: [["Understanding the problem", "Asking the right questions before starting."], ["Planning", "Breaking work into clear steps."], ["Making", "Careful, finished work."], ["Communication", "Plain words and regular updates."], ["Working with teams", "Easy to work with, quick to help."], ["Learning", "Picking up new tools as the work needs."]] as Pair[],
  cta: ["Let's work together", "Have something in mind?"], ctaText: ["Tell me about your project and I will reply soon.", "Write to me and let's see how I can help."],
};

const words = (s: string) => (s.match(/[\p{L}\p{N}'’-]+/gu) || []);
/** A small, repeatable shuffle: the same brand and try give the same text; "Write again" gives another. */
function picker(seed: string) {
  let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return <T,>(list: T[]): T => { h = Math.imul(h ^ (h >>> 15), 2246822507) ^ 0x9e3779b9; return list[Math.abs(h) % list.length]; };
}
/** The kind of business the reference and the notes describe. */
export function detectPack(text: string, kind: string): { id: string; label: string; score: number } {
  if (kind === "restaurant") { const cafe = (text.match(PACKS[1].re) || []).length, rest = (text.match(PACKS[0].re) || []).length; const p = cafe > rest * 1.5 ? PACKS[1] : PACKS[0]; return { id: p.id, label: p.label, score: Math.max(cafe, rest) }; }
  let best = PACKS[PACKS.length - 1], top = 0;
  for (const p of PACKS) { const n = (text.match(p.re) || []).length; if (n > top) { top = n; best = p; } }
  if (kind === "store" && top < 3) best = PACKS.find((p) => p.id === "retail")!;
  return { id: best.id, label: best.label, score: top };
}
const cityOf = (notes: string) => { const m = /\b(?:in|at|from|based in|located in)\s+([A-Z][a-zA-Z]{2,}(?:\s[A-Z][a-zA-Z]{2,})?)\b/.exec(notes); return m && !/^(The|Our|We|This|India)$/.test(m[1]) ? m[1] : ""; };

export type SystemBrief = { brief: Brief; flagged: string[]; kind: string; label: string };
/** New text for `brand`. `text`: the reference's words (read only to tell the kind of business). `again`: another version. */
export function systemWrite(o: { brand: string; notes?: string; kind: string; text?: string; again?: number }): SystemBrief {
  const brand = o.brand.trim(), notes = String(o.notes || "").trim(), ref = String(o.text || "");
  if (!brand) throw new Error("Enter your brand name.");
  const found = detectPack(ref + "\n" + notes, o.kind), P = PACKS.find((p) => p.id === found.id)!;
  const pick = picker(brand.toLowerCase() + "|" + P.id + "|" + (o.again || 0));
  const city = cityOf(notes), fill = (s: string) => s.replace(/\{brand\}/g, brand).replace(/\{city\}/g, city ? " in " + city : "").replace(/\s+([.,])/g, "$1");
  const noteLine = notes ? notes.replace(/\s+/g, " ").replace(/([^.!?])$/, "$1.") : "";
  if (o.kind === "portfolio") {
    const skills = [...PERSON.skills].sort(() => 0).slice(0, 6);
    const brief: Brief = {
      brand_tagline: fill(pick(PERSON.roles)), hero_eyebrow: fill(pick(PERSON.eyebrow)), hero_title: brand, hero_text: fill(pick(PERSON.roles)), hero_cta: "Get in touch",
      about_title: "About me", about_text: [noteLine, fill(pick(PERSON.about))].filter(Boolean).join("\n\n"),
      services_title: "What I do", services_intro: "The parts of the work I enjoy most.", services: skills.map(([title, text]) => ({ title, text })),
      cta_title: pick(PERSON.cta), cta_text: pick(PERSON.ctaText), seo_title: brand + " · Portfolio", seo_description: fill(pick(PERSON.roles)).slice(0, 155), footer_text: "",
    };
    return { brief, flagged: [], kind: "person", label: "Personal portfolio" };
  }
  const title = fill(pick(P.titles)), tagline = fill(pick(P.taglines)), heroText = fill(pick(P.texts));
  const services = P.services.slice(0, 6).map(([t, x]) => ({ title: t, text: fill(x) }));
  const brief: Brief = {
    brand_tagline: tagline, hero_eyebrow: fill(pick(P.eyebrow)), hero_title: title, hero_text: heroText, hero_cta: pick(P.cta),
    about_title: "About " + brand, about_text: [fill(pick(ABOUT)), noteLine].filter(Boolean).join("\n\n"), mission: pick(MISSION), vision: fill(pick(VISION)),
    services_title: P.svcTitle, services_intro: fill(P.svcIntro), services,
    values: [...VALUES].sort((a, b) => (pick([0, 1]) ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0]))).slice(0, 4).map(([t, x]) => ({ title: t, text: x })),
    process: PROCESS.map(([t, x]) => ({ title: t, text: x })), faq: P.faq.map(([q, a]) => ({ q, a: fill(a) })),
    banner_title: fill(pick(P.titles)), banner_text: fill(pick(P.texts)),
    cta_title: pick(P.ctaTitle), cta_text: fill(pick(P.ctaText)),
    seo_title: `${brand} · ${tagline}`.slice(0, 60), seo_description: (heroText + (city ? " Based in " + city + "." : "")).slice(0, 155), footer_text: tagline + ".",
  } as Brief;
  return { brief, flagged: [], kind: P.id, label: P.label };
}
/** Enough words to tell what the reference is about. */
export const enoughText = (s: string) => words(s).length >= 20;
