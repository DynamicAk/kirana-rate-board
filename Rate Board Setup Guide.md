Setup guide

# Rate Board Setup Guide

Your original rate list page now reads and saves its 125 items in a Firebase database. The screen looks the same. This page lists every file, then walks you through setup.

### Assumptions I made

- Database is Firebase Firestore, as you suggested. Hosting is Netlify, with code on GitHub.
- Each person has an email and password login. 2 or 3 are editors, the rest viewers.
- The Reset and Save HTML buttons are removed. The data now lives in the database, so a page-level reset or self-copy no longer makes sense. Use the backup script instead.
- I added a login screen, a Sign out button and a delete confirmation. Everything else on screen is unchanged.
- Tailwind stays on its CDN script, as in your file. That keeps the look identical. It needs internet on first load, then it is cached.
- Prices stay as text (for example `₹20 / ₹75`), since many items have several prices.
- I could not test against a live Firebase project from here. I checked syntax, the 125 rows and that every button handler exists. Do the test list at the end after setup.

## 1. What is in the folder

| File | What it does |
| --- | --- |
| kirana-rate-board/ | Whole project. Upload this folder to GitHub. |
| index.html | Page layout. Your original design, plus a login screen and delete confirmation. |
| app.js | All the logic: login, live data, search, filters, edit, add, delete, CSV export. |
| firebase-config.js you edit | Your Firebase keys. Paste them once. |
| data/synonyms.js | Search words, such as chilli to mirch and मिर्च. Add words here any time. |
| manifest.webmanifest | Name, colour and icons so phones can install it. |
| sw.js | Saves the app files on the phone so it opens offline. |
| icons/ | icon-192.png and icon-512.png (an orange ₹ tile). Replace with your shop logo if you like. |
| firestore.rules | Database security: viewers read, only editors change. |
| firebase.json | Lets the Firebase tool publish the rules. |
| netlify.toml | Netlify settings. No build step. |
| .gitignore | Stops secret files from going to GitHub. |
| README.md | Short version of this guide. |
| scripts/ | Python files you run on your laptop. Not part of the website. |
| items.csv | Your 125 items, in notebook order. |
| seed_firestore.py | One-time import of items.csv into the database. |
| manage_users.py | Creates the logins and sets viewer or editor. |
| backup_firestore.py | Saves a dated CSV copy of all prices. |
| users.example.csv copy to users.csv | Template for your 10 logins. |
| requirements.txt | Python package list (firebase-admin). |
| serviceAccountKey.json secret | You download this from Firebase in step 4. Keep it on your laptop only. Never put it on GitHub. |

## 2. How the data is stored

One collection called `items`. Each of your 125 array entries becomes one document. The old `uid` becomes `seq`, which keeps the notebook order.

```
items / item-0012
  seq:          12
  category:     "Spices & Masala"
  itemName:     "लाल मिर्च साबुत (Lal Mirch Sabut)"
  price:        "₹75"
  amountOfItem: "250g (1 paw)"
  updatedAt:    (server time)
  updatedBy:    "owner@yourshop.com"
```

Adding an item between two others gets a sequence number halfway between them, so no other item has to be renumbered.

## 3. Setup steps

1. ### Create the Firebase project
   - Go to `console.firebase.google.com` and click Add project. Name it, for example, `kirana-rate-board`. Turn Google Analytics off.
   - Authentication > Get started > Email/Password > Enable > Save.
   - Build > Firestore Database > Create database > choose a region near you (Mumbai, `asia-south1`) > Production mode.
2. ### Connect the web page to Firebase
   - Project settings (gear icon) > Your apps > the `</>` Web icon > register the app (skip Firebase Hosting).
   - Copy the `firebaseConfig` values into `firebase-config.js`, replacing every `PASTE_...`.
3. ### Publish the security rules
   - Firestore Database > Rules tab. Delete what is there, paste the contents of `firestore.rules`, click Publish.

   This is what stops a viewer from changing prices. Anyone who is not given a role by the script in step 6 can neither read nor change anything. 
