from fastapi import APIRouter
import logging

# Setup logger
logger = logging.getLogger("app.api.router")

try:
    from app.api.endpoints import (
        auth,
        mfa,
        account_security,
        users,
        roles,
        permissions,
        languages,
        translations,
        portfolios,
        sections,
        experiences,
        projects,
        categories,
        category_types,
        skills,
        skill_types,
        email,
        system_settings,
        search,
        rag_admin,
        agents,
        security_dashboard,
        website,
        cms,
        links
    )
    logger.debug("Successfully imported all endpoint modules")
except ImportError as e:
    logger.error(f"Error importing endpoint modules: {e}", exc_info=True)
    raise

api_router = APIRouter()

# Authentication
try:
    api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
    api_router.include_router(mfa.router, prefix="/mfa", tags=["Multi-Factor Authentication"])
    api_router.include_router(account_security.router, prefix="/account", tags=["Account Security"])
    
    # User management
    api_router.include_router(users.router, prefix="/users", tags=["Users"])
    api_router.include_router(roles.router, prefix="/roles", tags=["Roles"])
    api_router.include_router(permissions.router, prefix="/permissions", tags=["Permissions"])
    api_router.include_router(email.router, prefix="/email", tags=["Email"])

    # Content management
    api_router.include_router(languages.router, prefix="/languages", tags=["Languages"])
    api_router.include_router(translations.router, prefix="/translations", tags=["Translations"])
    api_router.include_router(portfolios.router, prefix="/portfolios", tags=["Portfolios"])
    api_router.include_router(sections.router, prefix="/sections", tags=["Sections"])

    # Portfolio content
    api_router.include_router(experiences.router, prefix="/experiences", tags=["Experiences"])
    api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
    api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
    api_router.include_router(category_types.router, prefix="/category-types", tags=["Category Types"])
    api_router.include_router(skills.router, prefix="/skills", tags=["Skills"])
    api_router.include_router(skill_types.router, prefix="/skill-types", tags=["Skill Types"])
    api_router.include_router(links.router, prefix="/links", tags=["Links"])
    
    # Public website API (no authentication required)
    api_router.include_router(website.router, prefix="/website", tags=["Website"])
    
    # CMS API (authenticated, requires EDIT_CONTENT permission)
    api_router.include_router(cms.router, prefix="/cms", tags=["CMS"])
    
    # System settings (admin)
    api_router.include_router(system_settings.router, prefix="/settings", tags=["System Settings"])
    api_router.include_router(search.router, prefix="/search", tags=["Search"])
    api_router.include_router(rag_admin.router, prefix="/rag", tags=["RAG Admin"])
    api_router.include_router(agents.router, prefix="/agents", tags=["Agents"])
    api_router.include_router(security_dashboard.router, prefix="/admin/security", tags=["Security Dashboard"])
    logger.debug("Successfully included all routers")
except Exception as e:
    logger.error(f"Error including router: {e}", exc_info=True)
    raise
