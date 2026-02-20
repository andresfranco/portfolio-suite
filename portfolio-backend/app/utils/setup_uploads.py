#!/usr/bin/env python3
"""
Script to set up upload directories for the portfolio backend.
Run this script to ensure all required upload directories exist.
"""

import os
import sys
from pathlib import Path

# Add the parent directory to the path so we can import our app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app.utils.file_utils import ensure_upload_dirs

if __name__ == "__main__":
    ensure_upload_dirs()
