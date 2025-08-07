"""
Re-exports file utilities from app/utils/file_utils.py to maintain compatibility
"""
from app.utils.file_utils import (
    save_upload_file,
    delete_file,
    get_file_url,
    ensure_upload_dirs
)
import os
import uuid

# Add any API-specific file utilities here

def generate_unique_filename(original_filename):
    """
    Generate a unique filename based on UUID while preserving the original extension
    
    Args:
        original_filename: The original filename
        
    Returns:
        A unique filename with the original extension
    """
    if not original_filename:
        return f"{uuid.uuid4().hex}.png"  # Default extension if none provided
        
    # Extract extension from original filename
    filename, ext = os.path.splitext(original_filename)
    # Generate a UUID and append the original extension
    return f"{uuid.uuid4().hex}{ext}" 