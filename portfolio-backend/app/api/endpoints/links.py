from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import Any, List, Optional
from pathlib import Path as PathLib
from app import schemas, models
from app.api import deps
from app.crud import link as link_crud
from app.core.logging import setup_logger
from app.core.security_decorators import require_permission
from app.core.config import settings
from app.api.utils import file_utils
from app.schemas.link import (
    LinkCategoryTypeCreate, LinkCategoryTypeUpdate, LinkCategoryTypeOut,
    LinkCategoryCreate, LinkCategoryUpdate, LinkCategoryOut,
    LinkCategoryTextCreate, LinkCategoryTextOut,
    PortfolioLinkCreate, PortfolioLinkUpdate, PortfolioLinkOut,
    PortfolioLinkTextCreate, PortfolioLinkTextOut,
    PortfolioLinkOrderUpdate
)

# Set up logger using centralized logging
logger = setup_logger("app.api.endpoints.links")

# Define router
router = APIRouter()

# --- Link Category Type Endpoints ---

@router.get(
    "/category-types",
    response_model=List[LinkCategoryTypeOut],
    summary="Get all link category types",
    description="Retrieves a list of all link category types (e.g., SOCIAL, BLOG, etc.)."
)
def read_link_category_types(
    db: Session = Depends(deps.get_db),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=200, description="Maximum number of items to return")
) -> Any:
    """Get all link category types."""
    logger.info(f"Fetching link category types with skip={skip}, limit={limit}")

    try:
        category_types = link_crud.get_link_category_types(db, skip=skip, limit=limit)
        return category_types
    except Exception as e:
        logger.exception(f"Error fetching link category types: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch link category types: {str(e)}"
        )


@router.get(
    "/category-types/{code}",
    response_model=LinkCategoryTypeOut,
    summary="Get a specific link category type",
    description="Retrieves a link category type by its code."
)
def read_link_category_type(
    code: str = Path(..., description="The link category type code"),
    db: Session = Depends(deps.get_db)
) -> Any:
    """Get a specific link category type by code."""
    logger.info(f"Fetching link category type: {code}")

    category_type = link_crud.get_link_category_type(db, code=code)
    if not category_type:
        logger.warning(f"Link category type not found: {code}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Link category type '{code}' not found"
        )

    return category_type


@router.post(
    "/category-types",
    response_model=LinkCategoryTypeOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new link category type",
    description="Creates a new link category type."
)
@require_permission("MANAGE_LINK_CATEGORIES")
def create_link_category_type(
    category_type: LinkCategoryTypeCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    """Create a new link category type."""
    logger.info(f"Creating link category type: {category_type.code}")

    try:
        db_category_type = link_crud.create_link_category_type(db, category_type=category_type)
        return db_category_type
    except ValueError as e:
        logger.warning(f"Validation error creating link category type: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception(f"Error creating link category type: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create link category type: {str(e)}"
        )


@router.put(
    "/category-types/{code}",
    response_model=LinkCategoryTypeOut,
    summary="Update a link category type",
    description="Updates an existing link category type."
)
@require_permission("MANAGE_LINK_CATEGORIES")
def update_link_category_type(
    code: str = Path(..., description="The link category type code"),
    category_type: LinkCategoryTypeUpdate = Body(...),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    """Update a link category type."""
    logger.info(f"Updating link category type: {code}")

    try:
        db_category_type = link_crud.update_link_category_type(db, code=code, category_type=category_type)
        if not db_category_type:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Link category type '{code}' not found"
            )
        return db_category_type
    except ValueError as e:
        logger.warning(f"Validation error updating link category type: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error updating link category type: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update link category type: {str(e)}"
        )


@router.delete(
    "/category-types/{code}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a link category type",
    description="Deletes a link category type."
)
@require_permission("MANAGE_LINK_CATEGORIES")
def delete_link_category_type(
    code: str = Path(..., description="The link category type code"),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> None:
    """Delete a link category type."""
    logger.info(f"Deleting link category type: {code}")

    try:
        db_category_type = link_crud.delete_link_category_type(db, code=code)
        if not db_category_type:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Link category type '{code}' not found"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error deleting link category type: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete link category type: {str(e)}"
        )


# --- Link Category Endpoints ---

@router.get(
    "/categories",
    response_model=List[LinkCategoryOut],
    summary="Get all link categories",
    description="Retrieves a list of all link categories with optional type filter."
)
def read_link_categories(
    db: Session = Depends(deps.get_db),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=200, description="Maximum number of items to return"),
    type_code: Optional[str] = Query(None, description="Filter by link category type code")
) -> Any:
    """Get all link categories."""
    logger.info(f"Fetching link categories with skip={skip}, limit={limit}, type_code={type_code}")

    try:
        categories = link_crud.get_link_categories(db, skip=skip, limit=limit, type_code=type_code)
        return categories
    except Exception as e:
        logger.exception(f"Error fetching link categories: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch link categories: {str(e)}"
        )


