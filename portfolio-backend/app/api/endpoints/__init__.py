"""
API endpoint modules for the Portfolio backend.

This package contains all the API endpoints organized by resource type.
"""

from . import (
    # Authentication
    auth,
    
    # User management
    users,
    roles,
    permissions,
    email,
    
    # Content management
    languages,
    translations,
    portfolios,
    sections,
    
    # Portfolio content
    experiences,
    projects,
    categories,
    category_types,
    skills,
    skill_types
)