4. ### Download the admin key (for your laptop)
   - Project settings > Service accounts > Generate new private key.
   - Save the file as `serviceAccountKey.json` in the main project folder, next to `index.html`. The `.gitignore` keeps it off GitHub.
5. ### Install Python packages and load the 125 items

   ```
   cd scripts
   pip install -r requirements.txt
   python seed_firestore.py
   ```

   You should see `Imported 125 items.` Check in Firestore Database > Data: the `items` collection shows 125 documents. Running it again is safe. It overwrites, it does not duplicate.
6. ### Create the logins and roles
   - Copy `users.example.csv` to `users.csv`. Put in your 10 people: email, a password, and `editor` or `viewer`. # password should be atleast 6 char.

   ```
   python manage_users.py
   ```

   It prints one line per person. To change a role later, edit the file and run it again. That person signs out and in once.
7. ### Test on your laptop

   ```
   cd ..
   python -m http.server 8000
   ```

   Open `http://localhost:8000`. Sign in as an editor and go through the test list below.
8. ### Put the code on GitHub

   ```
   git init
   git add .
   git commit -m "Kirana rate board"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/kirana-rate-board.git
   git push -u origin main
   ```

   Make the repository private. Before you push, run `git status` and confirm `serviceAccountKey.json` and `scripts/users.csv` are not listed.
9. ### Deploy on Netlify
   - Add new site > Import from Git > pick the repository.
   - Build command: leave empty. Publish directory: `.` (a single dot). Deploy.
   - Copy your new address, for example `yourshop.netlify.app`.
10. ### Allow your Netlify address to log in
    - Firebase > Authentication > Settings > Authorized domains > Add domain > paste `yourshop.netlify.app`.

    Without this step, the live site shows "Wrong email or password" even when the password is right.
11. ### Install on each phone
    - Open the Netlify link in Chrome, sign in, wait for the list to load once.
    - Chrome menu > Add to Home screen (or Install app).
    - Test it: turn on airplane mode and open the app. The list should still show.

## 4. Test list after setup

### As an editor

- All 125 items show, in the original order.
- Search "chilli" shows Mirch items. Search "मिर्च" works too.
- Edit Mode: change a price, press Enter. The status line shows Synced.
- Open the page on a second phone. The new price appears within seconds.
- Add an item, insert one below another, delete one (a confirm box appears).
- Export CSV opens in Excel with Hindi text intact.

### As a viewer

- There is no Edit Mode button.
- Search, category filter and A–Z / Z–A sort work.
- In Firestore Rules Playground, a viewer write to `items` is denied.

### Offline

- Load once online, then switch on airplane mode.
- The list still opens. The status line says Offline copy.
- As an editor, change a price offline. It syncs when internet returns.

## 5. If something goes wrong

Page stays on "Loading…" after login

The account has no role. Run `manage_users.py` for that email, then sign out and in.

"Wrong email or password" on the live site only

Add the Netlify address under Authorized domains (step 10).

Status line says "Cannot read data"

Rules were not published (step 3), or the config in `firebase-config.js` is for a different project.

Phone keeps showing an old version

Close the app fully and open it again while online. If it persists, change `rateboard-v1` to `rateboard-v2` in `sw.js` and push.

Blank page when opening `index.html` by double-click

Browsers block modules and service workers from `file://`. Use the local server from step 7.

## 6. Keep it safe

### Weekly backup

- `cd scripts && python backup_firestore.py`
- Saves a dated CSV in `scripts/backups/`.

### Secrets

- Never share `serviceAccountKey.json` or `users.csv`.
- The keys in `firebase-config.js` are safe to publish. The rules protect the data.

## Summary

Unzip the folder, create a Firebase project, paste its config and rules, then run the three Python steps: install, seed, create users. Push to GitHub, deploy on Netlify, authorize the domain, and add the app to each phone's home screen.