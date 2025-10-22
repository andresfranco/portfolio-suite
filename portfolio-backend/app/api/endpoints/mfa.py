"""
Multi-Factor Authentication (MFA) API Endpoints

Provides endpoints for:
- MFA enrollment (setup)
- MFA verification
- MFA disabling
- Backup code regeneration
- MFA status checking
"""

import base64
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.mfa import mfa_manager
from app.core.security import verify_password
from app.models.user import User
from app.schemas.mfa import (
    MFAEnrollmentRequest,
    MFAEnrollmentResponse,
    MFAVerifyEnrollmentRequest,
    MFAVerifyEnrollmentResponse,
    MFADisableRequest,
    MFADisableResponse,
    MFARegenerateBackupCodesRequest,
    MFARegenerateBackupCodesResponse,
    MFAStatusResponse,
)
from app.api.deps import get_current_user
from app.core.audit_logger import audit_logger
from app.core.logging import setup_logger

logger = setup_logger("app.api.endpoints.mfa")

router = APIRouter()


@router.post("/enroll", response_model=MFAEnrollmentResponse, status_code=status.HTTP_200_OK)
async def start_mfa_enrollment(
    request: Request,
    enrollment_request: MFAEnrollmentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Start MFA enrollment process.
    
    Steps:
    1. Verify user's password
    2. Generate TOTP secret
    3. Generate QR code
    4. Generate backup codes
    5. Return enrollment data (not yet saved to DB)
    
    User must call /verify-enrollment with a valid code to complete setup.
    """
    # Verify password
    if not verify_password(enrollment_request.password, current_user.hashed_password):
        audit_logger.log_security_event(
            "MFA_ENROLLMENT_FAILED",
            user=current_user,
            details={"reason": "invalid_password"},
            ip_address=request.client.host if request.client else "unknown"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )
    
    # Check if MFA already enabled
    if current_user.mfa_enabled:
        logger.warning(f"User {current_user.username} attempted to re-enroll MFA")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is already enabled. Disable it first to re-enroll."
        )
    
    try:
        # Generate TOTP secret
        secret = mfa_manager.generate_secret()
        
        # Generate QR code
        qr_code_bytes = mfa_manager.generate_qr_code(secret, current_user.username)
        qr_code_data_url = f"data:image/png;base64,{base64.b64encode(qr_code_bytes).decode()}"
        
        # Generate backup codes
        backup_codes_pairs = mfa_manager.generate_backup_codes()
        plain_codes = [code for code, _ in backup_codes_pairs]
        hashed_codes = [hashed for _, hashed in backup_codes_pairs]
        
        # Store secret and hashed codes temporarily in session or cache
        # For simplicity, we'll store in user record but mark MFA as not enabled yet
        current_user.mfa_secret = secret
        current_user.mfa_backup_codes = hashed_codes
        current_user.mfa_enabled = False  # Not enabled until verified
        db.commit()
        
        audit_logger.log_security_event(
            "MFA_ENROLLMENT_STARTED",
            user=current_user,
            details={"secret_generated": True, "backup_codes_count": len(plain_codes)},
            ip_address=request.client.host if request.client else "unknown"
        )
        
        logger.info(f"MFA enrollment started for user: {current_user.username}")
        
        return MFAEnrollmentResponse(
            secret=secret,
            qr_code_url=qr_code_data_url,
            backup_codes=plain_codes
        )
        
    except Exception as e:
        logger.error(f"MFA enrollment failed: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start MFA enrollment"
        )


@router.post("/verify-enrollment", response_model=MFAVerifyEnrollmentResponse, status_code=status.HTTP_200_OK)
async def verify_mfa_enrollment(
    request: Request,
    verify_request: MFAVerifyEnrollmentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Complete MFA enrollment by verifying a TOTP code.
    
    User must scan QR code and enter the 6-digit code from their authenticator app.
    """
    # Check if secret exists (enrollment started)
    if not current_user.mfa_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA enrollment not started. Call /enroll first."
        )
    
    # Verify TOTP code
    is_valid = mfa_manager.verify_totp_code(
        current_user.mfa_secret,
        verify_request.code
    )
    
    if not is_valid:
        audit_logger.log_security_event(
            "MFA_ENROLLMENT_VERIFICATION_FAILED",
            user=current_user,
            details={"reason": "invalid_code"},
            ip_address=request.client.host if request.client else "unknown"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code"
        )
    
    try:
        # Enable MFA
        current_user.mfa_enabled = True
        current_user.mfa_enrolled_at = datetime.now(timezone.utc)
        db.commit()
        
        audit_logger.log_security_event(
            "MFA_ENABLED",
            user=current_user,
            details={"enrollment_completed": True},
            ip_address=request.client.host if request.client else "unknown"
        )
        
        logger.info(f"MFA enabled successfully for user: {current_user.username}")
        
        return MFAVerifyEnrollmentResponse(
            success=True,
            message="MFA enabled successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to complete MFA enrollment: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete MFA enrollment"
        )


