// Words for an event website that depend on the kind of event: who is on stage, what registration is called, and the
// sample page a theme of that kind is previewed with (a Wedding theme shows a wedding, not a conference).
// {type} is the kind of event in lower case, {Type} as written, {name} the sample event's name.
import { EVT_TYPE_INFO } from "../themes/events";

type Person = [name: string, role: string, topic: string];
type Slot = [time: string, title: string, who: string, place: string, tag: string];
type Tk = [name: string, price: number, blurb: string, features: string[], featured?: boolean];
type Pack = {
  /** The sample event's name: a word put before the type, or a whole name. */
  word: string; tagline: string; eyebrow: string; title: string; lede: string; badges: string[]; cta: string; cta2: [label: string, to: string];
  about: [title: string, body: string]; values: [string, string][];
  highlightsTitle: [eyebrow: string, title: string, lede: string]; highlights: [icon: string, title: string, body: string][];
  stats: [string, string][]; lineup: [title: string, lede: string]; people: Person[];
  schedule: [title: string, lede: string]; days: [label: string, items: Slot[]][];
  tickets: [title: string, lede: string, note: string]; venue: [string, string][]; faq: [string, string][]; quotes: [quote: string, name: string, role: string][];
  ctaBand: [title: string, body: string]; sponsors: string; hide?: string[]; city?: string; venueName?: string;
};
const P: Record<string, Pack> = {
  Business: {
    word: "Horizon", tagline: "Where the industry meets to decide what's next", eyebrow: "{Type} · 2027", title: "Where the industry meets\nto decide *what's next*.",
    lede: "Talks, workshops and conversations with the people shaping the field. Come for the sessions, stay for the people you meet.", badges: ["40+ speakers", "1,200 attendees", "2 days, 3 stages"], cta: "Register now", cta2: ["See the schedule", "schedule"],
    about: ["A gathering built around conversations", "{name} brings together people who design, build and lead. You'll hear practical talks, join working sessions and meet others solving the same problems as you.\n\nIt's independent, carefully curated and small enough that you can actually talk to the speakers."],
    values: [["Practical", "Sessions you can apply, from people who have done the work."], ["Open", "Speakers stay for the whole event and join the conversations."], ["Welcoming", "A code of conduct, quiet spaces and an accessible venue."]],
    highlightsTitle: ["What to expect", "Made to be useful, not just inspiring", "Every session is chosen so you leave with something you can use on Monday."],
    highlights: [["mic", "Keynotes", "Big-picture talks from people who have built and led at scale."], ["layers", "Working sessions", "Small rooms, real exercises and experts on hand to help."], ["people", "Networking", "Curated meet-ups so you find the people you came to meet."], ["rocket", "Showcase", "New products and demos from teams doing interesting work."]],
    stats: [["40+", "Speakers"], ["1,200", "Attendees"], ["24", "Sessions"], ["2", "Days"]], lineup: ["Who you'll hear from", "Builders, leaders and specialists sharing what they've learned."],
    people: [["Ananya Rao", "Chief Product Officer, Arcadia", "Keynote: Products people keep"], ["David Mercer", "Head of Design, Lumen", "Design systems at scale"], ["Karan Mehta", "Founder, Vertex Labs", "From prototype to platform"], ["Sara Lindqvist", "VP Engineering, Stratus", "Teams that ship"]],
    schedule: ["What's on", "Times are local. The programme may change a little before the day."],
    days: [["Day 1", [["09:30", "Doors open & registration", "", "Main foyer", ""], ["10:30", "Opening keynote", "Ananya Rao", "Main stage", "Keynote"], ["12:00", "Design systems at scale", "David Mercer", "Stage 2", "Talk"], ["13:00", "Lunch & networking", "", "Terrace", "Break"], ["14:30", "Working session: From prototype to platform", "Karan Mehta", "Room 3", "Session"], ["18:30", "Evening social", "", "Rooftop", "Social"]]],
      ["Day 2", [["10:00", "Teams that ship", "Sara Lindqvist", "Main stage", "Talk"], ["11:30", "Panel: What we'd do differently", "All speakers", "Main stage", "Panel"], ["14:00", "Showcase", "", "Expo hall", "Showcase"], ["16:30", "Closing conversation", "", "Main stage", "Keynote"]]]],
    tickets: ["Choose your pass", "Prices include all sessions and lunch.", "Group of five or more? Write to us for a group rate."],
    venue: [["By metro", "Five minutes' walk from the nearest station."], ["Parking", "Paid parking in the basement, with spaces kept for accessible vehicles."], ["Stay nearby", "Partner hotels within walking distance. Ask us for the event rate."]],
    faq: [["Can I get a refund?", "Yes, up to 14 days before the event. After that you can pass your place to someone else."], ["Is the venue accessible?", "Yes. Step-free access, accessible toilets and reserved seating. Tell us what you need when you register."], ["Will sessions be recorded?", "Main stage sessions are recorded and sent to registered attendees afterwards."], ["Is food included?", "Lunch and refreshments are included. Tell us about dietary needs when you register."]],
    quotes: [["The most useful two days I spent all year. I came back with a notebook full of things to try.", "Priya Nair", "Product Lead, Arcadia Bank"], ["Small enough to meet everyone, big enough to hear from the best. Already booked for next year.", "James Whitfield", "Founder, Orbit"]],
    ctaBand: ["Seats are limited.", "Register today to be sure of your place."], sponsors: "Supported by",
  },
  Learning: {
    word: "Brightside", tagline: "Learn it properly, from people who do it every day", eyebrow: "{Type} · Limited seats", title: "Learn it properly, from people\nwho *do it every day*.",
    lede: "A hands-on {type} with small groups, real practice and time for your questions. You leave able to do the thing, not just knowing about it.", badges: ["Small groups", "Hands-on practice", "Certificate included"], cta: "Reserve your seat", cta2: ["What you'll learn", "services"],
    about: ["Built for people who want to get good", "{name} is taught by practitioners. Each session mixes a short demonstration with guided practice, so you try everything yourself while help is close by.\n\nNo long slideshows. Bring your questions and your own examples."],
    values: [["Practical", "More doing than listening."], ["Small", "Groups small enough for individual feedback."], ["Supported", "Notes, recordings and a follow-up session."]],
    highlightsTitle: ["What you'll learn", "Skills you can use the next day", "A clear path from the basics to working on your own."],
    highlights: [["compass", "Foundations", "The ideas everything else builds on, explained plainly."], ["layers", "Guided practice", "Exercises with an instructor beside you."], ["spark", "Your own project", "Apply it to something of yours and get feedback."], ["people", "Questions & community", "Open Q&A, and a group that keeps going afterwards."]],
    stats: [["30", "Seats"], ["6", "Hours of practice"], ["4.9/5", "Average rating"], ["1,500+", "Past learners"]], lineup: ["Your instructors", "Practitioners who teach what they do every day."],
    people: [["Meera Iyer", "Lead instructor", "Foundations and guided practice"], ["Arjun Shah", "Senior practitioner", "Working on your own project"], ["Leila Haddad", "Guest speaker", "Lessons from the field"]],
    schedule: ["The plan", "Breaks are included. Times may shift a little on the day."],
    days: [["Session plan", [["10:00", "Welcome and set-up", "", "", ""], ["10:30", "Foundations", "Meera Iyer", "", "Teach"], ["12:00", "Guided practice", "", "", "Practice"], ["13:00", "Lunch break", "", "", "Break"], ["14:00", "Your own project", "Arjun Shah", "", "Practice"], ["16:00", "Questions and next steps", "All instructors", "", "Q&A"]]]],
    tickets: ["Choose your seat", "Everything you need is included.", "Need an invoice in your company's name? Tell us when you register."],
    venue: [["What to bring", "A laptop and a charger. Everything else is provided."], ["Getting there", "Close to public transport, with parking nearby."], ["Online option", "Can't travel? Ask us about joining online."]],
    faq: [["Do I need any experience?", "No. We start from the basics and move at the group's pace."], ["Will I get a certificate?", "Yes, everyone who completes the sessions gets a certificate."], ["What if I miss a part?", "You get the notes and the recording, and can ask questions in the follow-up session."], ["Can my company pay?", "Yes. Register and choose to be invoiced, or write to us for a group booking."]],
    quotes: [["Clear, patient and practical. I used what I learned the very next morning.", "Rahul Verma", "Analyst"], ["The small group made all the difference. I finally got my questions answered.", "Sophie Martin", "Designer"]],
    ctaBand: ["Seats fill up fast.", "Reserve yours today."], sponsors: "In partnership with",
  },
  Competition: {
    word: "Catalyst", tagline: "Build something bold, and show it to the world", eyebrow: "{Type} · 48 hours", title: "Build something bold\nin *48 hours*.",
    lede: "Form a team, pick a challenge and ship. Mentors on hand, prizes on the table, and a room full of people who love to build.", badges: ["₹5,00,000 in prizes", "Mentors from industry", "Open to all"], cta: "Register your team", cta2: ["See the challenges", "services"],
    about: ["A weekend of making", "{name} is for people who learn by building. Teams of two to four take on a real challenge, with mentors dropping in and judges who give useful feedback.\n\nBeginners are welcome: come alone and we'll help you find a team."],
    values: [["Open", "Students and professionals, first-timers and veterans."], ["Fair", "Clear rules and judging criteria, shared up front."], ["Fun", "Good food, good music and the odd mini-game at 2 am."]],
    highlightsTitle: ["The challenges", "Pick a track and get started", "Each track has its own mentors and its own prize."],
    highlights: [["rocket", "Open innovation", "Solve any problem you care about."], ["shield", "Trust & safety", "Tools that keep people and data safe."], ["leaf", "Climate", "Ideas that help people use less and waste less."], ["heart", "Health", "Better care, closer to home."]],
    stats: [["₹5L", "Prize pool"], ["300", "Participants"], ["48", "Hours"], ["20", "Mentors"]], lineup: ["Judges & mentors", "People who build for a living, here to help you ship."],
    people: [["Nikhil Menon", "CTO, Vertex Labs", "Head judge"], ["Farah Khan", "Staff Engineer, Stratus", "Mentor: platforms"], ["Tom Becker", "Founder, Northwind", "Mentor: product and pitch"], ["Riya Kapoor", "Investor", "Judge"]],
    schedule: ["How the weekend runs", "Check-in closes an hour after doors open."],
    days: [["Day 1", [["09:00", "Check-in and breakfast", "", "Lobby", ""], ["10:00", "Kick-off and challenges", "", "Main hall", "Kick-off"], ["11:00", "Team formation", "", "Main hall", ""], ["12:00", "Hacking begins", "", "", "Build"], ["18:00", "Mentor rounds", "", "", "Mentors"]]],
      ["Day 2", [["09:00", "Breakfast and check-in", "", "", ""], ["12:00", "Submissions close", "", "", "Deadline"], ["13:00", "Demos to the judges", "", "Main hall", "Demos"], ["16:00", "Finals and prize-giving", "", "Main stage", "Finals"]]]],
    tickets: ["Enter a team", "One entry per team.", "Coming alone? Register anyway and we'll help you find a team."],
    venue: [["What to bring", "Laptop, charger and an ID. We provide food, Wi-Fi and power."], ["Staying overnight", "The hall is open all night, with a quiet room to rest."], ["Getting there", "Close to public transport. Limited parking on site."]],
    faq: [["Who can take part?", "Anyone aged 16 or over. Students and professionals compete together unless a category says otherwise."], ["How big is a team?", "Two to four people. You can register alone and join a team at kick-off."], ["Who owns what we build?", "You do. We only ask to show the demos."], ["How is it judged?", "On usefulness, originality, how well it works and how clearly you present it."]],
    quotes: [["We arrived as strangers and left with a working product and a plan to keep going.", "Team Loop", "Winners, last edition"], ["The mentors actually sat down and helped. Best weekend of the year.", "Aditi", "Participant"]],
    ctaBand: ["Got an idea?", "Bring it, and a team to build it with."], sponsors: "Powered by",
  },
  Stage: {
    word: "Afterglow", tagline: "One night. Turn it up.", eyebrow: "Live · {Type}", title: "One night.\n*Turn it up.*",
    lede: "Big sound, bright lights and a crowd that came to feel something. Doors open early, so come for the whole night.", badges: ["Doors 6 pm", "All ages welcome", "Food & drinks on site"], cta: "Get tickets", cta2: ["See the line-up", "team"],
    about: ["A night made for the front row", "{name} brings the artists you love to a stage built for them: proper sound, a clear view from everywhere and room to move.\n\nCome early for the opening acts and stay late for the encore."],
    values: [["Loud", "A sound system tuned for the room."], ["Close", "Sightlines that work from every spot."], ["Safe", "Trained staff, water points and a clear way home."]],
    highlightsTitle: ["On the night", "More than a show", "Everything around the stage is worth turning up for, too."],
    highlights: [["mic", "Headline sets", "Full-length sets from every headliner."], ["spark", "Opening acts", "New artists you'll be glad you caught early."], ["heart", "Food & drink", "Local kitchens and bars, open all night."], ["people", "Meet & greet", "For VIP ticket holders, before the show."]],
    stats: [["6", "Artists"], ["5,000", "Capacity"], ["5 hrs", "Of live music"], ["1", "Unforgettable night"]], lineup: ["The line-up", "More names to be announced."],
    people: [["The Midnight Collective", "Headliner", "Closing set"], ["Zara Noor", "Singer-songwriter", "Sunset set"], ["Indigo Drive", "Band", "Opening the main stage"], ["DJ Kairo", "DJ", "After-hours set"]],
    schedule: ["Set times", "Times can change on the day. Arrive early."],
    days: [["On the night", [["18:00", "Doors open", "", "", ""], ["19:00", "Indigo Drive", "", "Main stage", "Live"], ["20:00", "Zara Noor", "", "Main stage", "Live"], ["21:15", "The Midnight Collective", "", "Main stage", "Headliner"], ["23:00", "DJ Kairo", "", "Late stage", "DJ set"]]]],
    tickets: ["Tickets", "Prices include all fees.", "Tickets are shown on your phone at the gate. No re-entry."],
    venue: [["Getting there", "Late trains and buses run after the show. Ride-share pick-up is at Gate 2."], ["Bags", "Small bags only. Lockers are available at the entrance."], ["Accessibility", "A viewing platform and step-free routes. Write to us to book a place."]],
    faq: [["Is there an age limit?", "All ages are welcome. Under-16s must come with an adult."], ["Can I get a refund?", "Tickets are non-refundable, but you can pass yours to a friend."], ["What can't I bring?", "Outside food and drink, professional cameras and anything sharp."], ["What if it rains?", "The show goes on. Bring a poncho; umbrellas block the view."]],
    quotes: [["Best sound I've heard at a show in years, and the crowd was electric.", "Kabir", "Came last time"], ["We came for one act and left with three new favourites.", "Alisha", "Came last time"]],
    ctaBand: ["Tickets are going fast.", "Get yours before they're gone."], sponsors: "Presented with",
  },
  Arts: {
    word: "Lumen", tagline: "Come and see what's new", eyebrow: "{Type} · Opening soon", title: "Come and see\n*what's new*.",
    lede: "New work, the people who made it and an evening to take it in. Join us for the opening, or visit while it's on.", badges: ["Opening night", "Meet the artists", "Free for under-12s"], cta: "Book your place", cta2: ["What's on", "schedule"],
    about: ["Work worth standing in front of", "{name} brings together new work chosen with care. Take your time, talk to the people who made it and stay for the conversation afterwards.\n\nEveryone is welcome, whether it's your first visit or your fiftieth."],
    values: [["Curated", "A small selection, each piece chosen for a reason."], ["Open", "The artists are here, and happy to talk."], ["Unhurried", "Timed entry, so there is room to look."]],
    highlightsTitle: ["What's on", "An evening, and a season", "Come once or keep coming back."],
    highlights: [["spark", "Opening night", "First look, with the artists in the room."], ["mic", "Talks", "Short conversations about how the work was made."], ["people", "Guided walks", "A curator's tour, twice a day."], ["heart", "For families", "A trail and activity sheet for younger visitors."]],
    stats: [["30", "Works"], ["12", "Artists"], ["3", "Weeks"], ["Free", "Under 12"]], lineup: ["The artists", "Meet the people behind the work."],
    people: [["Ira Sen", "Painter", "New series: Quiet Rooms"], ["Mateo Ruiz", "Photographer", "Street portraits"], ["Hana Okafor", "Sculptor", "Works in clay and steel"], ["Dev Malhotra", "Curator", "In conversation"]],
    schedule: ["Dates & times", "Last entry is 45 minutes before closing."],
    days: [["Opening night", [["18:00", "Doors open", "", "", ""], ["18:30", "Welcome from the curator", "Dev Malhotra", "Main room", "Talk"], ["19:00", "Artists in conversation", "", "Main room", "Talk"], ["20:00", "Music and refreshments", "", "Courtyard", "Social"]]],
      ["Every day", [["11:00", "Open to visitors", "", "", ""], ["12:00", "Guided walk", "", "Meet at the entrance", "Tour"], ["16:00", "Guided walk", "", "Meet at the entrance", "Tour"], ["19:00", "Closes", "", "", ""]]]],
    tickets: ["Tickets", "Book a time so there's room to look.", "Members and under-12s come free. Bring your card."],
    venue: [["Getting there", "Ten minutes' walk from the station. Cycle stands outside."], ["Access", "Step-free throughout, with seating in every room."], ["Café & shop", "Open during visiting hours."]],
    faq: [["Can I take photos?", "Yes, without flash, unless a sign says otherwise."], ["How long does a visit take?", "Most people spend about an hour."], ["Is the work for sale?", "Much of it is. Ask at the desk for the price list."], ["Can I bring children?", "Please do. Under-12s come free, and there's a trail for them."]],
    quotes: [["I meant to stay twenty minutes and stayed two hours.", "Nandini", "Visitor"], ["Thoughtfully chosen and beautifully hung. A real pleasure.", "Oliver", "Visitor"]],
    ctaBand: ["Come and see it.", "Book a time that suits you."], sponsors: "With thanks to",
  },
  Social: {
    word: "Aisha & Rohan", tagline: "Join us to celebrate", eyebrow: "You're invited", title: "We're celebrating,\nand we'd love you *there*.",
    lede: "Please join us for a day of good food, music and the people we love most. Let us know if you can come.", badges: ["Dinner & dancing", "Dress: festive", "Kindly reply by 1 March"], cta: "RSVP", cta2: ["The day's plan", "schedule"],
    about: ["Our story", "We met on a rainy Tuesday and have been making each other laugh ever since. Now we'd like to celebrate with everyone who has been part of the journey.\n\nYour presence is the only gift we need."],
    values: [["Come as you are", "Dress to be comfortable and to dance."], ["Bring your family", "Children are very welcome."], ["Stay late", "The music goes on after dinner."]],
    highlightsTitle: ["Good to know", "A few details for the day", ""],
    highlights: [["heart", "The ceremony", "Please be seated ten minutes before it begins."], ["spark", "Dinner", "A sit-down dinner, with vegetarian and non-vegetarian menus."], ["people", "Dancing", "Bring your best moves."], ["pin", "Getting there", "Parking at the venue, and a shuttle from the hotel."]],
    stats: [], lineup: ["Your hosts", "With love from both families."],
    people: [["Aisha Khan", "", ""], ["Rohan Mehta", "", ""]],
    schedule: ["The day", "We'll keep to time as best we can."],
    days: [["The day", [["16:30", "Guests arrive", "", "Garden lawn", ""], ["17:00", "Ceremony", "", "Garden lawn", "Ceremony"], ["18:30", "Drinks and photographs", "", "Terrace", ""], ["20:00", "Dinner", "", "Banquet hall", "Dinner"], ["21:30", "Music and dancing", "", "Banquet hall", "Party"]]]],
    tickets: ["", "", ""],
    venue: [["Parking", "Free parking at the venue. Valet at the main gate."], ["Staying over", "Rooms are held at the hotel next door. Mention our names when you book."], ["Shuttle", "A shuttle runs from the hotel every 20 minutes from 4 pm."]],
    faq: [["Can I bring a guest?", "Yes. Tell us how many of you are coming when you reply."], ["What should I wear?", "Festive and comfortable. The ceremony is outdoors."], ["Are children welcome?", "Very much so."], ["Do you have a gift list?", "Your presence is enough. If you wish, a contribution towards our first home would mean a lot."]],
    quotes: [], ctaBand: ["Will you join us?", "Please reply so we can save you a seat."], sponsors: "", hide: ["clients", "stats", "tickets", "testimonials", "work", "process"],
  },
  Sport: {
    word: "Stride", tagline: "Lace up. Race day is coming.", eyebrow: "{Type} · Entries open", title: "Lace up.\n*Race day is coming.*",
    lede: "A course worth training for, a crowd that cheers for everyone and a finish line you'll remember. Pick your category and enter today.", badges: ["Timed with chips", "Finisher's medal", "Water every 2 km"], cta: "Enter now", cta2: ["Categories", "tickets"],
    about: ["For first-timers and personal bests", "{name} is run by people who love the sport. The course is measured and marshalled, the start is on time, and there's a place for every pace.\n\nCome for the race and stay for breakfast at the finish."],
    values: [["Well run", "Certified course, chip timing and medical cover."], ["For everyone", "Categories for every age and pace."], ["Green", "Refill stations and no single-use bottles."]],
    highlightsTitle: ["What you get", "Everything a good race day needs", ""],
    highlights: [["shield", "Chip timing", "Your time by text message as you finish."], ["heart", "Finisher's medal", "For everyone who crosses the line."], ["spark", "Race T-shirt", "Choose your size when you enter."], ["people", "Breakfast", "Hot food and physio at the finish."]],
    stats: [["3", "Categories"], ["4,000", "Participants"], ["12", "Aid stations"], ["6 am", "Start"]], lineup: ["Pacers & guests", "Follow a pacer to hit your target time."],
    people: [["Kavita Rao", "Race director", "Course briefing"], ["Sam Pereira", "Pacer", "10K in 60 minutes"], ["Anil Dutta", "Pacer", "Half marathon in 2:15"], ["Dr. Neha Bose", "Medical lead", "Race-day care"]],
    schedule: ["Race day", "Please arrive 45 minutes before your start."],
    days: [["Race day", [["05:00", "Bag drop opens", "", "Start village", ""], ["05:45", "Warm-up", "", "Start line", ""], ["06:00", "Half marathon starts", "", "", "Start"], ["06:30", "10K starts", "", "", "Start"], ["07:15", "5K starts", "", "", "Start"], ["09:30", "Prize-giving", "", "Main stage", "Awards"]]]],
    tickets: ["Categories & entry fees", "Entry includes timing, a T-shirt, a medal and breakfast.", "Collect your bib the day before. Bring a photo ID."],
    venue: [["Bib collection", "The day before, 10 am to 7 pm, at the start village."], ["Getting there", "Roads close at 5 am. Use the metro or the park-and-ride."], ["Bag drop", "Free, at the start village. One bag each."]],
    faq: [["Is there a minimum age?", "10 years for the shortest category, 18 for the longest."], ["Is there a cut-off time?", "Yes, the course closes three and a half hours after the first start."], ["Can I change my category?", "Yes, up to a week before, by writing to us."], ["Will there be medical help?", "Doctors and ambulances are on the course and at the finish."]],
    quotes: [["My first race, and I can't imagine a better one. The crowd carried me home.", "Shreya", "5K finisher"], ["On-time start, accurate course, great volunteers. See you next year.", "Vikram", "Half-marathon finisher"]],
    ctaBand: ["Entries close soon.", "Pick your category and start training."], sponsors: "Race partners",
  },
  Community: {
    word: "Neighbourly", tagline: "Come together for something good", eyebrow: "{Type} · Everyone welcome", title: "Come together for\n*something good*.",
    lede: "A few hours, a lot of good people and a cause worth turning up for. Bring a friend, and bring your neighbours.", badges: ["Free to join", "Family friendly", "Refreshments provided"], cta: "Count me in", cta2: ["How it works", "services"],
    about: ["Small acts, done together", "{name} is run by volunteers who care about this place. Whatever time or help you can give, there's a way to be part of it.\n\nNo experience is needed. Just turn up, and we'll show you the rest."],
    values: [["Open", "Everyone is welcome, whatever their age or background."], ["Local", "Everything raised or done stays in the community."], ["Transparent", "We share what was raised and where it went."]],
    highlightsTitle: ["How you can help", "There's a way for everyone to take part", ""],
    highlights: [["people", "Join in", "Give a couple of hours on the day."], ["heart", "Give", "Every contribution goes straight to the cause."], ["spark", "Spread the word", "Share this page with three friends."], ["leaf", "Bring something", "Check the list of what's needed."]],
    stats: [["500+", "Neighbours"], ["12", "Years running"], ["100%", "Goes to the cause"], ["80", "Volunteers"]], lineup: ["The organisers", "Volunteers, every one."],
    people: [["Sunita Pillai", "Coordinator", ""], ["George Thomas", "Volunteer lead", ""], ["Amina Sheikh", "Treasurer", ""]],
    schedule: ["On the day", "Come for all of it or drop in when you can."],
    days: [["On the day", [["09:00", "Welcome and tea", "", "Community hall", ""], ["09:30", "Briefing", "", "", ""], ["10:00", "We get to work", "", "", ""], ["12:30", "Lunch together", "", "", "Break"], ["14:00", "Thank-yous and what's next", "", "", ""]]]],
    tickets: ["Ways to take part", "", "Every contribution is acknowledged with a receipt."],
    venue: [["Getting there", "The hall is beside the bus stop. Cycle parking at the side."], ["What to bring", "Comfortable shoes and a water bottle."], ["Access", "Step-free entrance and an accessible toilet."]],
    faq: [["Do I need to register?", "It helps us plan, so please do. It takes a minute."], ["Can children come?", "Yes, with an adult. There are jobs for every age."], ["Where does the money go?", "Straight to the cause. We publish the accounts after the event."], ["Can my company get involved?", "Yes. Write to us about team volunteering or matching donations."]],
    quotes: [["I came to help for an hour and stayed all day. Wonderful people.", "Lata", "Volunteer"], ["You can see exactly what your help does. That's rare.", "Imran", "Supporter"]],
    ctaBand: ["Every pair of hands helps.", "Tell us you're coming."], sponsors: "Supported by",
  },
  Market: {
    word: "Maker's Yard", tagline: "Fresh finds, made by people you'll meet", eyebrow: "{Type} · This weekend", title: "Fresh finds, made by\n*people you'll meet*.",
    lede: "Dozens of stalls, good coffee and things you won't find on a shelf. Come and browse, or book a stall and sell your own.", badges: ["60+ stalls", "Free entry", "Dog friendly"], cta: "Book a stall", cta2: ["Plan your visit", "venue"],
    about: ["A market with a point of view", "{name} is a place for growers, bakers and makers to meet the people who buy from them. Everything is made, grown or chosen by the person behind the table.\n\nCome hungry, bring a bag and take your time."],
    values: [["Local", "Stallholders from within fifty miles."], ["Handmade", "Made or grown by the person selling it."], ["Low waste", "Bring your own bags and boxes."]],
    highlightsTitle: ["What you'll find", "Something for every bag", ""],
    highlights: [["leaf", "Fresh produce", "Fruit, vegetables, eggs and flowers, picked this week."], ["heart", "Food to eat now", "Hot food, bakes and proper coffee."], ["spark", "Handmade goods", "Ceramics, textiles, prints and more."], ["people", "For children", "Face painting and a craft table."]],
    stats: [["60+", "Stalls"], ["3,000", "Visitors"], ["Free", "Entry"], ["9–3", "Opening hours"]], lineup: ["Meet the stallholders", "A few of the people you'll meet."],
    people: [["Green Acre Farm", "Vegetables and eggs", ""], ["Loaf & Larder", "Sourdough and bakes", ""], ["Clay by Mira", "Ceramics", ""], ["Bean Counter", "Coffee", ""]],
    schedule: ["Market day", "Come early for the best choice."],
    days: [["Market day", [["07:00", "Stallholders set up", "", "", ""], ["09:00", "Market opens", "", "", "Open"], ["11:00", "Live music", "", "Bandstand", "Music"], ["13:00", "Cooking demonstration", "", "Demo tent", "Demo"], ["15:00", "Market closes", "", "", ""]]]],
    tickets: ["Stalls", "Prices are for the day, and include a table.", "New here? Tell us what you make and we'll be in touch."],
    venue: [["Getting there", "Five minutes from the high street. Cycle racks at the gate."], ["Parking", "Free in the car park behind the hall."], ["Rain or shine", "Most stalls are under cover."]],
    faq: [["Is entry free?", "Yes, always."], ["Can I pay by card?", "Most stalls take cards and UPI, but a little cash helps."], ["How do I get a stall?", "Book one here. We check that what you sell fits the market, then confirm."], ["Are dogs allowed?", "Yes, on a lead."]],
    quotes: [["Our favourite Saturday morning. We never leave without bread and flowers.", "Tara", "Regular visitor"], ["A lovely, loyal crowd. We sell out most weeks.", "Mira", "Stallholder"]],
    ctaBand: ["Make it, grow it or bake it?", "Book a stall and meet your customers."], sponsors: "With thanks to",
  },
  Food: {
    word: "Saffron Table", tagline: "Come hungry. Leave happy.", eyebrow: "{Type} · Limited places", title: "Come hungry.\n*Leave happy.*",
    lede: "Good cooking, generous plates and a table full of people who love to eat. Places are limited, so book early.", badges: ["Seasonal menu", "Vegetarian options", "Limited places"], cta: "Book your place", cta2: ["See the menu", "services"],
    about: ["Food made with care, shared at one table", "{name} is cooked by people who are fussy about ingredients and relaxed about everything else. Expect food worth talking about and strangers who become friends by dessert.\n\nTell us what you can't eat and we'll look after you."],
    values: [["Seasonal", "A menu built around what's best this week."], ["Generous", "Nobody leaves hungry."], ["Thoughtful", "Dietary needs handled properly, not as an afterthought."]],
    highlightsTitle: ["On the menu", "A taste of what's coming", "The full menu is shared a week before."],
    highlights: [["leaf", "To start", "Small plates made for sharing."], ["heart", "The main event", "A centrepiece dish, with sides passed around the table."], ["spark", "Something sweet", "Dessert, and something to take home."], ["people", "To drink", "Paired drinks, with and without alcohol."]],
    stats: [["5", "Courses"], ["30", "Seats"], ["2", "Sittings"], ["100%", "Seasonal"]], lineup: ["In the kitchen", "The people cooking for you."],
    people: [["Chef Anjali Desai", "Head chef", "The menu"], ["Marco Bianchi", "Pastry", "Dessert"], ["Tanvi Joshi", "Drinks", "Pairings"]],
    schedule: ["The evening", "Please arrive on time. We serve everyone together."],
    days: [["The evening", [["19:00", "Welcome drinks", "", "", ""], ["19:30", "Seated for the first course", "", "", ""], ["20:30", "The main event", "", "", ""], ["21:30", "Dessert and coffee", "", "", ""], ["22:30", "Goodnight", "", "", ""]]]],
    tickets: ["Places", "The price includes every course.", "Tell us about allergies when you book. We can't always change the menu on the night."],
    venue: [["Getting there", "The address is sent with your confirmation."], ["Parking", "On the street nearby. A taxi is easier."], ["Access", "A few steps at the entrance. Let us know if you need help."]],
    faq: [["Can you cater for my diet?", "Usually, yes. Tell us when you book and we'll confirm."], ["Can I come alone?", "Please do. Everyone sits together."], ["Can I get a refund?", "Up to five days before. After that you can send a friend."], ["Are drinks included?", "Welcome drinks are. Pairings are extra, and you can bring your own."]],
    quotes: [["One of the best meals I've had this year, and the best company.", "Rhea", "Guest"], ["Generous, clever cooking, and nothing fussy about it.", "Daniel", "Guest"]],
    ctaBand: ["A few places left.", "Book yours before they go."], sponsors: "With thanks to",
  },
};
P.Competition && (P.Competition.city = "Bengaluru");