@router.get(
    "/categories/{category_id}",
    response_model=LinkCategoryOut,
    summary="Get a specific link category",
    description="Retrieves a link category by its ID."
)
def read_link_category(
    category_id: int = Path(..., ge=1, description="The link category ID"),
    db: Session = Depends(deps.get_db)
) -> Any:
    """Get a specific link category by ID."""
    logger.info(f"Fetching link category: {category_id}")

    category = link_crud.get_link_category(db, category_id=category_id)
    if not category:
        logger.warning(f"Link category not found: {category_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Link category with ID {category_id} not found"
        )

    return category


@router.post(
    "/categories",
    response_model=LinkCategoryOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new link category",
    description="Creates a new link category with optional multilingual texts."
)
@require_permission("MANAGE_LINK_CATEGORIES")
def create_link_category(
    category: LinkCategoryCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    """Create a new link category."""
    logger.info(f"Creating link category: {category.code}")

    try:
        db_category = link_crud.create_link_category(db, category=category)
        return db_category
    except ValueError as e:
        logger.warning(f"Validation error creating link category: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception(f"Error creating link category: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create link category: {str(e)}"
        )


@router.put(
    "/categories/{category_id}",
    response_model=LinkCategoryOut,
    summary="Update a link category",
    description="Updates an existing link category."
)
@require_permission("MANAGE_LINK_CATEGORIES")
def update_link_category(
    category_id: int = Path(..., ge=1, description="The link category ID"),
    category: LinkCategoryUpdate = Body(...),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    """Update a link category."""
    logger.info(f"Updating link category: {category_id}")

    try:
        db_category = link_crud.update_link_category(db, category_id=category_id, category=category)
        if not db_category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Link category with ID {category_id} not found"
            )
        return db_category
    except ValueError as e:
        logger.warning(f"Validation error updating link category: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error updating link category: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update link category: {str(e)}"
        )


@router.delete(
    "/categories/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a link category",
    description="Deletes a link category."
)
@require_permission("MANAGE_LINK_CATEGORIES")
def delete_link_category(
    category_id: int = Path(..., ge=1, description="The link category ID"),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> None:
    """Delete a link category."""
    logger.info(f"Deleting link category: {category_id}")

    try:
        db_category = link_crud.delete_link_category(db, category_id=category_id)
        if not db_category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Link category with ID {category_id} not found"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error deleting link category: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete link category: {str(e)}"
        )


@router.post(
    "/categories/{category_id}/texts",
    response_model=LinkCategoryTextOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add or update text for a link category",
    description="Adds or updates multilingual text for a link category."
)
@require_permission("MANAGE_LINK_CATEGORIES")
def create_link_category_text(
    category_id: int = Path(..., ge=1, description="The link category ID"),
    text: LinkCategoryTextCreate = Body(...),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    """Add or update text for a link category."""
    logger.info(f"Creating/updating text for link category {category_id}, language {text.language_id}")

    try:
        # Check if category exists
        category = link_crud.get_link_category(db, category_id=category_id)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Link category with ID {category_id} not found"
            )

        db_text = link_crud.create_link_category_text(db, category_id=category_id, text=text)
        return db_text
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error creating link category text: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create link category text: {str(e)}"
        )


# --- Portfolio Link Endpoints ---