@router.post("/disable", response_model=MFADisableResponse, status_code=status.HTTP_200_OK)
async def disable_mfa(
    request: Request,
    disable_request: MFADisableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Disable MFA for the current user.
    
    Requires:
    - Current password
    - Optional: Current TOTP code or backup code
    """
    # Verify password
    if not verify_password(disable_request.password, current_user.hashed_password):
        audit_logger.log_security_event(
            "MFA_DISABLE_FAILED",
            user=current_user,
            details={"reason": "invalid_password"},
            ip_address=request.client.host if request.client else "unknown"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )
    
    # Check if MFA is enabled
    if not current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled"
        )
    
    # If code provided, verify it
    if disable_request.code:
        is_valid = mfa_manager.verify_totp_code(
            current_user.mfa_secret,
            disable_request.code
        )
        
        if not is_valid:
            audit_logger.log_security_event(
                "MFA_DISABLE_FAILED",
                user=current_user,
                details={"reason": "invalid_mfa_code"},
                ip_address=request.client.host if request.client else "unknown"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid MFA code"
            )
    
    try:
        # Disable MFA and clear secrets
        current_user.mfa_enabled = False
        current_user.mfa_secret = None
        current_user.mfa_backup_codes = None
        current_user.mfa_enrolled_at = None
        db.commit()
        
        audit_logger.log_security_event(
            "MFA_DISABLED",
            user=current_user,
            details={},
            ip_address=request.client.host if request.client else "unknown"
        )
        
        logger.info(f"MFA disabled for user: {current_user.username}")
        
        return MFADisableResponse(
            success=True,
            message="MFA disabled successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to disable MFA: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to disable MFA"
        )


@router.post("/regenerate-backup-codes", response_model=MFARegenerateBackupCodesResponse, status_code=status.HTTP_200_OK)
async def regenerate_backup_codes(
    request: Request,
    regen_request: MFARegenerateBackupCodesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Regenerate backup codes.
    
    Requires:
    - Current password
    - Current TOTP code
    
    All old backup codes will be invalidated.
    """
    # Verify password
    if not verify_password(regen_request.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )
    
    # Check if MFA is enabled
    if not current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled"
        )
    
    # Verify TOTP code
    is_valid = mfa_manager.verify_totp_code(
        current_user.mfa_secret,
        regen_request.code
    )
    
    if not is_valid:
        audit_logger.log_security_event(
            "MFA_BACKUP_REGEN_FAILED",
            user=current_user,
            details={"reason": "invalid_mfa_code"},
            ip_address=request.client.host if request.client else "unknown"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid MFA code"
        )
    
    try:
        # Generate new backup codes
        backup_codes_pairs = mfa_manager.generate_backup_codes()
        plain_codes = [code for code, _ in backup_codes_pairs]
        hashed_codes = [hashed for _, hashed in backup_codes_pairs]
        
        # Update user
        current_user.mfa_backup_codes = hashed_codes
        db.commit()
        
        generated_at = datetime.now(timezone.utc)
        
        audit_logger.log_security_event(
            "MFA_BACKUP_CODES_REGENERATED",
            user=current_user,
            details={"count": len(plain_codes)},
            ip_address=request.client.host if request.client else "unknown"
        )
        
        logger.info(f"Backup codes regenerated for user: {current_user.username}")
        
        return MFARegenerateBackupCodesResponse(
            backup_codes=plain_codes,
            generated_at=generated_at
        )
        
    except Exception as e:
        logger.error(f"Failed to regenerate backup codes: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to regenerate backup codes"
        )


@router.get("/status", response_model=MFAStatusResponse, status_code=status.HTTP_200_OK)
async def get_mfa_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get MFA status for the current user.
    """
    backup_codes_remaining = None
    if current_user.mfa_enabled and current_user.mfa_backup_codes:
        backup_codes_remaining = len(current_user.mfa_backup_codes)
    
    return MFAStatusResponse(
        mfa_enabled=current_user.mfa_enabled,
        backup_codes_remaining=backup_codes_remaining,
        enrolled_at=current_user.mfa_enrolled_at
    )

