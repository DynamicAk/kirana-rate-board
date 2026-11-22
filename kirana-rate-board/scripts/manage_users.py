"""Creates the shop's logins and gives each one a role (viewer or editor).

Usage:  python manage_users.py [--key ../serviceAccountKey.json] [--users users.csv]
users.csv columns: email,password,role   (see users.example.csv)

Run it again any time to add people or change a role. Existing users keep their password
unless you put a new one in the file. A person must sign out and in once to get a new role.
"""
import argparse
import csv
import firebase_admin
from firebase_admin import auth, credentials

parser = argparse.ArgumentParser()
parser.add_argument("--key", default="../serviceAccountKey.json")
parser.add_argument("--users", default="users.csv")
args = parser.parse_args()

firebase_admin.initialize_app(credentials.Certificate(args.key))

with open(args.users, newline="", encoding="utf-8-sig") as f:
    for row in csv.DictReader(f):
        email, password, role = row["email"].strip(), row["password"].strip(), row["role"].strip()
        if role not in ("viewer", "editor"):
            print(f"SKIP {email}: role must be viewer or editor, got '{role}'")
            continue
        try:
            user = auth.get_user_by_email(email)
            if password:
                auth.update_user(user.uid, password=password)
            action = "updated"
        except auth.UserNotFoundError:
            user = auth.create_user(email=email, password=password)
            action = "created"
        auth.set_custom_user_claims(user.uid, {"role": role})
        print(f"{action}: {email} -> {role}")