@router.get(
    "/portfolios/{portfolio_id}/links",
    response_model=List[PortfolioLinkOut],
    summary="Get all links for a portfolio",
    description="Retrieves all links associated with a portfolio."
)
def read_portfolio_links(
    portfolio_id: int = Path(..., ge=1, description="The portfolio ID"),
    db: Session = Depends(deps.get_db),
    is_active: Optional[bool] = Query(None, description="Filter by active status")
) -> Any:
    """Get all links for a portfolio."""
    logger.info(f"Fetching links for portfolio {portfolio_id}, is_active={is_active}")

    try:
        links = link_crud.get_portfolio_links(db, portfolio_id=portfolio_id, is_active=is_active)
        return links
    except Exception as e:
        logger.exception(f"Error fetching portfolio links: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch portfolio links: {str(e)}"
        )


@router.get(
    "/portfolios/links/{link_id}",
    response_model=PortfolioLinkOut,
    summary="Get a specific portfolio link",
    description="Retrieves a portfolio link by its ID."
)
def read_portfolio_link(
    link_id: int = Path(..., ge=1, description="The portfolio link ID"),
    db: Session = Depends(deps.get_db)
) -> Any:
    """Get a specific portfolio link by ID."""
    logger.info(f"Fetching portfolio link: {link_id}")

    link = link_crud.get_portfolio_link(db, link_id=link_id)
    if not link:
        logger.warning(f"Portfolio link not found: {link_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio link with ID {link_id} not found"
        )

    return link


