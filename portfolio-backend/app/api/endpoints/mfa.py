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
    MFAResetDeviceRequest,
    MFAResetDeviceResponse,
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
    1. Verify admin's password
    2. Generate TOTP secret for target user
    3. Generate QR code
    4. Generate backup codes
    5. Return enrollment data (not yet saved to DB)
    
    User must call /verify-enrollment with a valid code to complete setup.
    
    If user_id is provided, admin can enroll MFA for another user.
    """
    # Determine target user (default to current user, allow admin to specify another user)
    target_user = current_user
    if enrollment_request.user_id:
        # Admin enrolling for another user
        target_user = db.query(User).filter(User.id == enrollment_request.user_id).first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target user not found"
            )
    
    # Verify admin's password (current_user's password, not target user's)
    if not verify_password(enrollment_request.password, current_user.hashed_password):
        audit_logger.log_security_event(
            "MFA_ENROLLMENT_FAILED",
            user=current_user,
            details={"reason": "invalid_password", "target_user_id": target_user.id},
            ip_address=request.client.host if request.client else "unknown"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )
    
    # Check if MFA already enabled for target user
    if target_user.mfa_enabled:
        logger.warning(f"User {target_user.username} attempted to re-enroll MFA")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is already enabled. Disable it first to re-enroll."
        )
    
    try:
        # Generate TOTP secret
        secret = mfa_manager.generate_secret()
        
        # Generate QR code for target user
        qr_code_bytes = mfa_manager.generate_qr_code(secret, target_user.username)
        qr_code_data_url = f"data:image/png;base64,{base64.b64encode(qr_code_bytes).decode()}"
        
        # Generate backup codes
        backup_codes_pairs = mfa_manager.generate_backup_codes()
        plain_codes = [code for code, _ in backup_codes_pairs]
        hashed_codes = [hashed for _, hashed in backup_codes_pairs]
        
        # Store secret and hashed codes temporarily in target user record but mark MFA as not enabled yet
        target_user.mfa_secret = secret
        target_user.mfa_backup_codes = hashed_codes
        target_user.mfa_enabled = False  # Not enabled until verified
        db.commit()
        
        audit_logger.log_security_event(
            "MFA_ENROLLMENT_STARTED",
            user=current_user,
            details={
                "secret_generated": True, 
                "backup_codes_count": len(plain_codes),
                "target_user_id": target_user.id,
                "target_username": target_user.username
            },
            ip_address=request.client.host if request.client else "unknown"
        )
        
        logger.info(f"MFA enrollment started for user: {target_user.username} by admin: {current_user.username}")
        
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
    If user_id is provided, admin can verify enrollment for another user.
    """
    # Determine target user (default to current user, allow admin to specify another user)
    target_user = current_user
    if verify_request.user_id:
        # Admin verifying for another user
        target_user = db.query(User).filter(User.id == verify_request.user_id).first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target user not found"
            )
    
    # Check if secret exists (enrollment started)
    if not target_user.mfa_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA enrollment not started. Call /enroll first."
        )
    
    # Verify TOTP code for target user
    is_valid = mfa_manager.verify_totp_code(
        target_user.mfa_secret,
        verify_request.code
    )
    
    if not is_valid:
        audit_logger.log_security_event(
            "MFA_ENROLLMENT_VERIFICATION_FAILED",
            user=current_user,
            details={"reason": "invalid_code", "target_user_id": target_user.id},
            ip_address=request.client.host if request.client else "unknown"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code"
        )
    
    try:
        # Enable MFA for target user
        target_user.mfa_enabled = True
        target_user.mfa_enrolled_at = datetime.now(timezone.utc)
        db.commit()
        
        audit_logger.log_security_event(
            "MFA_ENABLED",
            user=current_user,
            details={
                "enrollment_completed": True,
                "target_user_id": target_user.id,
                "target_username": target_user.username
            },
            ip_address=request.client.host if request.client else "unknown"
        )
        
        logger.info(f"MFA enabled successfully for user: {target_user.username} by admin: {current_user.username}")
        
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
    Disable MFA for a user.
    
    Requires:
    - Admin password
    - Optional: Current TOTP code or backup code
    - Optional: user_id to disable for another user (admin only)
    """
    # Determine target user (default to current user, allow admin to specify another user)
    target_user = current_user
    if disable_request.user_id:
        # Admin disabling for another user
        target_user = db.query(User).filter(User.id == disable_request.user_id).first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target user not found"
            )
    
    # Verify admin's password (current_user's password, not target user's)
    if not verify_password(disable_request.password, current_user.hashed_password):
        audit_logger.log_security_event(
            "MFA_DISABLE_FAILED",
            user=current_user,
            details={"reason": "invalid_password", "target_user_id": target_user.id},
            ip_address=request.client.host if request.client else "unknown"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )
    
    # Check if MFA is enabled for target user
    if not target_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled"
        )
    
    # If code provided, verify it against target user's MFA
    if disable_request.code:
        is_valid = mfa_manager.verify_totp_code(
            target_user.mfa_secret,
            disable_request.code
        )
        
        if not is_valid:
            audit_logger.log_security_event(
                "MFA_DISABLE_FAILED",
                user=current_user,
                details={"reason": "invalid_mfa_code", "target_user_id": target_user.id},
                ip_address=request.client.host if request.client else "unknown"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid MFA code"
            )
    
    try:
        # Disable MFA and clear secrets for target user
        target_user.mfa_enabled = False
        target_user.mfa_secret = None
        target_user.mfa_backup_codes = None
        target_user.mfa_enrolled_at = None
        db.commit()
        
        audit_logger.log_security_event(
            "MFA_DISABLED",
            user=current_user,
            details={"target_user_id": target_user.id, "target_username": target_user.username},
            ip_address=request.client.host if request.client else "unknown"
        )
        
        logger.info(f"MFA disabled for user: {target_user.username} by admin: {current_user.username}")
        
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


@router.post("/reset-device", response_model=MFAResetDeviceResponse, status_code=status.HTTP_200_OK)
async def reset_mfa_device(
    request: Request,
    reset_request: MFAResetDeviceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reset MFA device for a user who lost their authenticator.
    
    Use case: User logged in with backup code and wants to set up new authenticator.
    
    Requires:
    - User must be authenticated (via backup code login or regular login)
    - User's password for confirmation
    - MFA must already be enabled
    
    This generates a new secret, QR code, and backup codes while keeping MFA enabled.
    Admin can reset MFA device for another user by providing user_id.
    """
    # Determine target user (default to current user, allow admin to specify another user)
    target_user = current_user
    if reset_request.user_id:
        # Admin resetting for another user
        target_user = db.query(User).filter(User.id == reset_request.user_id).first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target user not found"
            )
    
    # Verify admin's password (current_user's password, not target user's)
    if not verify_password(reset_request.password, current_user.hashed_password):
        audit_logger.log_security_event(
            "MFA_DEVICE_RESET_FAILED",
            user=current_user,
            details={"reason": "invalid_password", "target_user_id": target_user.id},
            ip_address=request.client.host if request.client else "unknown"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )
    
    # Verify MFA is enabled (this is for reset, not initial enrollment)
    if not target_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled. Use /enroll to set up MFA for the first time."
        )
    
    try:
        # Generate new TOTP secret
        secret = mfa_manager.generate_secret()
        
        # Generate QR code for target user
        qr_code_bytes = mfa_manager.generate_qr_code(secret, target_user.username)
        qr_code_data_url = f"data:image/png;base64,{base64.b64encode(qr_code_bytes).decode()}"
        
        # Generate new backup codes
        backup_codes_pairs = mfa_manager.generate_backup_codes()
        plain_codes = [code for code, _ in backup_codes_pairs]
        hashed_codes = [hashed for _, hashed in backup_codes_pairs]
        
        # Update target user's MFA credentials (MFA stays enabled)
        target_user.mfa_secret = secret
        target_user.mfa_backup_codes = hashed_codes
        # mfa_enabled remains True
        db.commit()
        
        audit_logger.log_security_event(
            "MFA_DEVICE_RESET",
            user=current_user,
            details={
                "target_user_id": target_user.id,
                "target_username": target_user.username,
                "reason": "device_lost",
                "backup_codes_count": len(plain_codes)
            },
            ip_address=request.client.host if request.client else "unknown"
        )
        
        logger.info(f"MFA device reset for user: {target_user.username} by: {current_user.username}")
        
        return MFAResetDeviceResponse(
            secret=secret,
            qr_code_url=qr_code_data_url,
            backup_codes=plain_codes,
            message="MFA device reset successfully. Scan the QR code with your new authenticator app and save the backup codes."
        )
        
    except Exception as e:
        logger.error(f"Failed to reset MFA device: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset MFA device"
        )


