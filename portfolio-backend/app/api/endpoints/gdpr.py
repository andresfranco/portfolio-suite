"""
GDPR Compliance API Endpoints

Provides REST API endpoints for GDPR compliance features:
- Data export
- Data deletion (right to be forgotten)
- Consent management
- Data retention status

Author: Security Team
Date: October 23, 2025
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.services.gdpr_service import GDPRService

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic Schemas
class DataExportResponse(BaseModel):
    """Response for data export request"""
    export_url: Optional[str] = Field(None, description="URL to download export file")
    export_data: Optional[dict] = Field(None, description="Export data (if inline)")
    message: str = Field(..., description="Status message")
    
    class Config:
        json_schema_extra = {
            "example": {
                "export_url": "https://api.example.com/exports/user_12345.json",
                "message": "Your data export is ready"
            }
        }


class DataDeletionRequest(BaseModel):
    """Request body for data deletion"""
    confirm: bool = Field(..., description="Confirmation that user wants to delete data")
    reason: Optional[str] = Field(None, description="Reason for deletion (optional)")
    password: str = Field(..., description="User password for verification")
    
    class Config:
        json_schema_extra = {
            "example": {
                "confirm": True,
                "reason": "No longer using the service",
                "password": "user_password"
            }
        }


class DataDeletionResponse(BaseModel):
    """Response for data deletion request"""
    status: str = Field(..., description="Deletion status")
    user_id: int = Field(..., description="User ID")
    deletion_date: str = Field(..., description="Deletion timestamp")
    grace_period_until: str = Field(..., description="Grace period end date")
    message: str = Field(..., description="Status message")
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "pending_deletion",
                "user_id": 123,
                "deletion_date": "2025-10-23T10:30:00Z",
                "grace_period_until": "2025-11-22T10:30:00Z",
                "message": "Your account has been marked for deletion. You have 30 days to restore it."
            }
        }


class ConsentUpdate(BaseModel):
    """Request body for consent update"""
    consent_type: str = Field(..., description="Type of consent")
    granted: bool = Field(..., description="Whether consent is granted")
    
    class Config:
        json_schema_extra = {
            "example": {
                "consent_type": "marketing_emails",
                "granted": False
            }
        }


class DataRetentionResponse(BaseModel):
    """Response for data retention status"""
    user_id: int
    account_status: str
    created_at: Optional[str]
    last_login: Optional[str]
    data_retention: dict
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": 123,
                "account_status": "active",
                "created_at": "2024-01-15T10:00:00Z",
                "last_login": "2025-10-20T14:30:00Z",
                "data_retention": {
                    "audit_logs": "90 days (recent), permanent (compliance)",
                    "account_data": "Until deletion requested",
                    "backups": "30 days (encrypted)"
                }
            }
        }


# API Endpoints

@router.get(
    "/export",
    response_model=DataExportResponse,
    summary="Export Personal Data (GDPR Article 15)",
    description="Export all personal data in portable JSON format (Right to Access)"
)
async def export_personal_data(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Export all personal data for the authenticated user.
    
    **GDPR Article 15 - Right to Access**
    
    Returns all data associated with the user account in a portable JSON format
    that can be transferred to another service provider.
    
    **Includes:**
    - Personal information (name, email, phone, etc.)
    - Account security details
    - Portfolios and projects
    - Audit logs (last 90 days)
    
    **Response Codes:**
    - 200: Export successful
    - 401: Unauthorized
    - 500: Export failed
    """
    try:
        gdpr_service = GDPRService(db)
        export_data = gdpr_service.export_user_data(current_user.id)
        
        logger.info(f"User {current_user.id} exported their data (GDPR Article 15)")
        
        return DataExportResponse(
            export_data=export_data,
            message="Your data has been exported successfully. This data is in a portable format that can be transferred to another service."
        )
    
    except Exception as e:
        logger.error(f"Data export failed for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export data. Please contact support if the issue persists."
        )


@router.post(
    "/delete",
    response_model=DataDeletionResponse,
    summary="Delete Personal Data (GDPR Article 17)",
    description="Request deletion of all personal data (Right to be Forgotten)"
)
async def delete_personal_data(
    request: DataDeletionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Request deletion of all personal data (Right to be Forgotten).
    
    **GDPR Article 17 - Right to Erasure**
    
    This will:
    1. Mark your account for deletion
    2. Anonymize your personal information
    3. Remove sensitive data
    4. Give you a 30-day grace period to restore your account
    5. Permanently delete your data after 30 days
    
    **What is deleted:**
    - Personal information (name, email, phone, etc.)
    - Authentication data (except password for audit)
    - Associated content (portfolios, projects)
    
    **What is kept (required by law):**
    - Anonymized audit logs (compliance requirement)
    - Transaction records (if applicable)
    
    **Grace Period:**
    You have 30 days to restore your account. After that, deletion is permanent.
    
    **Response Codes:**
    - 200: Deletion request accepted
    - 400: Invalid request (confirmation missing or password incorrect)
    - 401: Unauthorized
    - 500: Deletion failed
    """
    if not request.confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must confirm that you want to delete your data by setting 'confirm' to true."
        )
    
    # Verify password
    from app.core.security import verify_password
    if not verify_password(request.password, current_user.hashed_password):
        logger.warning(f"User {current_user.id} failed password verification for data deletion")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password. Please verify your password to delete your account."
        )
    
    try:
        gdpr_service = GDPRService(db)
        deletion_summary = gdpr_service.delete_user_data(
            user_id=current_user.id,
            reason=request.reason,
            requested_by_user=True
        )
        
        logger.warning(f"User {current_user.id} requested account deletion (GDPR Article 17)")
        
        # Send confirmation email (in background)
        # background_tasks.add_task(send_deletion_confirmation_email, current_user.email)
        
        return DataDeletionResponse(
            status="pending_deletion",
            user_id=deletion_summary["user_id"],
            deletion_date=deletion_summary["deletion_date"],
            grace_period_until=deletion_summary["grace_period_until"],
            message=(
                "Your account has been marked for deletion. "
                "You have 30 days to restore your account if you change your mind. "
                "After 30 days, your data will be permanently deleted."
            )
        )
    
    except Exception as e:
        logger.error(f"Data deletion failed for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete data. Please contact support if the issue persists."
        )


@router.post(
    "/restore",
    summary="Restore Deleted Account",
    description="Restore account within 30-day grace period"
)
async def restore_deleted_account(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Restore a deleted account within the 30-day grace period.
    
    **Note:** Personal information that was anonymized during deletion
    cannot be restored. You will need to update your profile information.
    
    **Response Codes:**
    - 200: Account restored
    - 400: Grace period expired or account not deleted
    - 401: Unauthorized
    - 500: Restoration failed
    """
    try:
        gdpr_service = GDPRService(db)
        success = gdpr_service.restore_deleted_user(current_user.id)
        
        if success:
            logger.info(f"User {current_user.id} restored their deleted account")
            return {
                "status": "restored",
                "message": (
                    "Your account has been restored. "
                    "Please update your personal information in your profile settings."
                )
            }
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Account restoration failed for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to restore account. Please contact support."
        )


