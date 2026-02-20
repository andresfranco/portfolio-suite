#!/usr/bin/env python3
"""
Script to clean up base64 images from section texts in the database.
This prevents browser freezing when editing sections with embedded base64 images.

Usage:
    python scripts/cleanup_base64_images.py
"""

import re
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.section import Section

def clean_base64_from_text(html_text: str) -> tuple[str, int]:
    """
    Remove base64 images from HTML text.
    
    Returns:
        tuple: (cleaned_text, count_of_images_removed)
    """
    if not html_text or 'data:image' not in html_text:
        return html_text, 0
    
    # Count base64 images
    base64_pattern = r'src=["\'](data:image/[^;]+;base64,[^"\']+)["\']'
    matches = re.findall(base64_pattern, html_text, re.IGNORECASE)
    count = len(matches)
    
    if count == 0:
        return html_text, 0
    
    # Replace base64 images with placeholder
    cleaned_text = re.sub(
        base64_pattern,
        'src="/api/placeholder-image.png" data-base64-removed="true" style="max-width: 300px; border: 2px dashed orange;"',
        html_text,
        flags=re.IGNORECASE
    )
    
    return cleaned_text, count


def main():
    """Main cleanup function."""
    print("🧹 Starting base64 image cleanup...")
    print(f"📊 Database: {settings.DATABASE_URL.split('@')[-1]}")
    print()
    
    db = SessionLocal()
    try:
        # Get all sections
        sections = db.query(Section).all()
        print(f"📂 Found {len(sections)} sections to check")
        print()
        
        total_cleaned = 0
        total_images_removed = 0
        
        for section in sections:
            section_cleaned = False
            section_images = 0
            
            # Check each section_text
            for section_text in section.section_texts:
                if section_text.text and 'data:image' in section_text.text:
                    original_length = len(section_text.text)
                    cleaned_text, images_removed = clean_base64_from_text(section_text.text)
                    new_length = len(cleaned_text)
                    
                    if images_removed > 0:
                        section_text.text = cleaned_text
                        section_cleaned = True
                        section_images += images_removed
                        
                        size_reduction = original_length - new_length
                        print(f"  ✓ Cleaned section_text {section_text.id}")
                        print(f"    - Removed {images_removed} base64 image(s)")
                        print(f"    - Size reduced by {size_reduction:,} characters ({original_length:,} → {new_length:,})")
            
            if section_cleaned:
                total_cleaned += 1
                total_images_removed += section_images
                print(f"✅ Section {section.id} (code: {section.code}): Cleaned {section_images} image(s)")
                print()
        
        if total_cleaned > 0:
            # Commit changes
            db.commit()
            print("=" * 60)
            print(f"✅ SUCCESS!")
            print(f"📊 Summary:")
            print(f"   - Sections cleaned: {total_cleaned}")
            print(f"   - Total images removed: {total_images_removed}")
            print(f"   - Changes committed to database")
            print("=" * 60)
        else:
            print("✨ No base64 images found. Database is clean!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        db.close()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())

