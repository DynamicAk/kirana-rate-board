# Kirana Rate Board

Mobile-first rate list for one shop. Same screen as the original single HTML file, but the 125 items now live in Firebase Firestore, so every phone sees the same prices and the board works offline.

## Files

```
kirana-rate-board/
├── index.html              Page and layout (original UI, plus login screen and delete confirm)
├── app.js                  All logic: login, live data from Firestore, search, edit, export
├── firebase-config.js      Your Firebase keys (paste once)
├── data/synonyms.js        Search words: chilli -> mirch / मिर्च ...
├── manifest.webmanifest    Makes it installable on a phone
├── sw.js                   Lets the app open offline
├── icons/                  icon-192.png, icon-512.png
├── firestore.rules         Who may read and who may edit
├── firebase.json           Lets the Firebase CLI publish the rules
├── netlify.toml            Netlify settings
├── .gitignore              Keeps secret keys out of GitHub
└── scripts/                Run on your laptop only
    ├── items.csv           The 125 items from your notebook
    ├── seed_firestore.py   One-time import of items.csv
    ├── manage_users.py     Creates logins and sets viewer / editor roles
    ├── backup_firestore.py Weekly CSV backup
    ├── users.example.csv   Copy to users.csv and fill in
    └── requirements.txt
```

## Setup in short

1. Create a Firebase project. Turn on Authentication (Email/Password) and Firestore (production mode).
2. Add a Web app in Firebase, copy its config into `firebase-config.js`.
3. Publish `firestore.rules` (Firebase console > Firestore > Rules, paste, Publish).
4. Project settings > Service accounts > Generate new private key. Save it as `serviceAccountKey.json` in the project root. Never upload this file.
5. `cd scripts && pip install -r requirements.txt`
6. `python seed_firestore.py` loads the 125 items.
7. Copy `users.example.csv` to `users.csv`, edit it, then `python manage_users.py`.
8. Push the folder to GitHub, connect the repo to Netlify (no build command, publish directory `.`).
9. In Firebase > Authentication > Settings > Authorized domains, add your Netlify domain.
10. Open the Netlify link on each phone, sign in, then Add to Home Screen.

## Run locally

Service workers and ES modules need a web server, not a double-click:

```
python -m http.server 8000
```

Open http://localhost:8000 (localhost is already allowed by Firebase).

## Updating the app

Change files, push to GitHub, Netlify redeploys. Our own files load network-first, so phones pick up changes on the next online open. If you ever change the list of cached files in `sw.js`, also change `CACHE = "rateboard-v1"` to `v2`.