@router.get(
    "/retention-status",
    response_model=DataRetentionResponse,
    summary="Get Data Retention Status",
    description="Get information about data retention for your account"
)
async def get_retention_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get data retention information for your account.
    
    Shows:
    - Account status
    - Creation date
    - Last login
    - Data retention policies
    - Deletion status (if applicable)
    
    **Response Codes:**
    - 200: Status retrieved
    - 401: Unauthorized
    - 500: Failed to retrieve status
    """
    try:
        gdpr_service = GDPRService(db)
        retention_status = gdpr_service.get_data_retention_status(current_user.id)
        
        return retention_status
    
    except Exception as e:
        logger.error(f"Failed to get retention status for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve retention status."
        )


@router.get(
    "/consent",
    summary="Get Consent Status",
    description="Get your consent status for data processing activities"
)
async def get_consent_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get your consent status for various data processing activities.
    
    Returns consent status for:
    - Marketing emails
    - Analytics
    - Third-party sharing
    - Personalization
    
    **Response Codes:**
    - 200: Consent status retrieved
    - 401: Unauthorized
    """
    try:
        gdpr_service = GDPRService(db)
        consent_status = gdpr_service.get_consent_status(current_user.id)
        
        return {
            "user_id": current_user.id,
            "consents": consent_status
        }
    
    except Exception as e:
        logger.error(f"Failed to get consent status for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve consent status."
        )


@router.post(
    "/consent",
    summary="Update Consent",
    description="Update your consent for specific data processing activities"
)
async def update_consent(
    consent: ConsentUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update your consent for specific data processing activities.
    
    **GDPR Article 7 - Consent**
    
    You can grant or revoke consent for:
    - marketing_emails: Receive promotional emails
    - analytics: Allow usage analytics
    - third_party_sharing: Share data with partners
    - personalization: Personalized recommendations
    
    **Response Codes:**
    - 200: Consent updated
    - 400: Invalid consent type
    - 401: Unauthorized
    """
    valid_consent_types = ["marketing_emails", "analytics", "third_party_sharing", "personalization"]
    
    if consent.consent_type not in valid_consent_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid consent type. Must be one of: {', '.join(valid_consent_types)}"
        )
    
    try:
        gdpr_service = GDPRService(db)
        success = gdpr_service.update_consent(
            user_id=current_user.id,
            consent_type=consent.consent_type,
            granted=consent.granted
        )
        
        if success:
            logger.info(
                f"User {current_user.id} updated consent: "
                f"{consent.consent_type} = {consent.granted}"
            )
            return {
                "status": "updated",
                "consent_type": consent.consent_type,
                "granted": consent.granted,
                "message": f"Your consent for '{consent.consent_type}' has been updated."
            }
    
    except Exception as e:
        logger.error(f"Failed to update consent for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update consent."
        )


# Admin-only endpoint for data cleanup
@router.post(
    "/admin/cleanup",
    summary="Run Data Cleanup (Admin)",
    description="Run scheduled data cleanup tasks (admin only)"
)
async def run_data_cleanup(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Run scheduled data cleanup tasks.
    
    **Admin Only**
    
    Cleans up:
    - Expired password reset tokens
    - Expired email verification tokens
    - Old audit logs (archives or deletes)
    - Users past deletion grace period
    
    **Response Codes:**
    - 200: Cleanup completed
    - 403: Forbidden (not admin)
    - 500: Cleanup failed
    """
    # Check if user is admin
    if not current_user.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is restricted to administrators."
        )
    
    try:
        from app.services.gdpr_service import cleanup_expired_data
        
        cleanup_counts = cleanup_expired_data(db)
        
        logger.info(f"Admin {current_user.id} ran data cleanup: {cleanup_counts}")
        
        return {
            "status": "completed",
            "cleanup_counts": cleanup_counts,
            "message": "Data cleanup completed successfully."
        }
    
    except Exception as e:
        logger.error(f"Data cleanup failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Data cleanup failed. Check logs for details."
        )
