#!/usr/bin/env python3
"""
Link Categories Initialization Script
--------------------------------------

This script initializes default link category types and categories for the portfolio system.

Usage:
    python scripts/db/init_link_categories.py
"""

import sys
import os

# Add the parent directory to sys.path to access app modules
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from app.core.database import get_db
from app.core.logging import setup_logger
from app.crud import link as link_crud
from app.schemas.link import (
    LinkCategoryTypeCreate,
    LinkCategoryCreate,
    LinkCategoryTextCreate
)

# Setup logger
logger = setup_logger("init_link_categories")


# Default link category types and categories
LINK_CATEGORY_TYPES = [
    {"code": "SOCL", "name": "Social Networks"},
    {"code": "BLOG", "name": "Blogs & Articles"},
    {"code": "PORT", "name": "Portfolio & Projects"},
    {"code": "OTHR", "name": "Other Links"}
]

LINK_CATEGORIES = [
    # Social Networks
    {
        "code": "GITHUB",
        "type_code": "SOCL",
        "icon_name": "FaGithub",
        "texts": [
            {"language_id": 1, "name": "GitHub", "description": "GitHub profile"},
            {"language_id": 2, "name": "GitHub", "description": "Perfil de GitHub"}
        ]
    },
    {
        "code": "LINKEDIN",
        "type_code": "SOCL",
        "icon_name": "FaLinkedin",
        "texts": [
            {"language_id": 1, "name": "LinkedIn", "description": "LinkedIn profile"},
            {"language_id": 2, "name": "LinkedIn", "description": "Perfil de LinkedIn"}
        ]
    },
    {
        "code": "TWITTER",
        "type_code": "SOCL",
        "icon_name": "FaXTwitter",
        "texts": [
            {"language_id": 1, "name": "Twitter", "description": "Twitter/X profile"},
            {"language_id": 2, "name": "Twitter", "description": "Perfil de Twitter/X"}
        ]
    },
    {
        "code": "INSTAGRAM",
        "type_code": "SOCL",
        "icon_name": "FaInstagram",
        "texts": [
            {"language_id": 1, "name": "Instagram", "description": "Instagram profile"},
            {"language_id": 2, "name": "Instagram", "description": "Perfil de Instagram"}
        ]
    },
    {
        "code": "FACEBOOK",
        "type_code": "SOCL",
        "icon_name": "FaFacebook",
        "texts": [
            {"language_id": 1, "name": "Facebook", "description": "Facebook profile"},
            {"language_id": 2, "name": "Facebook", "description": "Perfil de Facebook"}
        ]
    },
    # Blogs & Articles
    {
        "code": "MEDIUM",
        "type_code": "BLOG",
        "icon_name": "FaMedium",
        "texts": [
            {"language_id": 1, "name": "Medium", "description": "Medium blog"},
            {"language_id": 2, "name": "Medium", "description": "Blog de Medium"}
        ]
    },
    {
        "code": "DEVTO",
        "type_code": "BLOG",
        "icon_name": "FaDev",
        "texts": [
            {"language_id": 1, "name": "Dev.to", "description": "Dev.to articles"},
            {"language_id": 2, "name": "Dev.to", "description": "Artículos en Dev.to"}
        ]
    },
    {
        "code": "HASHNODE",
        "type_code": "BLOG",
        "icon_name": "SiHashnode",
        "texts": [
            {"language_id": 1, "name": "Hashnode", "description": "Hashnode blog"},
            {"language_id": 2, "name": "Hashnode", "description": "Blog de Hashnode"}
        ]
    },
    # Portfolio & Projects
    {
        "code": "WEBSITE",
        "type_code": "PORT",
        "icon_name": "FaGlobe",
        "texts": [
            {"language_id": 1, "name": "Website", "description": "Personal website"},
            {"language_id": 2, "name": "Sitio Web", "description": "Sitio web personal"}
        ]
    },
    {
        "code": "PORTFOLIO",
        "type_code": "PORT",
        "icon_name": "FaBriefcase",
        "texts": [
            {"language_id": 1, "name": "Portfolio", "description": "Portfolio site"},
            {"language_id": 2, "name": "Portafolio", "description": "Sitio de portafolio"}
        ]
    },
    {
        "code": "CODEPEN",
        "type_code": "PORT",
        "icon_name": "FaCodepen",
        "texts": [
            {"language_id": 1, "name": "CodePen", "description": "CodePen profile"},
            {"language_id": 2, "name": "CodePen", "description": "Perfil de CodePen"}
        ]
    },
    {
        "code": "STACKOVERFLOW",
        "type_code": "PORT",
        "icon_name": "FaStackOverflow",
        "texts": [
            {"language_id": 1, "name": "Stack Overflow", "description": "Stack Overflow profile"},
            {"language_id": 2, "name": "Stack Overflow", "description": "Perfil de Stack Overflow"}
        ]
    },
    # Other Links
    {
        "code": "YOUTUBE",
        "type_code": "OTHR",
        "icon_name": "FaYoutube",
        "texts": [
            {"language_id": 1, "name": "YouTube", "description": "YouTube channel"},
            {"language_id": 2, "name": "YouTube", "description": "Canal de YouTube"}
        ]
    },
    {
        "code": "EMAIL",
        "type_code": "OTHR",
        "icon_name": "FaEnvelope",
        "texts": [
            {"language_id": 1, "name": "Email", "description": "Email contact"},
            {"language_id": 2, "name": "Correo", "description": "Contacto por correo"}
        ]
    },
    {
        "code": "DISCORD",
        "type_code": "OTHR",
        "icon_name": "FaDiscord",
        "texts": [
            {"language_id": 1, "name": "Discord", "description": "Discord server"},
            {"language_id": 2, "name": "Discord", "description": "Servidor de Discord"}
        ]
    }
]