@router.post("/regenerate-backup-codes", response_model=MFARegenerateBackupCodesResponse, status_code=status.HTTP_200_OK)
async def regenerate_backup_codes(
    request: Request,
    regen_request: MFARegenerateBackupCodesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Regenerate backup codes for a user.
    
    Requires:
    - Admin password
    - Admin TOTP code (only if admin has MFA enabled)
    - Optional: user_id to regenerate codes for another user (admin only)
    
    All old backup codes will be invalidated.
    """
    # Determine target user (default to current user, allow admin to specify another user)
    target_user = current_user
    if regen_request.user_id:
        # Admin regenerating for another user
        target_user = db.query(User).filter(User.id == regen_request.user_id).first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target user not found"
            )
    
    # Verify admin's password
    if not verify_password(regen_request.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )
    
    # Check if target user has MFA enabled
    if not target_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"MFA is not enabled for user '{target_user.username}'. Cannot regenerate backup codes."
        )
    
    # If admin has MFA enabled, require admin's MFA code for verification
    if current_user.mfa_enabled:
        if not regen_request.code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your account has MFA enabled. Please provide your MFA code to proceed."
            )
        
        # Verify admin's TOTP code
        is_valid = mfa_manager.verify_totp_code(
            current_user.mfa_secret,
            regen_request.code
        )
        
        if not is_valid:
            audit_logger.log_security_event(
                "MFA_BACKUP_REGEN_FAILED",
                user=current_user,
                details={"reason": "invalid_mfa_code", "target_user_id": target_user.id},
                ip_address=request.client.host if request.client else "unknown"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid MFA code"
            )
    
    try:
        # Generate new backup codes for target user
        backup_codes_pairs = mfa_manager.generate_backup_codes()
        plain_codes = [code for code, _ in backup_codes_pairs]
        hashed_codes = [hashed for _, hashed in backup_codes_pairs]
        
        # Update target user's backup codes
        target_user.mfa_backup_codes = hashed_codes
        db.commit()
        
        generated_at = datetime.now(timezone.utc)
        
        audit_logger.log_security_event(
            "MFA_BACKUP_CODES_REGENERATED",
            user=current_user,
            details={
                "count": len(plain_codes),
                "target_user_id": target_user.id,
                "target_username": target_user.username
            },
            ip_address=request.client.host if request.client else "unknown"
        )
        
        logger.info(f"Backup codes regenerated for user: {target_user.username} by admin: {current_user.username}")
        
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
    user_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get MFA status for a user.
    
    If user_id is provided, admin can get status for another user.
    Otherwise, returns status for the current user.
    """
    # Determine target user (default to current user, allow admin to specify another user)
    target_user = current_user
    if user_id:
        # Admin checking status for another user
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target user not found"
            )
    
    backup_codes_remaining = None
    if target_user.mfa_enabled and target_user.mfa_backup_codes:
        backup_codes_remaining = len(target_user.mfa_backup_codes)
    
    return MFAStatusResponse(
        mfa_enabled=target_user.mfa_enabled,
        backup_codes_remaining=backup_codes_remaining,
        enrolled_at=target_user.mfa_enrolled_at
    )