/** Sample tickets for a kind of registration (kinds that have none give an empty list). */
function ticketsFor(kind: string, type: string): Tk[] {
  const run = /Marathon|Fun Run|Cycling/.test(type);
  switch (kind) {
    case "tickets": return [["General entry", 499, "Entry to the event.", ["Access to all public areas"]], ["Premium", 999, "A better spot and a few extras.", ["Priority entry", "Reserved area", "A welcome drink"], true], ["VIP", 2499, "The full experience.", ["Fast-track entry", "Best view in the house", "Meet and greet"]]];
    case "delegate": return [["Standard pass", 4999, "All sessions.", ["All keynotes and talks", "Lunch and refreshments", "Evening social"]], ["Workshop pass", 7999, "Sessions plus one workshop.", ["Everything in Standard", "One hands-on workshop", "Workshop materials"], true], ["Student pass", 1499, "For full-time students.", ["All keynotes and talks", "Student ID needed at entry"]]];
    case "seat": return [["Free seat", 0, "Reserve a place.", ["One seat per registration"], true], ["Supporter seat", 300, "Reserve a place and help us cover costs.", ["A seat near the front", "Our thanks"]]];
    case "enrol": return [["Weekday batch", 1999, "Tuesday and Thursday evenings.", ["All sessions", "Notes and recordings", "Certificate"]], ["Weekend batch", 2499, "Saturday and Sunday mornings.", ["All sessions", "Notes and recordings", "Certificate"], true], ["One-to-one", 5999, "Private sessions at your pace.", ["Your own schedule", "Personal feedback"]]];
    case "team": return [["Student teams", 0, "For teams where everyone is a student.", ["2 to 4 members", "Student ID needed"]], ["Open teams", 999, "For everyone else.", ["2 to 4 members", "Meals included"], true]];
    case "stall": return [["Table stall", 1500, "One table, about 1.8 m.", ["Table and two chairs", "Shared power"]], ["Standard stall", 3500, "A 3 × 3 m covered space.", ["Canopy, table and chairs", "Power point", "Name board"], true], ["Corner stall", 5000, "A 3 × 3 m space open on two sides.", ["Everything in Standard", "Two open sides"]]];
    case "entry": return run ? [["5K", 499, "For first-timers and families.", ["Timing chip", "T-shirt and medal"]], ["10K", 899, "The classic distance.", ["Timing chip", "T-shirt and medal", "Breakfast"], true], ["Half marathon", 1299, "21.1 km. For ages 18 and over.", ["Timing chip", "T-shirt and medal", "Breakfast and physio"]]]
      : [["Open category", 500, "For all adults.", ["Entry to all rounds", "Participation certificate"], true], ["Under 18", 300, "For participants under 18.", ["Entry to all rounds", "Participation certificate"]], ["Masters (40+)", 500, "For participants aged 40 and over.", ["Entry to all rounds", "Participation certificate"]]];
    default: return [];
  }
}
const fill = (s: string, v: Record<string, string>) => String(s || "").replace(/\{(type|Type|name)\}/g, (_, k) => v[k] ?? "");

