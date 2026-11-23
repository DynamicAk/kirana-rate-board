# Kirana Rate Board — Feature Versions

## v2.0 — Compact rates & smart names (2026-11-23)
- **Added:** Multiple quantity/whole-rupee rates per item; compact expandable mobile cards; first rate shown by default; editable English/Hindi names; offline typo-tolerant search; CSV and print include all rates.
- **Changed:** Existing single-rate Firestore items are read automatically; edited items store `variants` and retain legacy first-rate fields.
- **Removed:** Price ranges, decimal price entry and large per-rate rows.
- **Tech:** Vanilla JavaScript, Levenshtein fuzzy matching, offline grocery Hindi dictionary, Tailwind CSS, Firebase Auth/Firestore, service worker/PWA, Netlify.

## v1.1 — Mobile UI
- **Added:** Sticky search, category chips, touch-friendly price editing, larger mobile prices.
- **Removed:** Nothing.
- **Tech:** HTML, CSS, JavaScript, Firebase, Netlify.

> Update this file with short Added / Changed / Removed / Tech notes after every future release merged to main.
