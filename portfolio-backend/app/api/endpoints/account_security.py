"""
Account Security API Endpoints

Provides endpoints for:
- Password reset (forgot password flow)
- Password change (authenticated users)
- Email verification
- Account status checking
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.account_security import account_security_manager
from app.core.security import verify_password
from app.models.user import User
from app.schemas.account_security import (
    PasswordResetRequestSchema,
    PasswordResetRequestResponse,
    PasswordResetConfirmSchema,
    PasswordResetConfirmResponse,
    PasswordChangeSchema,
    PasswordChangeResponse,
    EmailVerificationRequestSchema,
    EmailVerificationRequestResponse,
    EmailVerificationConfirmSchema,
    EmailVerificationConfirmResponse,
    AccountStatusResponse,
)
from app.api.deps import get_current_user
from app.core.audit_logger import audit_logger
from app.core.logging import setup_logger

logger = setup_logger("app.api.endpoints.account_security")

router = APIRouter()


@router.post("/password-reset/request", response_model=PasswordResetRequestResponse, status_code=status.HTTP_200_OK)
async def request_password_reset(
    request: Request,
    reset_request: PasswordResetRequestSchema,
    db: Session = Depends(get_db)
):
    """
    Request password reset link.
    
    Flow:
    1. User provides email
    2. System generates secure token
    3. System sends email with reset link (TODO: integrate email service)
    4. User clicks link and provides new password
    
    Note: Always returns success message to prevent email enumeration.
    """
    client_ip = request.client.host if request.client else "unknown"
    
    try:
        # Find user by email
        user = db.query(User).filter(User.email == reset_request.email).first()
        
        if user:
            # Generate reset token
            reset_token = account_security_manager.generate_password_reset_token(user, db)
            
            # TODO: Send email with reset link
            # reset_link = f"https://your-app.com/reset-password?token={reset_token}"
            # send_email(
            #     to=user.email,
            #     subject="Password Reset Request",
            #     body=f"Click here to reset your password: {reset_link}"
            # )
            
            audit_logger.log_security_event(
                "PASSWORD_RESET_REQUESTED",
                user=user,
                details={"email": user.email},
                ip_address=client_ip
            )
            
            logger.info(f"Password reset requested for user: {user.username}")
            logger.warning(
                f"TODO: Send password reset email to {user.email} with token: {reset_token}"
            )
        
        # Always return success to prevent email enumeration
        return PasswordResetRequestResponse()
        
    except Exception as e:
        logger.error(f"Error processing password reset request: {e}", exc_info=True)
        # Still return success to prevent enumeration
        return PasswordResetRequestResponse()


@router.post("/password-reset/confirm", response_model=PasswordResetConfirmResponse, status_code=status.HTTP_200_OK)
async def confirm_password_reset(
    request: Request,
    reset_confirm: PasswordResetConfirmSchema,
    db: Session = Depends(get_db)
):
    """
    Complete password reset with token.
    
    User provides:
    - Reset token (from email)
    - New password
    """
    client_ip = request.client.host if request.client else "unknown"
    
    try:
        # Find user with matching token
        # We need to hash the provided token and search for it
        import hashlib
        token_hash = hashlib.sha256(reset_confirm.token.encode()).hexdigest()
        
        user = db.query(User).filter(User.password_reset_token == token_hash).first()
        
        if not user:
            audit_logger.log_security_event(
                "PASSWORD_RESET_INVALID_TOKEN",
                details={"token_hash": token_hash[:16]},  # Log partial hash only
                ip_address=client_ip
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )
        
        # Verify token
        is_valid, error_message = account_security_manager.verify_password_reset_token(
            user, reset_confirm.token
        )
        
        if not is_valid:
            audit_logger.log_security_event(
                "PASSWORD_RESET_TOKEN_VERIFICATION_FAILED",
                user=user,
                details={"reason": error_message},
                ip_address=client_ip
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_message or "Invalid reset token"
            )
        
        # Reset password
        success = account_security_manager.reset_password(
            user, reset_confirm.new_password, db
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to reset password"
            )
        
        audit_logger.log_security_event(
            "PASSWORD_RESET_COMPLETED",
            user=user,
            details={},
            ip_address=client_ip
        )
        
        logger.info(f"Password reset completed for user: {user.username}")
        
        return PasswordResetConfirmResponse(
            success=True,
            message="Password reset successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing password reset: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password"
        )


@router.post("/password/change", response_model=PasswordChangeResponse, status_code=status.HTTP_200_OK)
async def change_password(
    request: Request,
    password_change: PasswordChangeSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change password for authenticated user.
    
    Requires:
    - Current password
    - New password
    """
    client_ip = request.client.host if request.client else "unknown"
    
    try:
        # Verify current password
        if not verify_password(password_change.current_password, current_user.hashed_password):
            audit_logger.log_security_event(
                "PASSWORD_CHANGE_FAILED",
                user=current_user,
                details={"reason": "invalid_current_password"},
                ip_address=client_ip
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect"
            )
        
        # Validate new password strength
        is_valid, errors = account_security_manager.validate_password_strength(
            password_change.new_password
        )
        
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="; ".join(errors)
            )
        
        # Check if new password is same as current
        if verify_password(password_change.new_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be different from current password"
            )
        
        # Update password
        current_user.set_password(password_change.new_password)
        current_user.password_changed_at = datetime.now(timezone.utc)
        current_user.force_password_change = False
        db.commit()
        
        audit_logger.log_security_event(
            "PASSWORD_CHANGED",
            user=current_user,
            details={},
            ip_address=client_ip
        )
        
        logger.info(f"Password changed for user: {current_user.username}")
        
        return PasswordChangeResponse(
            success=True,
            message="Password changed successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error changing password: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password"
        )