@router.post(
    "/portfolios/links",
    response_model=PortfolioLinkOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new portfolio link",
    description="Creates a new link for a portfolio with optional multilingual texts."
)
@require_permission("MANAGE_PORTFOLIOS")
def create_portfolio_link(
    link: PortfolioLinkCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    """Create a new portfolio link."""
    logger.info(f"Creating portfolio link for portfolio {link.portfolio_id}")

    try:
        db_link = link_crud.create_portfolio_link(db, link=link)
        return db_link
    except ValueError as e:
        logger.warning(f"Validation error creating portfolio link: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception(f"Error creating portfolio link: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create portfolio link: {str(e)}"
        )


@router.put(
    "/portfolios/links/{link_id}",
    response_model=PortfolioLinkOut,
    summary="Update a portfolio link",
    description="Updates an existing portfolio link."
)
@require_permission("MANAGE_PORTFOLIOS")
def update_portfolio_link(
    link_id: int = Path(..., ge=1, description="The portfolio link ID"),
    link: PortfolioLinkUpdate = Body(...),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    """Update a portfolio link."""
    logger.info(f"Updating portfolio link: {link_id}")

    try:
        db_link = link_crud.update_portfolio_link(db, link_id=link_id, link=link)
        if not db_link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Portfolio link with ID {link_id} not found"
            )
        return db_link
    except ValueError as e:
        logger.warning(f"Validation error updating portfolio link: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error updating portfolio link: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update portfolio link: {str(e)}"
        )


@router.post(
    "/portfolios/links/{link_id}/image",
    response_model=PortfolioLinkOut,
    summary="Upload or replace a portfolio link image",
    description="Uploads an image for a portfolio link, replacing the existing one if present."
)
@require_permission("MANAGE_PORTFOLIOS")
async def upload_portfolio_link_image(
    link_id: int = Path(..., ge=1, description="The portfolio link ID"),
    file: UploadFile = File(..., description="Image file to upload"),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    """Upload or replace the image for a portfolio link."""
    logger.info(f"User {current_user.username} uploading image for portfolio link {link_id}")

    link = link_crud.get_portfolio_link(db, link_id=link_id)
    if not link:
        logger.warning(f"Portfolio link not found for image upload: {link_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio link with ID {link_id} not found"
        )

    if not file.content_type or not file.content_type.startswith("image/"):
        logger.warning(f"Invalid file type for portfolio link image upload: {file.content_type}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image files are allowed"
        )

    try:
        upload_dir = PathLib(settings.UPLOADS_DIR) / "portfolio_links" / str(link_id)
        saved_path = await file_utils.save_upload_file(file, directory=upload_dir)
        file_url = file_utils.get_file_url(saved_path)

        old_image_path = link.image_path
        updated_link = link_crud.set_portfolio_link_image(db, link_id=link_id, image_path=file_url)

        if old_image_path and old_image_path != file_url:
            try:
                if old_image_path.startswith("/uploads/"):
                    absolute_old_path = PathLib(settings.UPLOADS_DIR).parent / old_image_path.lstrip("/")
                else:
                    absolute_old_path = PathLib(old_image_path)
                file_utils.delete_file(str(absolute_old_path))
                logger.debug(f"Deleted old portfolio link image: {absolute_old_path}")
            except Exception as delete_error:
                logger.warning(f"Unable to delete old portfolio link image {old_image_path}: {delete_error}")

        logger.info(f"Successfully uploaded image for portfolio link {link_id}")
        return updated_link
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error uploading portfolio link image: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload portfolio link image: {str(e)}"
        )


@router.delete(
    "/portfolios/links/{link_id}/image",
    response_model=PortfolioLinkOut,
    summary="Remove a portfolio link image",
    description="Removes the image associated with a portfolio link."
)
@require_permission("MANAGE_PORTFOLIOS")
def delete_portfolio_link_image(
    link_id: int = Path(..., ge=1, description="The portfolio link ID"),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    """Remove the image attached to a portfolio link."""
    logger.info(f"User {current_user.username} removing image for portfolio link {link_id}")

    link = link_crud.get_portfolio_link(db, link_id=link_id)
    if not link:
        logger.warning(f"Portfolio link not found when removing image: {link_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio link with ID {link_id} not found"
        )

    old_image_path = link.image_path
    if not old_image_path:
        logger.info(f"No image to remove for portfolio link {link_id}")
        return link

    try:
        updated_link = link_crud.set_portfolio_link_image(db, link_id=link_id, image_path=None)

        try:
            if old_image_path.startswith("/uploads/"):
                absolute_old_path = PathLib(settings.UPLOADS_DIR).parent / old_image_path.lstrip("/")
            else:
                absolute_old_path = PathLib(old_image_path)
            file_utils.delete_file(str(absolute_old_path))
            logger.debug(f"Deleted portfolio link image file: {absolute_old_path}")
        except Exception as delete_error:
            logger.warning(f"Unable to delete portfolio link image {old_image_path}: {delete_error}")

        logger.info(f"Removed image for portfolio link {link_id}")
        return updated_link
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error removing portfolio link image: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove portfolio link image: {str(e)}"
        )


@router.delete(
    "/portfolios/links/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a portfolio link",
    description="Deletes a portfolio link."
)
@require_permission("MANAGE_PORTFOLIOS")
def delete_portfolio_link(
    link_id: int = Path(..., ge=1, description="The portfolio link ID"),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> None:
    """Delete a portfolio link."""
    logger.info(f"Deleting portfolio link: {link_id}")

    try:
        db_link = link_crud.delete_portfolio_link(db, link_id=link_id)
        if not db_link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Portfolio link with ID {link_id} not found"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error deleting portfolio link: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete portfolio link: {str(e)}"
        )


@router.put(
    "/portfolios/{portfolio_id}/links/order",
    status_code=status.HTTP_200_OK,
    summary="Update portfolio links order",
    description="Updates the display order of multiple portfolio links."
)
@require_permission("MANAGE_PORTFOLIOS")
def update_portfolio_links_order(
    portfolio_id: int = Path(..., ge=1, description="The portfolio ID"),
    order_data: PortfolioLinkOrderUpdate = Body(...),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    """Update the order of portfolio links."""
    logger.info(f"Updating link order for portfolio {portfolio_id}")

    try:
        result = link_crud.update_portfolio_links_order(
            db,
            portfolio_id=portfolio_id,
            link_orders=order_data.link_orders
        )
        return {"message": "Link order updated successfully"}
    except Exception as e:
        logger.exception(f"Error updating portfolio links order: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update portfolio links order: {str(e)}"
        )


@router.post(
    "/portfolios/links/{link_id}/texts",
    response_model=PortfolioLinkTextOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add or update text for a portfolio link",
    description="Adds or updates multilingual text for a portfolio link."
)
@require_permission("MANAGE_PORTFOLIOS")
def create_portfolio_link_text(
    link_id: int = Path(..., ge=1, description="The portfolio link ID"),
    text: PortfolioLinkTextCreate = Body(...),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    """Add or update text for a portfolio link."""
    logger.info(f"Creating/updating text for portfolio link {link_id}, language {text.language_id}")

    try:
        # Check if link exists
        link = link_crud.get_portfolio_link(db, link_id=link_id)
        if not link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Portfolio link with ID {link_id} not found"
            )

        db_text = link_crud.create_portfolio_link_text(db, link_id=link_id, text=text)
        return db_text
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error creating portfolio link text: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create portfolio link text: {str(e)}"
        )
