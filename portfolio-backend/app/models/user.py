from sqlalchemy import Column, Integer, String, Table, ForeignKey, DateTime, Boolean, Text, JSON  
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func  
from app.core.database import Base
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Association table for many-to-many relationship between users and roles
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id")),
    Column("role_id", Integer, ForeignKey("roles.id"))
)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    # Timestamp and user tracking fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer)  # user id who created the record
    updated_by = Column(Integer)  # user id who last updated the record
    # Active status flag
    is_active = Column(Boolean, default=True, index=True)
    # Each user can have one or more roles
    roles = relationship("Role", secondary=user_roles, back_populates="users")
    
    # Multi-Factor Authentication (MFA) fields
    mfa_enabled = Column(Boolean, default=False, nullable=False, index=True)
    mfa_secret = Column(String(32), nullable=True)  # TOTP secret (encrypted in production)
    mfa_backup_codes = Column(JSON, nullable=True)  # List of hashed backup codes
    mfa_enrolled_at = Column(DateTime(timezone=True), nullable=True)
    
    # Account Security fields
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    account_locked_until = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    last_login_ip = Column(String(45), nullable=True)  # IPv6 support (45 chars)
    password_changed_at = Column(DateTime(timezone=True), server_default=func.now())
    force_password_change = Column(Boolean, default=False, nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    email_verification_token = Column(String(255), nullable=True)
    email_verification_sent_at = Column(DateTime(timezone=True), nullable=True)
    password_reset_token = Column(String(255), nullable=True)
    password_reset_sent_at = Column(DateTime(timezone=True), nullable=True)

    def set_password(self, password: str) -> None:
        self.hashed_password = pwd_context.hash(password)

    def verify_password(self, password: str) -> bool:
        return pwd_context.verify(password, self.hashed_password)