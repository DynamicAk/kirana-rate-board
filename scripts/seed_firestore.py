"""One-time import: loads scripts/items.csv into the Firestore 'items' collection.

Usage:  python seed_firestore.py [--key ../serviceAccountKey.json]
Safe to re-run: each row gets a fixed ID (item-0001 ...), so it overwrites instead of duplicating.
"""
import argparse
import csv
import firebase_admin
from firebase_admin import credentials, firestore

parser = argparse.ArgumentParser()
parser.add_argument("--key", default="../serviceAccountKey.json")
parser.add_argument("--csv", default="items.csv")
args = parser.parse_args()

firebase_admin.initialize_app(credentials.Certificate(args.key))
db = firestore.client()

with open(args.csv, newline="", encoding="utf-8-sig") as f:
    rows = list(csv.DictReader(f))

batch = db.batch()
for n, row in enumerate(rows, start=1):
    seq = int(row["seq"])
    ref = db.collection("items").document(f"item-{seq:04d}")
    batch.set(ref, {
        "seq": seq,                                  # notebook order
        "category": row["category"],
        "itemName": row["itemName"],                 # Hindi + (English) kept as written
        "price": row["price"],                       # text, e.g. "₹20 / ₹75"
        "amountOfItem": row["amountOfItem"],         # e.g. "250g (1 paw) / 1 kg"
        "updatedAt": firestore.SERVER_TIMESTAMP,
        "updatedBy": "seed-script",
    })
    if n % 400 == 0:                                 # Firestore batch limit is 500
        batch.commit()
        batch = db.batch()
batch.commit()
print(f"Imported {len(rows)} items.")
