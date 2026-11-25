// Voice typing helper. The browser does the listening; this only cleans what was heard.

// Words that carry no item name, so "chilli ka rate kya hai" becomes just "chilli".
const STOP = new Set([
  "price", "prices", "rate", "rates", "cost", "of", "the", "what", "whats", "is", "how", "much", "does",
  "rupees", "rupee", "per", "kg", "for", "tell", "me", "please", "a", "an", "has",
  "ka", "ke", "ki", "kya", "hai", "hain", "kitna", "kitne", "kitni", "bhav", "bhaav", "daam", "kimat",
  "show", "find", "search", "give", "want", "check", "bata", "batao", "batana", "do", "dena", "ho", "mein", "se", "aur",
  "मुझे", "दिखाओ", "बताएं", "चाहिए", "क्या", "है", "हैं", "का", "के", "की", "कितना", "कितने", "कितनी", "भाव", "रेट", "दाम", "कीमत",
  "बता", "बताओ", "बताइए", "बताना", "दो", "प्रति", "किलो", "रुपये", "रुपए", "में", "से", "और"
]);

// "what is the rate of chilli per kg" -> "chilli"
export function extractKeywords(text) {
  const words = String(text || "")
    .toLowerCase()
    .replace(/[.,?!।'"]/g, " ")
    .split(/\s+/)
    .filter(w => w && !STOP.has(w) && !/^\d+$/.test(w));
  return words.length ? words.join(" ") : String(text || "").trim();
}