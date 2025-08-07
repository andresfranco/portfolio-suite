from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
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
from app.core.security import verify_password
from app.core.audit_logger import audit_logger

# Set up logger
logger = setup_logger("app.api.endpoints.auth")

router = APIRouter()

# System admin users who bypass certain checks
SYSTEM_ADMIN_USERS = ["systemadmin"]

@router.post("/login", response_model=Token)
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Enhanced OAuth2 login with comprehensive security features
    """
    # Get client information for security logging
    client_ip = request.client.host
    user_agent = request.headers.get("user-agent", "unknown")
    
    try:
        # Find user by username
        user = db.query(User).filter(User.username == form_data.username).first()
        
        # Validate username and password
        if not user or not verify_password(form_data.password, user.hashed_password):
            # Record failed attempt
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
        
        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, 
            expires_delta=access_token_expires
        )
        
        # Create refresh token if needed
        refresh_token = create_refresh_token(
            data={"sub": user.username}
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
        
        # Return tokens and user info
        return {
            "access_token": access_token,
            "token_type": "bearer",
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