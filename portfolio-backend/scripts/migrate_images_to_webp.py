#!/usr/bin/env python3
"""
One-time migration: convert legacy PNG/JPEG uploads to WebP.

For every PNG/JPG file found under the uploads directory:
  1. Convert to WebP using the same Pillow logic as save_upload_file().
  2. Write the .webp file next to the original.
  3. Update any DB row in project_images, section_images, or portfolio_images
     whose image_path references the old file.
  4. Delete the original file.

Tables updated:  project_images.image_path
                 section_images.image_path
                 portfolio_images.image_path

Usage (from portfolio-backend/):
  source venv/bin/activate
  python scripts/migrate_images_to_webp.py             # dry-run (no changes)
  python scripts/migrate_images_to_webp.py --execute   # apply changes
"""

import argparse
import io
import logging
import sys
from pathlib import Path

# Make app/ importable when running from the repo root or the script dir.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s  %(message)s",
)
logger = logging.getLogger("migrate_images_to_webp")

# Raster extensions we want to convert.
_CONVERT_SUFFIXES = {".png", ".jpg", ".jpeg"}


def _content_type_for_suffix(suffix: str) -> str:
    return {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
    }.get(suffix.lower(), "image/jpeg")


def convert_file(src: Path, dry_run: bool) -> Path | None:
    """
    Convert *src* to a sibling .webp file.

    Returns the destination Path on success, None if the file was skipped or
    conversion failed.  When *dry_run* is True the file is read and decoded but
    nothing is written.
    """
    from app.utils.image_utils import compress_image  # noqa: PLC0415

    content_type = _content_type_for_suffix(src.suffix)
    raw = src.read_bytes()

    compressed, final_type = compress_image(
        raw,
        content_type,
        max_width=1920,
        max_height=1080,
        jpeg_quality=85,
    )

    if final_type != "image/webp":
        logger.warning("compress_image did not produce WebP for %s – skipping", src)
        return None

    dest = src.with_suffix(".webp")

    if dry_run:
        savings = max(0, (1 - len(compressed) / len(raw)) * 100) if raw else 0
        logger.info(
            "[DRY-RUN] Would convert %s → %s  (%.0f%% smaller)",
            src.name,
            dest.name,
            savings,
        )
        return dest

    dest.write_bytes(compressed)
    savings = max(0, (1 - len(compressed) / len(raw)) * 100) if raw else 0
    logger.info(
        "Converted %s → %s  (%.0f%% smaller, %d KB → %d KB)",
        src.name,
        dest.name,
        savings,
        len(raw) // 1024,
        len(compressed) // 1024,
    )
    return dest


def update_db(old_path: Path, new_path: Path, db, dry_run: bool) -> int:
    """
    Replace every occurrence of *old_path* (matched as a substring) in the
    three image tables.  Returns the total number of rows updated.
    """
    from sqlalchemy import text  # noqa: PLC0415

    old_str = str(old_path)
    new_str = str(new_path)

    # We match the old path as a substring so both absolute (/opt/…/file.png)
    # and relative (projects/images/file.png) formats are handled.
    tables_cols = [
        ("project_images", "image_path"),
        ("section_images", "image_path"),
        ("portfolio_images", "image_path"),
    ]

    total = 0
    for table, col in tables_cols:
        count_result = db.execute(
            text(f"SELECT COUNT(*) FROM {table} WHERE {col} LIKE :pattern"),
            {"pattern": f"%{old_path.name}%"},
        ).scalar()

        if count_result == 0:
            continue

        if dry_run:
            logger.info(
                "[DRY-RUN] Would update %d row(s) in %s.%s  (%s → %s)",
                count_result,
                table,
                col,
                old_path.name,
                new_path.name,
            )
        else:
            db.execute(
                text(
                    f"UPDATE {table} SET {col} = REPLACE({col}, :old, :new)"
                    f" WHERE {col} LIKE :pattern"
                ),
                {
                    "old": old_str,
                    "new": new_str,
                    "pattern": f"%{old_path.name}%",
                },
            )
            logger.info(
                "Updated %d row(s) in %s.%s", count_result, table, col
            )

        total += count_result

    return total


def run(execute: bool) -> None:
    dry_run = not execute

    from app.core.config import settings  # noqa: PLC0415
    from app.core.database import SessionLocal  # noqa: PLC0415

    uploads_dir = Path(settings.UPLOADS_DIR).resolve()
    logger.info(
        "Scanning %s for PNG/JPG files  [%s]",
        uploads_dir,
        "EXECUTE" if execute else "DRY-RUN",
    )

    candidates = [
        p
        for p in uploads_dir.rglob("*")
        if p.is_file() and p.suffix.lower() in _CONVERT_SUFFIXES
    ]

    if not candidates:
        logger.info("No PNG/JPG files found – nothing to do.")
        return

    logger.info("Found %d file(s) to process.", len(candidates))

    converted = skipped = db_rows = 0

    with SessionLocal() as db:
        for src in candidates:
            dest = convert_file(src, dry_run=dry_run)
            if dest is None:
                skipped += 1
                continue

            rows = update_db(src, dest, db, dry_run=dry_run)
            db_rows += rows

            if not dry_run:
                src.unlink()
                logger.debug("Deleted original %s", src)

            converted += 1

        if not dry_run:
            db.commit()
            logger.info("DB changes committed.")

    logger.info(
        "Done. converted=%d  skipped=%d  db_rows_updated=%d",
        converted,
        skipped,
        db_rows,
    )
    if dry_run:
        logger.info("Re-run with --execute to apply these changes.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Convert legacy PNG/JPEG uploads to WebP and update the DB."
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        default=False,
        help="Apply changes (default is dry-run).",
    )
    args = parser.parse_args()
    run(execute=args.execute)
