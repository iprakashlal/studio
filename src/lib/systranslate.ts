// The Picaffectz system's translator. It works on this device, with no AI service and no allowance, in two steps:
//   1. the Studio's own phrase book: the words every site shares (Home, Menu, Contact us, Open now, the weekdays…),
//      in the eleven Indian languages the Studio offers;
//   2. the browser's built-in translator, where the browser has one (Chrome and Edge on a computer). Its language
//      pack is downloaded once by the browser itself and then works offline.
// A text neither can do is left "Not translated" for the owner to type in: it is never guessed.

const ORDER = ["hi", "mr", "gu", "pa", "bn", "as", "or", "ta", "te", "kn", "ml"];
// English → [hi, mr, gu, pa, bn, as, or, ta, te, kn, ml]
const BOOK: Record<string, string[]> = {
  "home": ["होम", "होम", "હોમ", "ਹੋਮ", "হোম", "হোম", "ହୋମ୍", "முகப்பு", "హోమ్", "ಮುಖಪುಟ", "ഹോം"],
  "menu": ["मेनू", "मेनू", "મેનુ", "ਮੀਨੂ", "মেনু", "মেনু", "ମେନୁ", "மெனு", "మెనూ", "ಮೆನು", "മെനു"],
  "about": ["परिचय", "परिचय", "પરિચય", "ਬਾਰੇ", "পরিচিতি", "পৰিচয়", "ପରିଚୟ", "அறிமுகம்", "పరిచయం", "ಪರಿಚಯ", "പരിചയം"],
  "about us": ["हमारे बारे में", "आमच्याबद्दल", "અમારા વિશે", "ਸਾਡੇ ਬਾਰੇ", "আমাদের সম্পর্কে", "আমাৰ বিষয়ে", "ଆମ ବିଷୟରେ", "எங்களைப் பற்றி", "మా గురించి", "ನಮ್ಮ ಬಗ್ಗೆ", "ഞങ്ങളെക്കുറിച്ച്"],
  "contact": ["संपर्क", "संपर्क", "સંપર્ક", "ਸੰਪਰਕ", "যোগাযোগ", "যোগাযোগ", "ଯୋଗାଯୋଗ", "தொடர்பு", "సంప్రదించండి", "ಸಂಪರ್ಕ", "ബന്ധപ്പെടുക"],
  "contact us": ["संपर्क करें", "संपर्क साधा", "સંપર્ક કરો", "ਸੰਪਰਕ ਕਰੋ", "যোগাযোগ করুন", "যোগাযোগ কৰক", "ଯୋଗାଯୋଗ କରନ୍ତୁ", "தொடர்பு கொள்ளுங்கள்", "మమ్మల్ని సంప్రదించండి", "ನಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಿ", "ഞങ്ങളെ ബന്ധപ്പെടുക"],
  "gallery": ["गैलरी", "गॅलरी", "ગેલેરી", "ਗੈਲਰੀ", "গ্যালারি", "গেলাৰী", "ଗ୍ୟାଲେରୀ", "கேலரி", "గ్యాలరీ", "ಗ್ಯಾಲರಿ", "ഗാലറി"],
  "services": ["सेवाएँ", "सेवा", "સેવાઓ", "ਸੇਵਾਵਾਂ", "পরিষেবা", "সেৱাসমূহ", "ସେବା", "சேவைகள்", "సేవలు", "ಸೇವೆಗಳು", "സേവനങ്ങൾ"],
  "products": ["उत्पाद", "उत्पादने", "ઉત્પાદનો", "ਉਤਪਾਦ", "পণ্য", "সামগ্ৰী", "ଉତ୍ପାଦ", "தயாரிப்புகள்", "ఉత్పత్తులు", "ಉತ್ಪನ್ನಗಳು", "ഉൽപ്പന്നങ്ങൾ"],
  "reviews": ["समीक्षाएँ", "पुनरावलोकने", "સમીક્ષાઓ", "ਸਮੀਖਿਆਵਾਂ", "রিভিউ", "ৰিভিউ", "ସମୀକ୍ଷା", "மதிப்புரைகள்", "సమీక్షలు", "ವಿಮರ್ಶೆಗಳು", "അവലോകനങ്ങൾ"],
  "offers": ["ऑफ़र", "ऑफर", "ઑફર", "ਆਫ਼ਰ", "অফার", "অফাৰ", "ଅଫର", "சலுகைகள்", "ఆఫర్లు", "ಕೊಡುಗೆಗಳು", "ഓഫറുകൾ"],
  "book a table": ["टेबल बुक करें", "टेबल बुक करा", "ટેબલ બુક કરો", "ਟੇਬਲ ਬੁੱਕ ਕਰੋ", "টেবিল বুক করুন", "টেবুল বুক কৰক", "ଟେବୁଲ୍ ବୁକ୍ କରନ୍ତୁ", "மேசை முன்பதிவு செய்யுங்கள்", "టేబుల్ బుక్ చేయండి", "ಟೇಬಲ್ ಬುಕ್ ಮಾಡಿ", "ടേബിൾ ബുക്ക് ചെയ്യുക"],
  "book": ["बुक करें", "बुक करा", "બુક કરો", "ਬੁੱਕ ਕਰੋ", "বুক করুন", "বুক কৰক", "ବୁକ୍ କରନ୍ତୁ", "முன்பதிவு", "బుక్ చేయండి", "ಬುಕ್ ಮಾಡಿ", "ബുക്ക് ചെയ്യുക"],
  "open now": ["अभी खुला है", "आता उघडे आहे", "હમણાં ખુલ્લું છે", "ਹੁਣ ਖੁੱਲ੍ਹਾ ਹੈ", "এখন খোলা", "এতিয়া খোলা", "ବର୍ତ୍ତମାନ ଖୋଲା", "இப்போது திறந்துள்ளது", "ఇప్పుడు తెరిచి ఉంది", "ಈಗ ತೆರೆದಿದೆ", "ഇപ്പോൾ തുറന്നിരിക്കുന്നു"],
  "closed now": ["अभी बंद है", "आता बंद आहे", "હમણાં બંધ છે", "ਹੁਣ ਬੰਦ ਹੈ", "এখন বন্ধ", "এতিয়া বন্ধ", "ବର୍ତ୍ତମାନ ବନ୍ଦ", "இப்போது மூடப்பட்டுள்ளது", "ఇప్పుడు మూసి ఉంది", "ಈಗ ಮುಚ್ಚಿದೆ", "ഇപ്പോൾ അടച്ചിരിക്കുന്നു"],
  "closed": ["बंद", "बंद", "બંધ", "ਬੰਦ", "বন্ধ", "বন্ধ", "ବନ୍ଦ", "மூடப்பட்டுள்ளது", "మూసి ఉంది", "ಮುಚ್ಚಿದೆ", "അടച്ചിരിക്കുന്നു"],
  "opening hours": ["खुलने का समय", "उघडण्याची वेळ", "ખુલવાનો સમય", "ਖੁੱਲ੍ਹਣ ਦਾ ਸਮਾਂ", "খোলার সময়", "খোলাৰ সময়", "ଖୋଲିବା ସମୟ", "திறக்கும் நேரம்", "తెరిచే సమయాలు", "ತೆರೆಯುವ ಸಮಯ", "പ്രവർത്തന സമയം"],
  "today": ["आज", "आज", "આજે", "ਅੱਜ", "আজ", "আজি", "ଆଜି", "இன்று", "ఈరోజు", "ಇಂದು", "ഇന്ന്"],
  "name": ["नाम", "नाव", "નામ", "ਨਾਮ", "নাম", "নাম", "ନାମ", "பெயர்", "పేరు", "ಹೆಸರು", "പേര്"],
  "phone": ["फ़ोन", "फोन", "ફોન", "ਫ਼ੋਨ", "ফোন", "ফোন", "ଫୋନ୍", "தொலைபேசி", "ఫోన్", "ಫೋನ್", "ഫോൺ"],
  "email": ["ईमेल", "ईमेल", "ઇમેઇલ", "ਈਮੇਲ", "ইমেল", "ইমেইল", "ଇମେଲ୍", "மின்னஞ்சல்", "ఇమెయిల్", "ಇಮೇಲ್", "ഇമെയിൽ"],
  "message": ["संदेश", "संदेश", "સંદેશ", "ਸੁਨੇਹਾ", "বার্তা", "বাৰ্তা", "ବାର୍ତ୍ତା", "செய்தி", "సందేశం", "ಸಂದೇಶ", "സന്ദേശം"],
  "date": ["तारीख", "तारीख", "તારીખ", "ਤਾਰੀਖ", "তারিখ", "তাৰিখ", "ତାରିଖ", "தேதி", "తేదీ", "ದಿನಾಂಕ", "തീയതി"],
  "time": ["समय", "वेळ", "સમય", "ਸਮਾਂ", "সময়", "সময়", "ସମୟ", "நேரம்", "సమయం", "ಸಮಯ", "സമയം"],
  "guests": ["मेहमान", "पाहुणे", "મહેમાનો", "ਮਹਿਮਾਨ", "অতিথি", "অতিথি", "ଅତିଥି", "விருந்தினர்கள்", "అతిథులు", "ಅತಿಥಿಗಳು", "അതിഥികൾ"],
  "address": ["पता", "पत्ता", "સરનામું", "ਪਤਾ", "ঠিকানা", "ঠিকনা", "ଠିକଣା", "முகவரி", "చిరునామా", "ವಿಳಾಸ", "വിലാസം"],
  "send": ["भेजें", "पाठवा", "મોકલો", "ਭੇਜੋ", "পাঠান", "পঠিয়াওক", "ପଠାନ୍ତୁ", "அனுப்பு", "పంపండి", "ಕಳುಹಿಸಿ", "അയയ്ക്കുക"],
  "search": ["खोजें", "शोधा", "શોધો", "ਖੋਜੋ", "খুঁজুন", "সন্ধান কৰক", "ଖୋଜନ୍ତୁ", "தேடு", "వెతకండి", "ಹುಡುಕಿ", "തിരയുക"],
  "all": ["सभी", "सर्व", "બધા", "ਸਾਰੇ", "সব", "সকলো", "ସବୁ", "அனைத்தும்", "అన్నీ", "ಎಲ್ಲಾ", "എല്ലാം"],
  "vegetarian": ["शाकाहारी", "शाकाहारी", "શાકાહારી", "ਸ਼ਾਕਾਹਾਰੀ", "নিরামিষ", "নিৰামিষ", "ଶାକାହାରୀ", "சைவம்", "శాకాహారం", "ಸಸ್ಯಾಹಾರಿ", "സസ്യാഹാരം"],
  "non-vegetarian": ["मांसाहारी", "मांसाहारी", "માંસાહારી", "ਮਾਸਾਹਾਰੀ", "আমিষ", "আমিষ", "ଆମିଷ", "அசைவம்", "మాంసాహారం", "ಮಾಂಸಾಹಾರಿ", "മാംസാഹാരം"],
  "call": ["कॉल करें", "कॉल करा", "કૉલ કરો", "ਕਾਲ ਕਰੋ", "কল করুন", "কল কৰক", "କଲ୍ କରନ୍ତୁ", "அழைக்கவும்", "కాల్ చేయండి", "ಕರೆ ಮಾಡಿ", "വിളിക്കുക"],
  "directions": ["दिशा-निर्देश", "दिशानिर्देश", "દિશાનિર્દેશ", "ਦਿਸ਼ਾ-ਨਿਰਦੇਸ਼", "দিকনির্দেশ", "দিশ-নিৰ্দেশ", "ଦିଗ ନିର୍ଦ୍ଦେଶ", "வழிகள்", "దిశలు", "ದಿಕ್ಕುಗಳು", "വഴികൾ"],
  "get directions": ["रास्ता देखें", "मार्ग पहा", "રસ્તો જુઓ", "ਰਸਤਾ ਵੇਖੋ", "পথ দেখুন", "পথ চাওক", "ରାସ୍ତା ଦେଖନ୍ତୁ", "வழியைப் பார்க்கவும்", "దారి చూడండి", "ದಾರಿ ನೋಡಿ", "വഴി കാണുക"],
  "monday": ["सोमवार", "सोमवार", "સોમવાર", "ਸੋਮਵਾਰ", "সোমবার", "সোমবাৰ", "ସୋମବାର", "திங்கள்", "సోమవారం", "ಸೋಮವಾರ", "തിങ്കൾ"],
  "tuesday": ["मंगलवार", "मंगळवार", "મંગળવાર", "ਮੰਗਲਵਾਰ", "মঙ্গলবার", "মঙ্গলবাৰ", "ମଙ୍ଗଳବାର", "செவ்வாய்", "మంగళవారం", "ಮಂಗಳವಾರ", "ചൊവ്വ"],
  "wednesday": ["बुधवार", "बुधवार", "બુધવાર", "ਬੁੱਧਵਾਰ", "বুধবার", "বুধবাৰ", "ବୁଧବାର", "புதன்", "బుధవారం", "ಬುಧವಾರ", "ബുധൻ"],
  "thursday": ["गुरुवार", "गुरुवार", "ગુરુવાર", "ਵੀਰਵਾਰ", "বৃহস্পতিবার", "বৃহস্পতিবাৰ", "ଗୁରୁବାର", "வியாழன்", "గురువారం", "ಗುರುವಾರ", "വ്യാഴം"],
  "friday": ["शुक्रवार", "शुक्रवार", "શુક્રવાર", "ਸ਼ੁੱਕਰਵਾਰ", "শুক্রবার", "শুক্ৰবাৰ", "ଶୁକ୍ରବାର", "வெள்ளி", "శుక్రవారం", "ಶುಕ್ರವಾರ", "വെള്ളി"],
  "saturday": ["शनिवार", "शनिवार", "શનિવાર", "ਸ਼ਨੀਵਾਰ", "শনিবার", "শনিবাৰ", "ଶନିବାର", "சனி", "శనివారం", "ಶನಿವಾರ", "ശനി"],
  "sunday": ["रविवार", "रविवार", "રવિવાર", "ਐਤਵਾਰ", "রবিবার", "দেওবাৰ", "ରବିବାର", "ஞாயிறு", "ఆదివారం", "ಭಾನುವಾರ", "ഞായർ"],
  "privacy policy": ["गोपनीयता नीति", "गोपनीयता धोरण", "ગોપનીયતા નીતિ", "ਪਰਦੇਦਾਰੀ ਨੀਤੀ", "গোপনীয়তা নীতি", "গোপনীয়তা নীতি", "ଗୋପନୀୟତା ନୀତି", "தனியுரிமைக் கொள்கை", "గోప్యతా విధానం", "ಗೌಪ್ಯತಾ ನೀತಿ", "സ്വകാര്യതാ നയം"],
  "thank you": ["धन्यवाद", "धन्यवाद", "આભાર", "ਧੰਨਵਾਦ", "ধন্যবাদ", "ধন্যবাদ", "ଧନ୍ୟବାଦ", "நன்றி", "ధన్యవాదాలు", "ಧನ್ಯವಾದಗಳು", "നന്ദി"],
  "welcome": ["स्वागत है", "स्वागत आहे", "સ્વાગત છે", "ਜੀ ਆਇਆਂ ਨੂੰ", "স্বাগতম", "স্বাগতম", "ସ୍ୱାଗତ", "வரவேற்கிறோம்", "స్వాగతం", "ಸ್ವಾಗತ", "സ്വാഗതം"],
  "read more": ["और पढ़ें", "अधिक वाचा", "વધુ વાંચો", "ਹੋਰ ਪੜ੍ਹੋ", "আরও পড়ুন", "অধিক পঢ়ক", "ଅଧିକ ପଢ଼ନ୍ତୁ", "மேலும் படிக்க", "మరింత చదవండి", "ಇನ್ನಷ್ಟು ಓದಿ", "കൂടുതൽ വായിക്കുക"],
  "shop": ["दुकान", "दुकान", "દુકાન", "ਦੁਕਾਨ", "দোকান", "দোকান", "ଦୋକାନ", "கடை", "దుకాణం", "ಅಂಗಡಿ", "കട"],
  "price": ["कीमत", "किंमत", "કિંમત", "ਕੀਮਤ", "দাম", "দাম", "ମୂଲ୍ୟ", "விலை", "ధర", "ಬೆಲೆ", "വില"],
  "add to cart": ["कार्ट में जोड़ें", "कार्टमध्ये जोडा", "કાર્ટમાં ઉમેરો", "ਕਾਰਟ ਵਿੱਚ ਪਾਓ", "কার্টে যোগ করুন", "কাৰ্টত যোগ কৰক", "କାର୍ଟରେ ଯୋଡନ୍ତୁ", "கார்ட்டில் சேர்", "కార్ట్‌కు జోడించండి", "ಕಾರ್ಟ್‌ಗೆ ಸೇರಿಸಿ", "കാർട്ടിലേക്ക് ചേർക്കുക"],
};
export const PHRASES = Object.keys(BOOK).length;
/** The phrase book's translation of a whole short text, or null. Ending punctuation is kept. */
export function phrase(text: string, lang: string): string | null {
  const i = ORDER.indexOf(lang); if (i < 0) return null;
  const m = /^(\s*)(.*?)([\s:.!…]*)$/s.exec(text); if (!m) return null;
  const hit = BOOK[m[2].toLowerCase().replace(/\s+/g, " ")];
  return hit && hit[i] ? m[1] + hit[i] + m[3] : null;
}