def init_link_categories():
    """Initialize default link category types and categories."""
    logger.info("Starting link categories initialization...")

    db = next(get_db())

    try:
        # Create link category types
        logger.info("Creating link category types...")
        for type_data in LINK_CATEGORY_TYPES:
            try:
                existing = link_crud.get_link_category_type(db, type_data["code"])
                if existing:
                    logger.info(f"Link category type '{type_data['code']}' already exists, skipping")
                    continue

                category_type = LinkCategoryTypeCreate(**type_data)
                created_type = link_crud.create_link_category_type(db, category_type)
                logger.info(f"Created link category type: {created_type.code} - {created_type.name}")
            except Exception as e:
                logger.error(f"Error creating link category type '{type_data['code']}': {e}")
                continue

        # Create link categories
        logger.info("Creating link categories...")
        for cat_data in LINK_CATEGORIES:
            try:
                existing = link_crud.get_link_category_by_code(db, cat_data["code"])
                if existing:
                    logger.info(f"Link category '{cat_data['code']}' already exists, skipping")
                    continue

                # Prepare texts
                texts = [LinkCategoryTextCreate(**text) for text in cat_data.get("texts", [])]

                category = LinkCategoryCreate(
                    code=cat_data["code"],
                    type_code=cat_data["type_code"],
                    icon_name=cat_data.get("icon_name"),
                    texts=texts
                )

                created_cat = link_crud.create_link_category(db, category)
                logger.info(f"Created link category: {created_cat.code} ({len(created_cat.category_texts)} texts)")
            except Exception as e:
                logger.error(f"Error creating link category '{cat_data['code']}': {e}")
                continue

        logger.info("Link categories initialization completed successfully!")
        return True

    except Exception as e:
        logger.error(f"Error during link categories initialization: {e}", exc_info=True)
        return False
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Link Categories Initialization Script")
    logger.info("=" * 60)

    success = init_link_categories()

    if success:
        logger.info("=" * 60)
        logger.info("Initialization completed successfully!")
        logger.info("=" * 60)
        sys.exit(0)
    else:
        logger.error("=" * 60)
        logger.error("Initialization failed!")
        logger.error("=" * 60)
        sys.exit(1)
