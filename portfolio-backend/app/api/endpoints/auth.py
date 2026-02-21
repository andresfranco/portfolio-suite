from datetime import timedelta, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi.responses import JSONResponse

from app.core.database import get_db
from app.core.config import settings
from app.auth.jwt import create_access_token, create_refresh_token
from app.models.user import User
from app.schemas.token import Token
from app.core.logging import setup_logger
from app.models.system_setting import SystemSetting
from sqlalchemy import text, inspect as sa_inspect
from sqlalchemy.exc import ProgrammingError, OperationalError
from app.core.security import verify_password
from app.core.audit_logger import audit_logger
from app.core.account_security import account_security_manager
from app.core.mfa import mfa_manager
from app.core.secure_cookies import SecureCookieManager
from app.api.deps import get_current_user
import jwt
from jwt.exceptions import PyJWTError as JWTError

# Set up logger
logger = setup_logger("app.api.endpoints.auth")

router = APIRouter()

# System admin users who bypass certain checks
SYSTEM_ADMIN_USERS = ["systemadmin"]

@router.post("/login")
async def login_for_access_token(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Enhanced OAuth2 login with comprehensive security features
    
    Returns:
    - Token response if login successful and MFA not required
    - MFA required response if user has MFA enabled
    - Error response for failed authentication
    """
    # Get client information for security logging
    client_ip = request.client.host
    user_agent = request.headers.get("user-agent", "unknown")
    
    try:
        # Find user by username
        user = db.query(User).filter(User.username == form_data.username).first()
        
        # Check if account is locked (before password check to prevent timing attacks)
        if user and user.username not in SYSTEM_ADMIN_USERS:
            is_locked, minutes_remaining = account_security_manager.is_account_locked(user)
            if is_locked:
                audit_logger.log_login_attempt(
                    form_data.username, False, client_ip, user_agent,
                    {"reason": "account_locked", "minutes_remaining": minutes_remaining}
                )
                logger.warning(f"Locked account attempted login: {user.username} from IP: {client_ip}")
                return JSONResponse(
                    status_code=status.HTTP_423_LOCKED,
                    content={
                        "detail": f"Account is temporarily locked. Try again in {minutes_remaining} minutes.",
                        "locked_until_minutes": minutes_remaining
                    },
                    headers={"WWW-Authenticate": "Bearer"},
                )
        
        # Validate username and password
        if not user or not verify_password(form_data.password, user.hashed_password):
            # Record failed attempt for existing user
            if user and user.username not in SYSTEM_ADMIN_USERS:
                is_locked, lockout_minutes = account_security_manager.record_failed_login(
                    user, db, client_ip
                )
                
                if is_locked:
                    audit_logger.log_security_event(
                        "ACCOUNT_LOCKED",
                        user=user,
                        details={"lockout_minutes": lockout_minutes, "failed_attempts": user.failed_login_attempts},
                        ip_address=client_ip
                    )
            
            # Log failed attempt
            audit_logger.log_login_attempt(
                form_data.username, False, client_ip, user_agent,
                {"reason": "invalid_credentials"}
            )
            
            logger.warning(f"Failed login attempt for username: {form_data.username} from IP: {client_ip}")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Incorrect username or password"},
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check if user is active (systemadmin bypass)
        if not user.is_active and user.username not in SYSTEM_ADMIN_USERS:
            audit_logger.log_login_attempt(
                form_data.username, False, client_ip, user_agent,
                {"reason": "account_inactive"}
            )
            logger.warning(f"Inactive user attempted login: {user.username} from IP: {client_ip}")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Account is inactive"},
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check for forced password change
        if user.force_password_change and user.username not in SYSTEM_ADMIN_USERS:
            audit_logger.log_login_attempt(
                form_data.username, False, client_ip, user_agent,
                {"reason": "password_change_required"}
            )
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Password change required. Please reset your password."},
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check if MFA is enabled for this user
        if user.mfa_enabled and user.username not in SYSTEM_ADMIN_USERS:
            # Create a temporary session token for MFA verification
            mfa_session_token = create_access_token(
                data={"sub": user.username, "mfa_pending": True},
                expires_delta=timedelta(minutes=5)  # Short-lived token for MFA verification
            )
            
            audit_logger.log_security_event(
                "MFA_REQUIRED_AT_LOGIN",
                user=user,
                details={"username": user.username, "mfa_enabled": True},
                ip_address=client_ip
            )
            
            logger.info("MFA required at login for authenticated user")
            
            # Return MFA required response
            return {
                "mfa_required": True,
                "message": "MFA verification required",
                "session_token": mfa_session_token
            }
        
        # Detect suspicious login
        if user.username not in SYSTEM_ADMIN_USERS:
            is_suspicious, reasons = account_security_manager.detect_suspicious_login(
                user, client_ip, user_agent
            )
            
            if is_suspicious:
                audit_logger.log_security_event(
                    "SUSPICIOUS_LOGIN_DETECTED",
                    user=user,
                    details={"reasons": reasons, "ip": client_ip},
                    ip_address=client_ip
                )
                # Future: Send email notification
        
        # Helper to read int setting robustly even if table doesn't exist yet
        def _get_int_setting(key: str, default_value: int) -> int:
            try:
                # Check table existence first to avoid errors in fresh DBs
                inspector = sa_inspect(db.bind)
                if not inspector.has_table('system_settings'):
                    return default_value
                result = db.execute(text("SELECT value FROM system_settings WHERE key = :k"), {"k": key})
                val = result.scalar()
                return int(val) if val is not None and str(val).strip().isdigit() else default_value
            except (ProgrammingError, OperationalError, Exception):
                try:
                    db.rollback()
                except Exception:
                    pass
                return default_value

        # Resolve access token expiry minutes from DB settings (fallback to env)
        minutes = _get_int_setting('auth.access_token_expire_minutes', settings.ACCESS_TOKEN_EXPIRE_MINUTES)

        # Create access token
        access_token_expires = timedelta(minutes=minutes)
        access_token = create_access_token(
            data={"sub": user.username}, 
            expires_delta=access_token_expires
        )
        
        # Resolve refresh token expiry (minutes) from DB settings (fallback)
        refresh_minutes = _get_int_setting('auth.refresh_token_expire_minutes', settings.REFRESH_TOKEN_EXPIRE_MINUTES)

        refresh_token = create_refresh_token(
            data={"sub": user.username},
            expires_delta=timedelta(minutes=refresh_minutes)
        )
        
        # Update login metadata (reset failed attempts, update last login)
        if user.username not in SYSTEM_ADMIN_USERS:
            account_security_manager.update_login_metadata(
                user, db, client_ip, user_agent
            )
        
        # Log successful login
        audit_logger.log_login_attempt(
            user.username, True, client_ip, user_agent,
            {
                "user_id": user.id,
                "is_systemadmin": user.username in SYSTEM_ADMIN_USERS,
                "roles": [role.name for role in user.roles]
            }
        )
        
        # Special logging for systemadmin
        if user.username in SYSTEM_ADMIN_USERS:
            audit_logger.log_security_event(
                "SYSTEMADMIN_LOGIN",
                user=user,
                details={"login_source": "direct"},
                ip_address=client_ip
            )
        
        logger.info(f"Successful login: {user.username} from IP: {client_ip}")
        
        # Set authentication cookies (httpOnly, secure)
        csrf_token = SecureCookieManager.set_auth_cookies(
            response=response,
            access_token=access_token,
            refresh_token=refresh_token,
            access_token_expires=access_token_expires,
            refresh_token_expires=timedelta(minutes=refresh_minutes),
            request=request
        )
        
        # Return user info and CSRF token (no tokens in response body!)
        return {
            "success": True,
            "csrf_token": csrf_token,  # Frontend needs this for subsequent requests
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "is_active": user.is_active,
                "is_systemadmin": user.username in SYSTEM_ADMIN_USERS,
                "roles": [{"id": role.id, "name": role.name} for role in user.roles]
            }
        }
        
    except SQLAlchemyError as e:
        logger.error(f"Database error during login: {str(e)}", exc_info=True)
        audit_logger.log_security_event(
            "LOGIN_DATABASE_ERROR",
            details={"error": str(e)},
            ip_address=client_ip
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred"
        )
    except Exception as e:
        logger.error(f"Unexpected error during login: {str(e)}", exc_info=True)
        audit_logger.log_security_event(
            "LOGIN_UNEXPECTED_ERROR",
            details={"error": str(e)},
            ip_address=client_ip
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred"
        )


@router.post("/refresh-token")
async def refresh_access_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Issue a new access token (and optionally new refresh token) from httpOnly cookie."""
    # Get refresh token from cookie (not from body!)
    refresh_token = SecureCookieManager.get_refresh_token(request)
    if not refresh_token:
        raise HTTPException(status_code=400, detail="No refresh token found")

    try:
        # Decode refresh token (tokens created with HS256 in app/auth/jwt.py)
        payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=["HS256"])
        username = payload.get("sub")
        exp_ts = payload.get("exp")
        if not username or not exp_ts:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        # Check expiry explicitly
        if datetime.now(timezone.utc).timestamp() >= float(exp_ts):
            raise HTTPException(status_code=401, detail="Refresh token expired")

        # Lookup user
        user = db.query(User).filter(User.username == username).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Invalid user for refresh token")

        # Read settings for expiries
        def _get_int_setting_refresh(key: str, default_value: int) -> int:
            try:
                inspector = sa_inspect(db.bind)
                if not inspector.has_table('system_settings'):
                    return default_value
                result = db.execute(text("SELECT value FROM system_settings WHERE key = :k"), {"k": key})
                val = result.scalar()
                return int(val) if val is not None and str(val).strip().isdigit() else default_value
            except Exception:
                try:
                    db.rollback()
                except Exception:
                    pass
                return default_value

        access_minutes = _get_int_setting_refresh('auth.access_token_expire_minutes', settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        refresh_minutes = _get_int_setting_refresh('auth.refresh_token_expire_minutes', settings.REFRESH_TOKEN_EXPIRE_MINUTES)

        # Create new tokens
        access_token_expires = timedelta(minutes=access_minutes)
        refresh_token_expires = timedelta(minutes=refresh_minutes)
        
        new_access = create_access_token(data={"sub": user.username}, expires_delta=access_token_expires)
        new_refresh = create_refresh_token(data={"sub": user.username}, expires_delta=refresh_token_expires)

        # Set new authentication cookies
        csrf_token = SecureCookieManager.set_auth_cookies(
            response=response,
            access_token=new_access,
            refresh_token=new_refresh,
            access_token_expires=access_token_expires,
            refresh_token_expires=refresh_token_expires,
            request=request
        )

        return {
            "success": True,
            "csrf_token": csrf_token
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to refresh token")


@router.post("/mfa/verify-login")
async def verify_mfa_login(
    request: Request,
    response: Response,
    body: dict = Body(...),
    db: Session = Depends(get_db)
):
    """
    Complete login by verifying MFA code.
    
    Required fields in body:
    - session_token: Temporary token from initial login
    - code: 6-digit TOTP code or 8-character backup code
    """
    session_token = body.get("session_token")
    code = body.get("code")
    
    if not session_token or not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="session_token and code are required"
        )
    
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    
    try:
        # Decode session token
        payload = jwt.decode(session_token, settings.SECRET_KEY, algorithms=["HS256"])
        username = payload.get("sub")
        mfa_pending = payload.get("mfa_pending")
        
        if not username or not mfa_pending:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid session token"
            )
        
        # Get user
        user = db.query(User).filter(User.username == username).first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user"
            )
        
        # Check if MFA is enabled
        if not user.mfa_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA is not enabled for this user"
            )
        
        # Verify MFA code (supports both TOTP and backup codes)
        is_valid = False
        used_backup_code = False
        
        # Try TOTP first (6 digits)
        if len(code) == 6 and code.isdigit():
            is_valid = mfa_manager.verify_totp_code(user.mfa_secret, code)
        # Try backup code (8 characters with dash)
        elif len(code) == 9 and '-' in code:  # Format: XXXX-XXXX
            is_valid, remaining = mfa_manager.verify_backup_code(
                code, user.mfa_backup_codes or []
            )
            if is_valid:
                used_backup_code = True
                # Update user's backup codes (remove used one)
                user.mfa_backup_codes = remaining
                db.commit()
        
        if not is_valid:
            audit_logger.log_security_event(
                "MFA_LOGIN_VERIFICATION_FAILED",
                user=user,
                details={"reason": "invalid_code"},
                ip_address=client_ip
            )
            
            logger.warning(f"Invalid MFA code for user: {username} from IP: {client_ip}")
            
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid MFA code"
            )
        
        # Helper to read int setting
        def _get_int_setting(key: str, default_value: int) -> int:
            try:
                inspector = sa_inspect(db.bind)
                if not inspector.has_table('system_settings'):
                    return default_value
                result = db.execute(text("SELECT value FROM system_settings WHERE key = :k"), {"k": key})
                val = result.scalar()
                return int(val) if val is not None and str(val).strip().isdigit() else default_value
            except Exception:
                try:
                    db.rollback()
                except Exception:
                    pass
                return default_value
        
        # Create tokens
        access_minutes = _get_int_setting('auth.access_token_expire_minutes', settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        refresh_minutes = _get_int_setting('auth.refresh_token_expire_minutes', settings.REFRESH_TOKEN_EXPIRE_MINUTES)
        
        access_token_expires = timedelta(minutes=access_minutes)
        refresh_token_expires = timedelta(minutes=refresh_minutes)
        
        access_token = create_access_token(
            data={"sub": user.username},
            expires_delta=access_token_expires
        )
        
        refresh_token = create_refresh_token(
            data={"sub": user.username},
            expires_delta=refresh_token_expires
        )
        
        # Update login metadata
        if user.username not in SYSTEM_ADMIN_USERS:
            account_security_manager.update_login_metadata(
                user, db, client_ip, user_agent
            )
        
        # Log successful MFA login
        audit_logger.log_security_event(
            "MFA_LOGIN_SUCCESS",
            user=user,
            details={
                "used_backup_code": used_backup_code,
                "backup_codes_remaining": len(user.mfa_backup_codes or []) if used_backup_code else None
            },
            ip_address=client_ip
        )
        
        logger.info(f"Successful MFA login: {user.username} from IP: {client_ip}")
        
        # Set authentication cookies (httpOnly, secure)
        csrf_token = SecureCookieManager.set_auth_cookies(
            response=response,
            access_token=access_token,
            refresh_token=refresh_token,
            access_token_expires=access_token_expires,
            refresh_token_expires=refresh_token_expires,
            request=request
        )
        
        return {
            "success": True,
            "csrf_token": csrf_token,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "is_active": user.is_active,
                "is_systemadmin": user.username in SYSTEM_ADMIN_USERS,
                "roles": [{"id": role.id, "name": role.name} for role in user.roles]
            }
        }
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"MFA login verification error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify MFA"
        )


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Logout user by clearing authentication cookies
    
    Clears all httpOnly cookies (access_token, refresh_token, csrf_token, token_fp)
    """
    client_ip = request.client.host if request.client else "unknown"
    
    try:
        # Try to get username from access token if available
        access_token = SecureCookieManager.get_access_token(request)
        username = None
        
        if access_token:
            try:
                payload = jwt.decode(access_token, settings.SECRET_KEY, algorithms=["HS256"])
                username = payload.get("sub")
            except JWTError:
                pass  # Token invalid or expired, that's okay for logout
        
        # Clear authentication cookies
        SecureCookieManager.clear_auth_cookies(response)
        
        # Log logout event
        if username:
            audit_logger.log_security_event(
                "USER_LOGOUT",
                details={"username": username},
                ip_address=client_ip
            )
            logger.info(f"User logged out: {username} from IP: {client_ip}")
        else:
            logger.info(f"Logout request from IP: {client_ip}")
        
        return {
            "success": True,
            "message": "Successfully logged out"
        }
        
    except Exception as e:
        logger.error(f"Logout error: {str(e)}", exc_info=True)
        # Even if there's an error, clear the cookies
        SecureCookieManager.clear_auth_cookies(response)
        return {
            "success": True,
            "message": "Successfully logged out"
        }


@router.get("/generate-website-token")
async def generate_website_token(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Generate a JWT token for website edit mode from an authenticated cookie session.
    This allows backend-ui users to open the website in edit mode.
    
    Returns:
        dict: Contains access_token for use in website URL
    """
    try:
        # Get access token from cookie
        access_token = request.cookies.get("access_token")
        
        if not access_token:
            logger.warning("No access token found in cookies")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated. Please log in to the backend first."
            )
        
        # Verify and decode the token to get user info
        try:
            payload = jwt.decode(
                access_token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM]
            )
            username = payload.get("sub")
            
            if not username:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication token"
                )
            
            # Get user from database with permissions
            user = db.query(User).filter(User.username == username).first()
            
            if not user or not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found or inactive"
                )
            
            # Check if user has EDIT_CONTENT permission or is SYSTEM_ADMIN
            has_permission = user.username in SYSTEM_ADMIN_USERS
            
            if not has_permission:
                for role in user.roles:
                    for permission in role.permissions:
                        if permission.code in ['EDIT_CONTENT', 'MANAGE_CONTENT', 'SYSTEM_ADMIN']:
                            has_permission = True
                            break
                    if has_permission:
                        break
            
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have permission to edit website content"
                )
            
            # Generate a new JWT token for the website (longer expiration for editing session)
            website_token = create_access_token(
                data={"sub": user.username, "user_id": user.id},
                expires_delta=timedelta(hours=2)  # 2 hour editing session
            )
            
            logger.info(f"Generated website token for user: {username}")
            
            return {
                "access_token": website_token,
                "token_type": "bearer",
                "expires_in": 7200  # 2 hours in seconds
            }
            
        except JWTError as e:
            logger.error(f"JWT decode error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating website token: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate website token"
        )


@router.get("/verify")
async def verify_token(
    current_user: User = Depends(get_current_user)
):
    """
    Verify that a JWT token is valid and return basic user info.
    Used by the website to verify authentication tokens.
    
    Returns:
        dict: User verification status and basic info
    """
    return {
        "valid": True,
        "user_id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "is_active": current_user.is_active
    }


@router.get("/csrf-token")
async def get_csrf_token(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user)
):
    """
    Get or refresh CSRF token for authenticated users.
    
    This endpoint allows the frontend to obtain a fresh CSRF token
    without having to re-authenticate. Useful when the CSRF token expires.
    """
    try:
        # Generate a fresh CSRF token
        csrf_token = SecureCookieManager.generate_csrf_token()
        
        # Set it as a cookie
        SecureCookieManager.set_csrf_cookie(response, csrf_token)
        
        logger.info(f"CSRF token refreshed for user: {current_user.username}")
        
        return {
            "csrf_token": csrf_token,
            "message": "CSRF token generated successfully"
        }
    except Exception as e:
        logger.error(f"Error generating CSRF token: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate CSRF token"
        )
