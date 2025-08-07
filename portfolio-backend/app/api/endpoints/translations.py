from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Any, List, Optional
from app.crud import translation as translation_crud
from app.api import deps
from app.schemas.translation import TranslationOut as Translation, PaginatedTranslationResponse, TranslationCreate, TranslationUpdate
from app.models.translation import Translation as TranslationModel
from app.models.language import Language
from app.core.logging import setup_logger

# Set up logger using centralized logging
logger = setup_logger("app.api.endpoints.translations")

# Define router
router = APIRouter()

@router.get("/", response_model=List[str])
def list_translation_identifiers(
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Get list of all translation identifiers.
    """
    logger.debug("Fetching all translation identifiers")
    translations = translation_crud.get_translations(db)
    return [trans.identifier for trans in translations]


@router.get("/full", response_model=PaginatedTranslationResponse)
def read_translations(
    page: int = Query(1, gt=0),
    pageSize: int = Query(10, gt=0, le=100),
    identifier: Optional[str] = None,
    text: Optional[str] = None,
    language_id: Optional[List[str]] = Query(None),
    filterField: Optional[List[str]] = Query(None),
    filterValue: Optional[List[str]] = Query(None),
    filterOperator: Optional[List[str]] = Query(None),
    sortField: Optional[str] = None,
    sortOrder: Optional[str] = Query(None, pattern="^(asc|desc)$"),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Get paginated list of translations with full details.
    Supports both direct parameters (identifier, text, language_id) and 
    filter parameters (filterField, filterValue, filterOperator).
    """
    logger.debug(f"Fetching translations with page={page}, pageSize={pageSize}, identifier={identifier}, text={text}, language_id={language_id}, filterField={filterField}, filterValue={filterValue}, sort={sortField} {sortOrder}")
    
    # Process filter parameters if they exist
    identifier_filter = identifier
    text_filter = text
    language_filter_values = language_id
    
    # If filter parameters are provided, use them instead of direct parameters
    if filterField and filterValue:
        for i, field in enumerate(filterField):
            if i < len(filterValue):
                if field == 'identifier' and not identifier_filter:
                    identifier_filter = filterValue[i]
                elif field == 'text' and not text_filter:
                    text_filter = filterValue[i]
                elif field == 'language_id':
                    if not language_filter_values:
                        language_filter_values = []
                    language_filter_values.append(filterValue[i])
    
    try:
        translations, total = translation_crud.get_translations_paginated(
            db=db,
            page=page,
            page_size=pageSize,
            identifier_filter=identifier_filter,
            text_filter=text_filter,
            language_filter_values=language_filter_values,
            sort_field=sortField,
            sort_order=sortOrder
        )
        
        logger.debug(f"Successfully fetched {len(translations)} translations with total={total}")
        
        return {
            "items": translations,
            "total": total,
            "page": page,
            "pageSize": pageSize
        }
    except Exception as e:
        logger.error(f"Error getting translations: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting translations: {str(e)}"
        )


@router.post("/", response_model=Translation)
def create_translation(
    *,
    db: Session = Depends(deps.get_db),
    translation_in: TranslationCreate,
) -> Any:
    """
    Create new translation.
    """
    logger.debug(f"Creating translation with identifier: {translation_in.identifier}")
    
    # The uniqueness check is now handled in the CRUD function based on identifier + language combination
    # No need to check only by identifier here
    
    try:
        new_translation = translation_crud.create_translation(db, translation=translation_in)
        db.commit()
        db.refresh(new_translation)
        logger.debug(f"Translation created successfully with ID: {new_translation.id}")
        return new_translation
    except ValueError as e:
        logger.error(f"Error creating translation: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )


@router.get("/{translation_id}", response_model=Translation)
def read_translation(
    *,
    db: Session = Depends(deps.get_db),
    translation_id: int,
) -> Any:
    """
    Get translation by ID.
    """
    logger.debug(f"Fetching translation with ID: {translation_id}")
    
    translation_obj = translation_crud.get_translation(db, translation_id=translation_id)
    if not translation_obj:
        raise HTTPException(
            status_code=404,
            detail="Translation not found",
        )
    return translation_obj


@router.put("/{translation_id}", response_model=Translation)
def update_translation(
    *,
    db: Session = Depends(deps.get_db),
    translation_id: int,
    translation_in: TranslationUpdate,
) -> Any:
    """
    Update a translation.
    """
    logger.debug(f"Updating translation with ID: {translation_id}")
    
    translation_obj = translation_crud.get_translation(db, translation_id=translation_id)
    if not translation_obj:
        raise HTTPException(
            status_code=404,
            detail="Translation not found",
        )
    
    # The uniqueness check is now handled in the CRUD function based on identifier + language combination
    # No need to check only by identifier here
    
    try:
        updated_translation = translation_crud.update_translation(db, translation_id=translation_id, translation=translation_in)
        db.commit()
        db.refresh(updated_translation)
        logger.debug(f"Translation updated successfully: {translation_id}")
        return updated_translation
    except ValueError as e:
        logger.error(f"Error updating translation: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )


@router.delete("/{translation_id}", response_model=Translation)
def delete_translation(
    *,
    db: Session = Depends(deps.get_db),
    translation_id: int,
) -> Any:
    """
    Delete a translation.
    """
    logger.debug(f"Deleting translation with ID: {translation_id}")
    
    translation_obj = translation_crud.get_translation(db, translation_id=translation_id)
    if not translation_obj:
        raise HTTPException(
            status_code=404,
            detail="Translation not found",
        )
    
    deleted_translation = translation_crud.delete_translation(db, translation_id=translation_id)
    db.commit()
    logger.debug(f"Translation deleted successfully: {translation_id}")
    return deleted_translation


@router.get("/check-unique", response_model=dict)
def check_translation_unique(
    identifier: str,
    language_id: int,
    exclude_id: Optional[int] = None,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Check if a translation with the given identifier and language_id already exists.
    """
    logger.debug(f"Checking uniqueness for identifier={identifier}, language_id={language_id}, exclude_id={exclude_id}")
    
    try:
        query = db.query(TranslationModel).join(
            TranslationModel.language
        ).filter(
            TranslationModel.identifier == identifier,
            Language.id == language_id
        )
        
        if exclude_id:
            query = query.filter(TranslationModel.id != exclude_id)
        
        exists = query.first() is not None
        
        logger.debug(f"Uniqueness check result: exists={exists}")
        return {"exists": exists}
    except Exception as e:
        logger.error(f"Error checking uniqueness: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking uniqueness: {str(e)}"
        )
