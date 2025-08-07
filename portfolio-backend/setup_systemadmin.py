#!/usr/bin/env python3
"""
SystemAdmin Setup Script

This script creates the systemadmin user with the System Administrator role
and ensures proper security configuration for enhanced login functionality.
"""

import sys
import os
import psycopg2
from psycopg2 import sql
from passlib.context import CryptContext
from datetime import datetime

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.core.db_config import db_config
from app.core.logging import setup_logger

# Set up logger
logger = setup_logger("setup_systemadmin")

# Password context for hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_systemadmin_user():
    """Create systemadmin user with System Administrator role"""
    
    # Default systemadmin credentials
    username = "systemadmin"
    email = "systemadmin@portfolio.local"
    password = "SystemAdmin123!"  # Strong default password
    
    logger.info("Starting systemadmin setup process...")
    
    try:
        # Connect to the database
        conn = psycopg2.connect(db_config.url)
        cur = conn.cursor()
        
        # Check if systemadmin already exists
        cur.execute("SELECT id, username, is_active FROM users WHERE username = %s", (username,))
        existing_user = cur.fetchone()
        
        if existing_user:
            user_id, existing_username, is_active = existing_user
            logger.info(f"SystemAdmin user '{existing_username}' already exists with ID {user_id}")
            
            # Ensure the user is active
            if not is_active:
                cur.execute("UPDATE users SET is_active = TRUE WHERE id = %s", (user_id,))
                logger.info("SystemAdmin user activated")
                
        else:
            # Create systemadmin user
            logger.info("Creating systemadmin user...")
            
            # Hash the password
            hashed_password = pwd_context.hash(password)
            
            # Insert the user
            cur.execute("""
                INSERT INTO users (username, email, hashed_password, is_active, created_by, updated_by, created_at, updated_at)
                VALUES (%s, %s, %s, TRUE, 1, 1, %s, %s)
                RETURNING id
            """, (username, email, hashed_password, datetime.utcnow(), datetime.utcnow()))
            
            user_id = cur.fetchone()[0]
            logger.info(f"SystemAdmin user created successfully with ID {user_id}")
            
            # Print credentials for first-time setup
            print(f"\n{'='*50}")
            print(f"SYSTEMADMIN USER CREATED")
            print(f"{'='*50}")
            print(f"Username: {username}")
            print(f"Email: {email}")
            print(f"Password: {password}")
            print(f"User ID: {user_id}")
            print(f"{'='*50}")
            print(f"IMPORTANT: Change the password after first login!")
            print(f"{'='*50}\n")
        
        # Ensure System Administrator role exists
        cur.execute("SELECT id FROM roles WHERE name = 'System Administrator'")
        system_admin_role = cur.fetchone()
        
        if not system_admin_role:
            logger.error("System Administrator role not found. Please run database initialization first.")
            return False
            
        system_admin_role_id = system_admin_role[0]
        
        # Check if user already has System Administrator role
        cur.execute("""
            SELECT COUNT(*) FROM user_roles 
            WHERE user_id = %s AND role_id = %s
        """, (user_id, system_admin_role_id))
        
        has_role = cur.fetchone()[0] > 0
        
        if not has_role:
            # Assign System Administrator role
            cur.execute("""
                INSERT INTO user_roles (user_id, role_id)
                VALUES (%s, %s)
            """, (user_id, system_admin_role_id))
            
            logger.info("System Administrator role assigned to systemadmin user")
        else:
            logger.info("SystemAdmin user already has System Administrator role")
        
        # Verify SYSTEM_ADMIN permission exists
        cur.execute("SELECT id FROM permissions WHERE name = 'SYSTEM_ADMIN'")
        system_admin_perm = cur.fetchone()
        
        if system_admin_perm:
            system_admin_perm_id = system_admin_perm[0]
            
            # Check if System Administrator role has SYSTEM_ADMIN permission
            cur.execute("""
                SELECT COUNT(*) FROM role_permissions 
                WHERE role_id = %s AND permission_id = %s
            """, (system_admin_role_id, system_admin_perm_id))
            
            has_permission = cur.fetchone()[0] > 0
            
            if not has_permission:
                # Assign SYSTEM_ADMIN permission to System Administrator role
                cur.execute("""
                    INSERT INTO role_permissions (role_id, permission_id)
                    VALUES (%s, %s)
                """, (system_admin_role_id, system_admin_perm_id))
                
                logger.info("SYSTEM_ADMIN permission assigned to System Administrator role")
            else:
                logger.info("System Administrator role already has SYSTEM_ADMIN permission")
        else:
            logger.warning("SYSTEM_ADMIN permission not found. Please ensure permissions are properly initialized.")
        
        # Commit all changes
        conn.commit()
        logger.info("SystemAdmin setup completed successfully!")
        
        return True
        
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
        logger.error(f"Error setting up systemadmin: {str(e)}")
        return False
        
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

def verify_systemadmin_setup():
    """Verify that systemadmin is properly configured"""
    
    logger.info("Verifying systemadmin setup...")
    
    try:
        conn = psycopg2.connect(db_config.url)
        cur = conn.cursor()
        
        # Get systemadmin user details
        cur.execute("""
            SELECT u.id, u.username, u.email, u.is_active,
                   array_agg(r.name) as roles,
                   array_agg(p.name) as permissions
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            WHERE u.username = 'systemadmin'
            GROUP BY u.id, u.username, u.email, u.is_active
        """)
        
        result = cur.fetchone()
        
        if result:
            user_id, username, email, is_active, roles, permissions = result
            
            print(f"\n{'='*60}")
            print(f"SYSTEMADMIN VERIFICATION")
            print(f"{'='*60}")
            print(f"User ID: {user_id}")
            print(f"Username: {username}")
            print(f"Email: {email}")
            print(f"Active: {is_active}")
            print(f"Roles: {roles}")
            print(f"Has SYSTEM_ADMIN permission: {'SYSTEM_ADMIN' in (permissions or [])}")
            print(f"{'='*60}\n")
            
            # Check security features
            if is_active and roles and 'System Administrator' in roles:
                logger.info("✅ SystemAdmin user is properly configured")
                return True
            else:
                logger.error("❌ SystemAdmin user configuration is incomplete")
                return False
        else:
            logger.error("❌ SystemAdmin user not found")
            return False
            
    except Exception as e:
        logger.error(f"Error verifying systemadmin setup: {str(e)}")
        return False
        
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

def main():
    """Main setup function"""
    
    print("SystemAdmin Setup Script")
    print("=" * 50)
    
    # Check database connection
    try:
        conn = psycopg2.connect(db_config.url)
        conn.close()
        logger.info(f"✅ Database connection successful: {db_config.current_environment}")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {str(e)}")
        return False
    
    # Create systemadmin user
    if not create_systemadmin_user():
        logger.error("Failed to create systemadmin user")
        return False
    
    # Verify setup
    if not verify_systemadmin_setup():
        logger.error("SystemAdmin setup verification failed")
        return False
    
    print("\n✅ SystemAdmin setup completed successfully!")
    print("\nNext steps:")
    print("1. Start the backend server: python run.py")
    print("2. Test login with systemadmin credentials")
    print("3. Change the default password after first login")
    print("4. Configure additional users and roles as needed")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 