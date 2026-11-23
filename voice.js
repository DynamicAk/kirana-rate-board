// Voice helpers. Plain functions, no libraries. The browser does the listening and speaking.

// Words that carry no item name, so "chilli ka rate kya hai" becomes just "chilli".
const STOP = new Set([
  "price", "prices", "rate", "rates", "cost", "of", "the", "what", "whats", "is", "how", "much", "does",
  "rupees", "rupee", "per", "kg", "for", "tell", "me", "please", "a", "an", "has",
  "ka", "ke", "ki", "kya", "hai", "hain", "kitna", "kitne", "kitni", "bhav", "bhaav", "daam", "kimat",
  "bata", "batao", "batana", "do", "dena", "ho", "mein", "se", "aur",
  "क्या", "है", "हैं", "का", "के", "की", "कितना", "कितने", "कितनी", "भाव", "रेट", "दाम", "कीमत",
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

// "लाल मिर्च साबुत (Lal Mirch Sabut)" -> Hindi part or English part
function spokenName(itemName, hindi) {
  const m = String(itemName).match(/^(.*?)\s*\((.*)\)\s*$/);
  if (!m) return itemName;
  return hindi ? (m[1] || m[2]) : m[2];
}

// One item as a sentence: "Chilli: 20 rupees for 50g, 40 rupees for 100g"
export function spokenLine(item, hindi) {
  const rupee = hindi ? "रुपये" : "rupees";
  const clean = s => String(s).replace(/₹\s*(\d+)/g, `$1 ${rupee}`).replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  const prices = String(item.price).split("/").map(clean);
  const units = String(item.amountOfItem).split("/").map(clean);
  const name = spokenName(item.itemName, hindi);

  let body;
  if (prices.length === units.length) {
    body = prices.map((p, i) => hindi ? `${units[i]} का ${p}` : `${p} for ${units[i]}`).join(", ");
  } else {
    body = hindi
      ? `${prices.join(" या ")}, ${units.join(" या ")}`
      : `${prices.join(" or ")} for ${units.join(" or ")}`;
  }
  return `${name}: ${body}`;
}

// Full spoken reply. Reads the first 3 matches, mentions the rest are on screen.
export function buildAnswer(found, query, hindi) {
  if (!found.length) return hindi ? `${query} नहीं मिला` : `No item found for ${query}`;
  let text = found.slice(0, 3).map(it => spokenLine(it, hindi)).join(". ");
  if (found.length > 3) {
    const more = found.length - 3;
    text += hindi ? `. और ${more} आइटम स्क्रीन पर हैं` : `. ${more} more on screen`;
  }
  return text;
}