@router.post("/email/verify/request", response_model=EmailVerificationRequestResponse, status_code=status.HTTP_200_OK)
async def request_email_verification(
    request: Request,
    verification_request: EmailVerificationRequestSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Request email verification link.
    
    Sends verification email to user's registered email.
    """
    client_ip = request.client.host if request.client else "unknown"
    
    try:
        # Check if already verified
        if current_user.email_verified:
            return EmailVerificationRequestResponse(
                message="Email already verified"
            )
        
        # Generate verification token
        verification_token = account_security_manager.generate_email_verification_token(
            current_user, db
        )
        
        # TODO: Send verification email
        # verification_link = f"https://your-app.com/verify-email?token={verification_token}"
        # send_email(
        #     to=current_user.email,
        #     subject="Email Verification",
        #     body=f"Click here to verify your email: {verification_link}"
        # )
        
        audit_logger.log_security_event(
            "EMAIL_VERIFICATION_REQUESTED",
            user=current_user,
            details={"email": current_user.email},
            ip_address=client_ip
        )
        
        logger.info(f"Email verification requested for user: {current_user.username}")
        logger.warning(
            f"TODO: Send verification email to {current_user.email} with token: {verification_token}"
        )
        
        return EmailVerificationRequestResponse()
        
    except Exception as e:
        logger.error(f"Error requesting email verification: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email"
        )


@router.post("/email/verify/confirm", response_model=EmailVerificationConfirmResponse, status_code=status.HTTP_200_OK)
async def confirm_email_verification(
    request: Request,
    verification_confirm: EmailVerificationConfirmSchema,
    db: Session = Depends(get_db)
):
    """
    Confirm email verification with token.
    
    User provides verification token from email.
    """
    client_ip = request.client.host if request.client else "unknown"
    
    try:
        # Find user with matching token
        import hashlib
        token_hash = hashlib.sha256(verification_confirm.token.encode()).hexdigest()
        
        user = db.query(User).filter(User.email_verification_token == token_hash).first()
        
        if not user:
            audit_logger.log_security_event(
                "EMAIL_VERIFICATION_INVALID_TOKEN",
                details={"token_hash": token_hash[:16]},
                ip_address=client_ip
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token"
            )
        
        # Verify token
        is_valid, error_message = account_security_manager.verify_email_token(
            user, verification_confirm.token, db
        )
        
        if not is_valid:
            audit_logger.log_security_event(
                "EMAIL_VERIFICATION_FAILED",
                user=user,
                details={"reason": error_message},
                ip_address=client_ip
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_message or "Invalid verification token"
            )
        
        audit_logger.log_security_event(
            "EMAIL_VERIFIED",
            user=user,
            details={"email": user.email},
            ip_address=client_ip
        )
        
        logger.info(f"Email verified for user: {user.username}")
        
        return EmailVerificationConfirmResponse(
            success=True,
            message="Email verified successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying email: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify email"
        )


@router.get("/status", response_model=AccountStatusResponse, status_code=status.HTTP_200_OK)
async def get_account_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get account security status for current user.
    """
    # Check if account is locked
    is_locked, minutes_remaining = account_security_manager.is_account_locked(current_user)
    
    return AccountStatusResponse(
        is_locked=is_locked,
        lockout_minutes_remaining=minutes_remaining,
        failed_login_attempts=current_user.failed_login_attempts or 0,
        email_verified=current_user.email_verified,
        mfa_enabled=current_user.mfa_enabled,
        force_password_change=current_user.force_password_change,
        last_login_at=current_user.last_login_at,
        last_login_ip=current_user.last_login_ip,
        password_changed_at=current_user.password_changed_at
    )

