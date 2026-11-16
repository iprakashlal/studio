// India's festivals for the festival overlay (assets/festival.js carries the same list for the live site; the test
// suite checks the two match). `fixed`: the same days every year (month-day). `dates`: per year, for festivals that
// follow the lunar calendar; a year that isn't listed doesn't show on its own until its dates are added here (a
// site can always type its own dates). `moon`: the day can shift by one with the moon sighting.
export type Festival = { id: string; name: string; fixed?: [string, string]; dates?: Record<string, [string, string]>; deco: string; greet: string; moon?: boolean };
export const FESTIVALS: Festival[] = [
 {
  "id": "new-year",
  "name": "New Year",
  "fixed": [
   "01-01",
   "01-01"
  ],
  "deco": "confetti",
  "greet": "Happy New Year"
 },
 {
  "id": "lohri",
  "name": "Lohri",
  "fixed": [
   "01-13",
   "01-13"
  ],
  "deco": "fire",
  "greet": "Happy Lohri"
 },
 {
  "id": "sankranti",
  "name": "Makar Sankranti / Pongal",
  "fixed": [
   "01-14",
   "01-15"
  ],
  "deco": "kites",
  "greet": "Happy Makar Sankranti and Pongal"
 },
 {
  "id": "republic-day",
  "name": "Republic Day",
  "fixed": [
   "01-26",
   "01-26"
  ],
  "deco": "tricolour",
  "greet": "Happy Republic Day"
 },
 {
  "id": "shivratri",
  "name": "Maha Shivratri",
  "dates": {
   "2027": [
    "03-06",
    "03-06"
   ]
  },
  "deco": "lamps",
  "greet": "Happy Maha Shivratri"
 },
 {
  "id": "holi",
  "name": "Holi",
  "dates": {
   "2027": [
    "03-22",
    "03-22"
   ]
  },
  "deco": "colours",
  "greet": "Happy Holi"
 },
 {
  "id": "eid-fitr",
  "name": "Eid ul-Fitr",
  "dates": {
   "2027": [
    "03-10",
    "03-10"
   ]
  },
  "deco": "crescent",
  "greet": "Eid Mubarak",
  "moon": true
 },
 {
  "id": "ugadi",
  "name": "Ugadi / Gudi Padwa",
  "dates": {
   "2027": [
    "04-08",
    "04-08"
   ]
  },
  "deco": "flowers",
  "greet": "Happy Ugadi and Gudi Padwa"
 },
 {
  "id": "baisakhi",
  "name": "Baisakhi / Vishu / Tamil New Year",
  "fixed": [
   "04-14",
   "04-14"
  ],
  "deco": "flowers",
  "greet": "Happy Baisakhi"
 },
 {
  "id": "ram-navami",
  "name": "Ram Navami",
  "dates": {
   "2027": [
    "04-15",
    "04-15"
   ]
  },
  "deco": "lamps",
  "greet": "Happy Ram Navami"
 },
 {
  "id": "easter",
  "name": "Good Friday and Easter",
  "dates": {
   "2027": [
    "03-26",
    "03-28"
   ]
  },
  "deco": "flowers",
  "greet": "Happy Easter"
 },
 {
  "id": "eid-adha",
  "name": "Eid ul-Adha (Bakrid)",
  "dates": {
   "2027": [
    "05-17",
    "05-17"
   ]
  },
  "deco": "crescent",
  "greet": "Eid Mubarak",
  "moon": true
 },
 {
  "id": "buddha-purnima",
  "name": "Buddha Purnima",
  "dates": {
   "2027": [
    "05-20",
    "05-20"
   ]
  },
  "deco": "lamps",
  "greet": "Happy Buddha Purnima"
 },
 {
  "id": "independence-day",
  "name": "Independence Day",
  "fixed": [
   "08-15",
   "08-15"
  ],
  "deco": "tricolour",
  "greet": "Happy Independence Day"
 },
 {
  "id": "raksha-bandhan",
  "name": "Raksha Bandhan",
  "dates": {
   "2027": [
    "08-17",
    "08-17"
   ]
  },
  "deco": "flowers",
  "greet": "Happy Raksha Bandhan"
 },
 {
  "id": "janmashtami",
  "name": "Janmashtami",
  "dates": {
   "2027": [
    "08-25",
    "08-25"
   ]
  },
  "deco": "feathers",
  "greet": "Happy Janmashtami"
 },
 {
  "id": "ganesh-chaturthi",
  "name": "Ganesh Chaturthi",
  "dates": {
   "2027": [
    "09-04",
    "09-04"
   ]
  },
  "deco": "flowers",
  "greet": "Happy Ganesh Chaturthi"
 },
 {
  "id": "onam",
  "name": "Onam",
  "dates": {
   "2027": [
    "09-11",
    "09-11"
   ]
  },
  "deco": "flowers",
  "greet": "Happy Onam"
 },
 {
  "id": "gandhi-jayanti",
  "name": "Gandhi Jayanti",
  "fixed": [
   "10-02",
   "10-02"
  ],
  "deco": "tricolour",
  "greet": "Remembering Gandhi Jayanti"
 },
 {
  "id": "navratri",
  "name": "Navratri and Dussehra",
  "dates": {
   "2027": [
    "10-01",
    "10-10"
   ]
  },
  "deco": "lamps",
  "greet": "Happy Navratri and Dussehra"
 },
 {
  "id": "diwali",
  "name": "Diwali",
  "dates": {
   "2027": [
    "10-27",
    "10-31"
   ]
  },
  "deco": "diyas",
  "greet": "Happy Diwali"
 },
 {
  "id": "guru-nanak",
  "name": "Guru Nanak Jayanti",
  "dates": {
   "2026": [
    "11-24",
    "11-24"
   ],
   "2027": [
    "11-14",
    "11-14"
   ]
  },
  "deco": "lamps",
  "greet": "Happy Gurpurab"
 },
 {
  "id": "christmas",
  "name": "Christmas",
  "fixed": [
   "12-24",
   "12-25"
  ],
  "deco": "snow",
  "greet": "Merry Christmas"
 }
] as any;
export const FESTIVAL_DECOS: { value: string; label: string }[] = [
  { value: "confetti", label: "Confetti" }, { value: "diyas", label: "Diyas and sparkles" }, { value: "lamps", label: "Lamps and flowers" }, { value: "colours", label: "Splashes of colour" },
  { value: "tricolour", label: "Tricolour" }, { value: "crescent", label: "Crescent and stars" }, { value: "flowers", label: "Flowers" }, { value: "kites", label: "Kites" },
  { value: "snow", label: "Snow and stars" }, { value: "fire", label: "Bonfire sparks" }, { value: "feathers", label: "Peacock feathers" }, { value: "hearts", label: "Hearts" },
];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (md: string) => `${+md.slice(3)} ${MON[+md.slice(0, 2) - 1]}`;
/** "22 Mar 2027" / "24 to 25 Dec, every year": the official days the Studio knows for a festival. */
export function festivalWhen(f: Festival, now = new Date()): string {
  const span = (a: string, b: string) => (a === b ? day(a) : `${day(a)} to ${day(b)}`);
  if (f.fixed) return `${span(f.fixed[0], f.fixed[1])}, every year`;
  const y = now.getFullYear(), list = Object.keys(f.dates || {}).map(Number).filter((k) => k >= y).sort();
  if (!list.length) return "official date not in the list yet: type the dates";
  return list.map((k) => `${span(f.dates![k][0], f.dates![k][1])} ${k}`).join("; ") + (f.moon ? " (may shift a day with the moon)" : "");
}
