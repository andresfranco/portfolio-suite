#!/usr/bin/env python3
"""Reset the password for the 'systemadmin' user.

This script updates the systemadmin user's password to either a provided
value (via --password) or a newly generated strong random password.

It DOES NOT display or recover the current password (which is impossible
by design since only a hash is stored). Instead, it writes a new hash.

Features:
  - Optional --password to set an explicit password.
  - Generates a strong random password if none supplied.
  - Optionally forces activation of the user (sets is_active = TRUE).
  - Safety confirmation unless --yes provided (non-interactive usage).
  - Dry-run mode to preview actions without committing changes.

Usage examples:
  python reset_systemadmin_password.py                # generate random password
  python reset_systemadmin_password.py --password 'NewP@ssw0rd!'  # custom password
  python reset_systemadmin_password.py --force-activate
  python reset_systemadmin_password.py --json --yes   # machine-readable output

Exit codes:
  0 success
  1 user not found
  2 database / execution error
  3 aborted by user
"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import string
import sys
from datetime import datetime
import warnings

import psycopg2
from passlib.context import CryptContext

# Fix for passlib and bcrypt 4.3.0+ compatibility issue (mirrors init_postgres_db)
try:  # pragma: no cover
    import bcrypt  # type: ignore
    if not hasattr(bcrypt, "__about__"):
        class _About:  # minimal shim
            __version__ = getattr(bcrypt, "__version__", "4.0.0")
        bcrypt.__about__ = _About()  # type: ignore[attr-defined]
except Exception:
    pass

# Suppress remaining bcrypt version warnings from passlib
warnings.filterwarnings("ignore", message="error reading bcrypt version")

# Ensure app modules are importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "app"))
from app.core.db_config import db_config  # type: ignore

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

USERNAME = "systemadmin"


def generate_password(length: int = 16) -> str:
    """Generate a strong random password meeting typical complexity rules."""
    if length < 12:
        length = 12  # enforce sane minimum
    alphabet = (
        string.ascii_uppercase
        + string.ascii_lowercase
        + string.digits
        + "!@#$%^&*-_=+?"
    )
    # Ensure minimal complexity: at least one from each category
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        if (
            any(c.islower() for c in pwd)
            and any(c.isupper() for c in pwd)
            and any(c.isdigit() for c in pwd)
            and any(c in "!@#$%^&*-_=+?" for c in pwd)
        ):
            return pwd


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Reset systemadmin password")
    p.add_argument("--password", help="Explicit password to set (otherwise random generated)")
    p.add_argument("--length", type=int, default=20, help="Length for generated password (default 20)")
    p.add_argument("--force-activate", action="store_true", help="Ensure the user is set active (is_active=TRUE)")
    p.add_argument("--yes", "-y", action="store_true", help="Skip confirmation prompt")
    p.add_argument("--json", action="store_true", help="Output machine-readable JSON summary")
    p.add_argument("--dry-run", action="store_true", help="Show what would change without committing")
    p.add_argument("--url", help="Override database URL (bypass db_config)")
    return p.parse_args()


def confirm(prompt: str) -> bool:
    try:
        reply = input(f"{prompt} [y/N]: ").strip().lower()
        return reply in {"y", "yes"}
    except EOFError:
        return False


def main() -> int:
    args = parse_args()

    new_password = args.password or generate_password(args.length)
    hashed = pwd_context.hash(new_password)

    db_url = args.url or db_config.url
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
    except Exception as e:  # pragma: no cover - connectivity issues
        msg = f"Database connection failed: {e}"
        if args.json:
            print(json.dumps({"status": "error", "error": msg}))
        else:
            print(msg, file=sys.stderr)
        return 2

    try:
        cur.execute(
            "SELECT id, is_active FROM users WHERE username = %s FOR UPDATE", (USERNAME,)
        )
        row = cur.fetchone()
        if not row:
            if args.json:
                print(json.dumps({"status": "not_found", "username": USERNAME}))
            else:
                print(f"User '{USERNAME}' not found.")
            return 1

        user_id, is_active = row

        # Preview output before commit
        if not args.yes and not args.dry_run:
            print("About to reset password for user:")
            print(f"  Username : {USERNAME}")
            print(f"  User ID  : {user_id}")
            print(f"  Active   : {is_active}")
            if args.password:
                print("  Mode     : using provided password")
            else:
                print("  Mode     : generated random password")
            if args.force_activate and not is_active:
                print("  Action   : will set is_active = TRUE")
            if args.dry_run:
                print("  DRY RUN  : no changes will be committed")
            if not confirm("Proceed with password reset?"):
                print("Aborted.")
                return 3

        updates = ["hashed_password = %s", "updated_at = %s"]
        params = [hashed, datetime.utcnow()]
        if args.force_activate and not is_active:
            updates.append("is_active = TRUE")

        sql_update = f"UPDATE users SET {', '.join(updates)} WHERE id = %s"
        params.append(user_id)

        if args.dry_run:
            # Do not execute update
            if args.json:
                print(
                    json.dumps(
                        {
                            "status": "dry_run",
                            "username": USERNAME,
                            "user_id": user_id,
                            "would_force_activate": bool(
                                args.force_activate and not is_active
                            ),
                        }
                    )
                )
            else:
                print("Dry run complete. No changes applied.")
            return 0

        cur.execute(sql_update, tuple(params))
        conn.commit()

        if args.json:
            print(
                json.dumps(
                    {
                        "status": "success",
                        "username": USERNAME,
                        "user_id": user_id,
                        "new_password": new_password,
                        "forced_activate": bool(args.force_activate and not is_active),
                    }
                )
            )
        else:
            print("\nPassword reset successful")
            print("=" * 40)
            print(f"Username     : {USERNAME}")
            print(f"User ID      : {user_id}")
            print(f"New Password : {new_password}")
            if args.force_activate and not is_active:
                print("(User was reactivated)")
            print("=" * 40)
            print("IMPORTANT: Store this password securely and change it after login.")

        return 0
    except Exception as e:  # pragma: no cover
        conn.rollback()
        msg = f"Error resetting password: {e}"
        if args.json:
            print(json.dumps({"status": "error", "error": msg}))
        else:
            print(msg, file=sys.stderr)
        return 2
    finally:
        try:
            cur.close()
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
