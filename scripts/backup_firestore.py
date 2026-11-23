"""Saves a dated CSV copy of all items (notebook order) into scripts/backups/.

Usage:  python backup_firestore.py [--key ../serviceAccountKey.json]
Run it weekly. The CSV has the same columns as items.csv, so it can be re-imported with seed_firestore.py.
"""
import argparse
import csv
import os
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore

parser = argparse.ArgumentParser()
parser.add_argument("--key", default="../serviceAccountKey.json")
args = parser.parse_args()

firebase_admin.initialize_app(credentials.Certificate(args.key))
db = firestore.client()

docs = db.collection("items").order_by("seq").stream()
os.makedirs("backups", exist_ok=True)
path = f"backups/items-{datetime.now():%Y-%m-%d-%H%M}.csv"

count = 0
with open(path, "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f)
    w.writerow(["seq", "category", "itemName", "price", "amountOfItem"])
    for d in docs:
        x = d.to_dict()
        w.writerow([x.get("seq"), x.get("category"), x.get("itemName"), x.get("price"), x.get("amountOfItem")])
        count += 1
print(f"Saved {count} items to {path}")
