#!/usr/bin/env python3
"""
Script to fix absolute image paths in the database to relative paths.
Run this after updating the upload logic to use relative paths.
"""
import sys
import os
from pathlib import Path

# Add the parent directory to the path so we can import from app
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.project import ProjectImage
from app.core.logging import setup_logger

logger = setup_logger("fix_image_paths")

def get_relative_path(file_path: str, uploads_dir: str) -> str:
    """
    Convert an absolute file path to a relative path from the uploads directory.
    
    Args:
        file_path: Absolute or relative file path
        uploads_dir: Absolute path to uploads directory
        
    Returns:
        Relative path from uploads directory
    """
    if not file_path:
        return ""
    
    # Replace backslashes with forward slashes
    file_path = str(file_path).replace("\\", "/")
    uploads_dir = str(uploads_dir).replace("\\", "/")
    
    # If it's already relative (doesn't start with / or contain uploads directory), return as-is
    if not file_path.startswith("/") and uploads_dir not in file_path:
        logger.info(f"Path already relative: {file_path}")
        return file_path
    
    # If it starts with /uploads/, remove that prefix
    if file_path.startswith("/uploads/"):
        relative_path = file_path[9:]  # Remove "/uploads/" prefix
        logger.info(f"Removed /uploads/ prefix: {file_path} -> {relative_path}")
        return relative_path
    
    # If it starts with uploads/, remove that prefix
    if file_path.startswith("uploads/"):
        relative_path = file_path[8:]  # Remove "uploads/" prefix
        logger.info(f"Removed uploads/ prefix: {file_path} -> {relative_path}")
        return relative_path
    
    # If it's an absolute path containing the uploads directory
    if uploads_dir in file_path:
        # Extract the part after uploads directory
        relative_part = file_path.split(uploads_dir, 1)[1]
        # Remove leading slash if present
        if relative_part.startswith("/"):
            relative_part = relative_part[1:]
        
        logger.info(f"Converted absolute to relative: {file_path} -> {relative_part}")
        return relative_part
    
    # If it contains "uploads/" anywhere, extract everything after it
    if "uploads/" in file_path:
        relative_part = file_path.split("uploads/", 1)[1]
        logger.info(f"Extracted from path: {file_path} -> {relative_part}")
        return relative_part
    
    # If it contains "static/uploads/", extract everything after it
    if "static/uploads/" in file_path:
        relative_part = file_path.split("static/uploads/", 1)[1]
        logger.info(f"Extracted from static path: {file_path} -> {relative_part}")
        return relative_part
    
    # Fallback: return as-is
    logger.warning(f"Could not convert path, returning as-is: {file_path}")
    return file_path

def fix_project_image_paths(db: Session, dry_run: bool = True):
    """
    Fix project image paths in the database.
    
    Args:
        db: Database session
        dry_run: If True, only log changes without updating
    """
    from app.core.config import settings
    uploads_dir = str(settings.UPLOADS_DIR.absolute())
    
    logger.info(f"Uploads directory: {uploads_dir}")
    logger.info(f"Dry run mode: {dry_run}")
    
    # Get all project images
    images = db.query(ProjectImage).all()
    logger.info(f"Found {len(images)} project images to process")
    
    updated_count = 0
    unchanged_count = 0
    
    for image in images:
        old_path = image.image_path
        new_path = get_relative_path(old_path, uploads_dir)
        
        if old_path != new_path:
            logger.info(f"Image {image.id}: '{old_path}' -> '{new_path}'")
            
            if not dry_run:
                image.image_path = new_path
                db.add(image)
            
            updated_count += 1
        else:
            unchanged_count += 1
    
    if not dry_run:
        db.commit()
        logger.info(f"✓ Updated {updated_count} image paths")
    else:
        logger.info(f"DRY RUN: Would update {updated_count} image paths")
    
    logger.info(f"Unchanged: {unchanged_count} images")
    
    return updated_count

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Fix absolute image paths in the database")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually apply the changes (default is dry-run)"
    )
    
    args = parser.parse_args()
    
    logger.info("=" * 60)
    logger.info("Fix Image Paths Script")
    logger.info("=" * 60)
    
    db = SessionLocal()
    
    try:
        updated = fix_project_image_paths(db, dry_run=not args.apply)
        
        if not args.apply and updated > 0:
            logger.info("")
            logger.info("=" * 60)
            logger.info("DRY RUN COMPLETE")
            logger.info("To apply these changes, run with --apply flag:")
            logger.info("  python scripts/fix_image_paths.py --apply")
            logger.info("=" * 60)
        elif args.apply:
            logger.info("")
            logger.info("=" * 60)
            logger.info("✓ Changes applied successfully!")
            logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        db.rollback()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