type BT = { translate: (s: string) => Promise<string> };
const API = (): any => (typeof self !== "undefined" ? (self as any).Translator : undefined);
export const browserHasTranslator = () => !!API();
const made = new Map<string, Promise<BT | null>>();
/** Whether this browser can translate from → to on the device: "ready", "download" (it fetches its language pack first) or "no". */
export async function browserCan(from: string, to: string): Promise<"ready" | "download" | "no"> {
  const T = API(); if (!T) return "no";
  // Some browsers never answer this (the feature is there but switched off): give them four seconds.
  try { const a = await Promise.race([T.availability({ sourceLanguage: from, targetLanguage: to }), new Promise<string>((r) => setTimeout(() => r("unavailable"), 4000))]); return a === "available" ? "ready" : a === "downloadable" || a === "downloading" ? "download" : "no"; } catch { return "no"; }
}
function browserTranslator(from: string, to: string, step?: (s: string) => void): Promise<BT | null> {
  const k = from + ">" + to;
  if (!made.has(k)) made.set(k, (async () => {
    const T = API(); if (!T || (await browserCan(from, to)) === "no") return null;
    try { return await T.create({ sourceLanguage: from, targetLanguage: to, monitor: (m: any) => m?.addEventListener?.("downloadprogress", (e: any) => step?.(`The browser is fetching its language pack: ${Math.round((e.loaded || 0) * 100)}%`)) }); }
    catch (e: any) { made.delete(k); throw new Error(/NotAllowed|activation|gesture/i.test(String(e?.name || e?.message || e)) ? "The browser needs a click before it fetches its language pack. Press Translate what's missing again." : "The browser's translator couldn't start (" + String(e?.message || e).slice(0, 100) + ")."); }
  })());
  return made.get(k)!;
}
// What must come through untouched: bold / highlight / underline marks, {placeholders}, tags, links, emails, prices and codes.
const KEEP = /(\*\*|==|__|\*|\{[^}]*\}|<[^>]+>|https?:\/\/\S+|[\w.+-]+@[\w-]+\.[\w.-]+|\|)/;
async function keepMarks(t: BT, text: string): Promise<string> {
  const lines = text.split("\n"), out: string[] = [];
  for (const line of lines) {
    const head = /^(\s*(?:[-–•#>]+\s+|\d+[.)]\s+)?)/.exec(line)![1], parts = line.slice(head.length).split(KEEP);
    let s = head;
    for (const [i, part] of parts.entries()) {
      if (i % 2 || !/\p{L}{2,}/u.test(part)) { s += part; continue; }
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(part)!; s += m[1] + String(await t.translate(m[2])).trim() + m[3];
    }
    out.push(s);
  }
  return out.join("\n");
}

export type SystemTranslated = { t: (string | null)[]; book: number; browser: number; /** Why some texts were left (empty when none were). */ why: string };
/** Translates what it can on this device; null marks a text that is left for the owner. */
export async function systemTranslate(o: { from: string; to: string; name: string; texts: string[]; step?: (s: string) => void; done?: (n: number) => void }): Promise<SystemTranslated> {
  const out: (string | null)[] = o.texts.map(() => null); let book = 0, browser = 0, why = "";
  let bt: BT | null = null, tried = false;
  for (const [i, text] of o.texts.entries()) {
    const p = o.from === "en" ? phrase(text, o.to) : null;
    if (p) { out[i] = p; book++; o.done?.(book + browser); continue; }
    if (!tried) {
      tried = true;
      try { bt = await browserTranslator(o.from, o.to, o.step); } catch (e: any) { why = String(e?.message || e); }
      if (!bt && !why) why = browserHasTranslator() ? `This browser's built-in translator doesn't have ${o.name}.` : "This browser has no built-in translator (Chrome and Edge on a computer do).";
    }
    if (!bt) continue;
    try { const v = await keepMarks(bt, text); if (v.trim()) { out[i] = v; browser++; o.done?.(book + browser); } } catch { /* that text is left for the owner */ }
  }
  return { t: out, book, browser, why: out.some((x) => x == null) ? why || "Some texts came back empty." : "" };
}