/** The sample content, rewritten for a kind of event and a kind of registration. */
export function eventSample(sample: any, type: string, regKind = ""): any {
  const info = EVT_TYPE_INFO[type]; if (!sample || !info) return sample;
  const p = P[info.group] || P.Business, c = JSON.parse(JSON.stringify(sample)), kind = regKind || info.kinds[0];
  const couple = info.stage === "The couple", social = info.group === "Social";
  const name = social ? (couple ? p.word : type === "Reunion" ? "Class of 2012 Reunion" : type === "Graduation Party" ? "Class of 2027" : `The ${type}`) : `${p.word} ${type}`;
  const v = { type: type.toLowerCase(), Type: type, name }, f = (s: string) => fill(s, v), E = c.event || {};
  c.event = { ...E, type, city: p.city || E.city, venue: social ? "The Garden Pavilion" : E.venue, ...(social || info.group === "Stage" || info.group === "Food" || info.group === "Sport" || info.group === "Market" || info.group === "Community" || info.group === "Learning" ? { endDate: "", time: p.days[0][1][0][0] } : {}) };
  c.brand = { ...(c.brand || {}), name, tagline: f(p.tagline) };
  const reg: Record<string, string> = { tickets: "Get tickets", delegate: "Register now", rsvp: "RSVP", team: "Register your team", stall: "Book a stall", entry: "Enter now", seat: "Reserve a seat", enrol: "Enrol now", donate: "Donate", volunteer: "Volunteer", media: "Press pass" };
  const cta = reg[kind] || p.cta;
  c.nav = { ...(c.nav || {}), cta: cta.replace(/ now$/, ""), ctaTarget: "register" };
  c.hero = { ...(c.hero || {}), eyebrow: f(p.eyebrow), title: couple ? "We're getting married,\nand we'd love you *there*." : social ? `You're invited to\n*${name.replace(/^The /, "the ")}*.` : f(p.title), lede: f(p.lede), badges: p.badges, ctaPrimary: cta, ctaPrimaryTarget: "register", ctaSecondary: p.cta2[0], ctaSecondaryTarget: p.cta2[1] };
  c.about = { ...(c.about || {}), eyebrow: social ? "About" : "About the event", title: f(p.about[0]), body: f(p.about[1]), mission: "", vision: "", values: p.values.map(([title, body]) => ({ title, body })) };
  c.services = { eyebrow: f(p.highlightsTitle[0]), title: f(p.highlightsTitle[1]), lede: f(p.highlightsTitle[2]), items: p.highlights.map(([icon, title, body]) => ({ icon, title, body, points: [] })) };
  c.stats = { items: p.stats.map(([value, label]) => ({ value, label })) };
  c.team = { eyebrow: info.stage, title: f(p.lineup[0]), lede: f(p.lineup[1]), members: p.people.map(([n, role, topic]) => ({ name: n, role, topic, photo: null, bio: "", linkedin: "" })) };
  const d0 = String(c.event.date || ""), next = (i: number) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d0); if (!m) return ""; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + i)); return d.toISOString().slice(0, 10); };
  c.schedule = { eyebrow: "Schedule", title: f(p.schedule[0]), lede: f(p.schedule[1]), days: p.days.map(([label, items], i) => ({ label, date: p.days.length > 1 && /^Day /.test(label) ? next(i) : "", items: items.map(([time, title, who, place, tag]) => ({ time, title, who, place, body: "", tag })) })) };
  if (p.days.length > 1 && /^Day /.test(p.days[1][0])) c.event.endDate = next(p.days.length - 1);
  const tk = ticketsFor(kind, type);
  c.tickets = { ...(c.tickets || {}), eyebrow: kind === "stall" ? "Stalls" : kind === "entry" || kind === "team" ? "Categories" : kind === "enrol" ? "Batches" : "Tickets", title: f(p.tickets[0]) || "Tickets", lede: f(p.tickets[1]), note: f(p.tickets[2]), button: "" };
  c.register = { ...(c.register || {}), kind: "auto", title: kind === "rsvp" ? "RSVP" : kind === "donate" ? "Donate" : kind === "volunteer" ? "Volunteer" : kind === "media" ? "Press accreditation" : "Register", lede: kind === "rsvp" ? "Please let us know if you can come." : "It takes about a minute. You'll get a confirmation by email.", tickets: tk.map(([n, price, blurb, features, featured]) => ({ name: n, price, blurb, features, limit: 0, featured: !!featured, soldOut: false })) };
  c.venue = { ...(c.venue || {}), name: c.event.venue || c.venue?.name, title: social ? "Where to find us" : "Getting there", points: p.venue.map(([title, body]) => ({ title, body })) };
  c.faq = { ...(c.faq || {}), items: p.faq.map(([q, a]) => ({ q, a })) };
  c.testimonials = { ...(c.testimonials || {}), eyebrow: "What people said", title: "From last time", items: p.quotes.map(([quote, n, role]) => ({ quote, name: n, role, company: "" })) };
  c.cta = { ...(c.cta || {}), title: f(p.ctaBand[0]), body: f(p.ctaBand[1]), button: cta, target: "register" };
  c.clients = { ...(c.clients || {}), title: p.sponsors || c.clients?.title };
  c.footer = { ...(c.footer || {}), text: f(p.tagline), legal: `© {year} ${name}. All rights reserved.` };
  c.seo = { ...(c.seo || {}), title: `${name} · ${c.event.city || ""}`.replace(/ · $/, ""), description: f(p.lede).slice(0, 155) };
  c.contact = { ...(c.contact || {}), title: social ? "Questions? Call or write to us" : "Questions? Write to us", lede: "" };
  const hide = new Set([...(p.hide || []), ...(tk.length ? [] : ["tickets"]), "work", "process", "gallery"].filter((id) => id !== "gallery"));
  const label: Record<string, string> = { team: info.stage, tickets: c.tickets.eyebrow, clients: social ? "Sponsors" : "Sponsors", services: social ? "Details" : info.group === "Competition" ? "Challenges" : info.group === "Food" ? "Menu" : "Highlights", schedule: info.group === "Stage" ? "Set times" : social ? "The day" : "Schedule" };
  if (Array.isArray(c.sections)) c.sections = c.sections.map((s: any) => (s ? { ...s, label: label[s.id] || s.label, show: hide.has(s.id) ? false : s.id === "work" || s.id === "process" ? s.show : true, inNav: s.id === "tickets" ? tk.length > 0 : s.inNav } : s));
  if (c.site?.pageLabels) { c.site.pageLabels.lineup = info.stage; c.site.pageLabels.schedule = label.schedule; }
  if (c.menu && Array.isArray(c.menu.items)) c.menu.items = c.menu.items.filter((m: any) => !(m && hide.has(m.to))).map((m: any) => (m && label[m.to] ? { ...m, label: label[m.to] } : m));
  return c;
}
