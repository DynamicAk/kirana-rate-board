# Kirana Rate Board

## Problem I wanted to solve

In a local kirana shop, maintaining grocery prices in a notebook makes it difficult to find rates quickly, update prices regularly, and keep everyone working with the same information. A single product can also have different prices for different quantities, such as 250 g, 500 g and 1 kg. Searching for products becomes harder when their names are written in Hindi, English or Hinglish.

I wanted to build a simple digital rate board that solves these problems without requiring a complicated billing or inventory system.

## About the project

I developed Kirana Rate Board as a mobile-first Progressive Web App (PWA) for managing grocery prices. I started with 125 grocery items and used Firebase Firestore to store the rates centrally so that shop staff can access the same updated list on different devices.

I designed the interface to be compact and easy to use on a phone, with offline access to previously cached data and separate viewer and editor permissions.

**Current version:** v2.1 — [Feature version history](FEATURES_VERSION.md)

## Key features

- **Multiple rates:** I can store different quantities and whole-rupee prices under one product.
- **Compact mobile UI:** I use a sticky icon-and-search header, smaller category chips, and a bottom item counter. The first saved rate is displayed by default, with expandable options for products having multiple rates. The store icon opens print, sign-out and authorized editing actions.
- **Smart search:** I implemented Levenshtein-based fuzzy matching and synonyms to support spelling mistakes and English, Hindi and Hinglish searches.
- **Hindi suggestions:** A local grocery dictionary suggests Hindi names, which can be edited manually.
- **Real-time synchronization:** Firestore keeps the rate list synchronized across devices.
- **Offline access:** A service worker and Firestore local caching support previously loaded data without internet.
- **Authentication:** Viewers can read rates, while editors can manage products and prices.
- **Voice search:** Browser speech recognition supports Hindi and English on compatible browsers.
- **Export and print:** The app supports CSV export and printing of all quantity-price options.

## Technology stack

| Component | Technology |
| --- | --- |
| Frontend | HTML, Tailwind CSS, Vanilla JavaScript |
| Database | Firebase Cloud Firestore |
| Authentication | Firebase Authentication and custom role claims |
| Smart search | Levenshtein edit distance and synonym matching |
| Hindi suggestions | Offline grocery-name dictionary |
| Voice search | Web Speech API |
| Offline support | Service Worker, PWA, Firestore persistent cache |
| Administration | Python, Firebase Admin SDK |
| Deployment | Netlify |
| Version control | Git and GitHub |

## Project structure

```text
kirana-rate-board/
├── index.html              User interface and responsive layout
├── app.js                  Authentication, database, editing and export
├── smart-search.js         Fuzzy search and Hindi name suggestions
├── voice.js                Voice search keyword extraction
├── firebase-config.js      Firebase web app configuration
├── data/
│   └── synonyms.js        English, Hindi and Hinglish search synonyms
├── manifest.webmanifest    PWA installation configuration
├── sw.js                   Service worker and offline caching
├── icons/                  PWA icons
├── firestore.rules         Database access permissions
├── firebase.json           Firebase CLI configuration
├── netlify.toml            Deployment configuration
├── .gitignore              Excludes private credentials and local files
├── README.md               Project documentation
├── FEATURES_VERSION.md     Short release history
└── scripts/
    ├── items.csv           Initial grocery dataset
    ├── seed_firestore.py   Initial Firestore import
    ├── manage_users.py     User creation and role management
    ├── backup_firestore.py Legacy CSV backup script
    ├── users.example.csv   Example user configuration
    └── requirements.txt    Python dependencies
```

## Installation and setup

### 1. Clone the repository

```bash
git clone https://github.com/DynamicAk/kirana-rate-board.git
cd kirana-rate-board
```

Repository access is required.

### 2. Configure Firebase

1. Create a Firebase project and register a web app.
2. Enable Email/Password authentication and create a Firestore database in production mode.
3. Copy the web app configuration into `firebase-config.js`.
4. Publish the rules from `firestore.rules` in the Firebase console.
5. For the local administration scripts, create a service account with appropriate permissions and save its credentials as `serviceAccountKey.json` in the project root.

Never commit service account credentials or user passwords to GitHub.

### 3. Install Python dependencies and import initial data

From the project root:

```bash
cd scripts
pip install -r requirements.txt
python seed_firestore.py
```

Run the seed script only for initial setup on an empty database. It overwrites matching document IDs and can replace existing prices and variants. The bundled CSV is the original dataset, not a live database export.

### 4. Create users

Copy `users.example.csv` to `users.csv` and enter the email, password and role for each account.

```bash
python manage_users.py
```

- `viewer`: Can view and search products.
- `editor`: Can add, edit and delete products.

Keep `users.csv` private.

### 5. Run locally

Return to the project root and start a local web server:

```bash
cd ..
python -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). Add localhost to Firebase Authentication authorized domains if required.

### 6. Deploy on Netlify

Connect the GitHub repository to Netlify with the following settings:

| Setting | Value |
| --- | --- |
| Base directory | Repository root |
| Build command | None |
| Publish directory | `.` |

Add the deployed Netlify domain to Firebase Authentication authorized domains. Open the deployed app, sign in and install it using the browser's Add to Home Screen option.

## Maintenance and version history

I maintain a separate [FEATURES_VERSION.md](FEATURES_VERSION.md) file to record the features added, changed or removed and the technologies used in each update.

The app uses network-first caching for its own files. When changing cached assets, I update the service worker cache version so devices can receive the new release.

**Backup note:** The legacy Python backup script exports only the original single-rate fields. For a complete multi-rate CSV, I use Export CSV in the app while online; this is a report, not a full Firestore restore backup.
