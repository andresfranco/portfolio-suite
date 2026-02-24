import sys
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine
from app.models.user import User
from app.crud.role import get_role_by_name
from app.core.logging import setup_logger

# Set up logger
logger = setup_logger("create_admin")

def create_admin_user(username: str, email: str, password: str):
    # Create a database session
    db = SessionLocal()
    try:
        # Check if the admin user already exists
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            logger.info(f"Admin user '{username}' already exists")
            return
        
        # Create a new user
        user = User(
            username=username,
            email=email,
            created_by=1,  # System
            updated_by=1,  # System
            is_active=True,  # Make the user active
        )
        
        # Set the password
        user.set_password(password)
        
        # Add to database
        db.add(user)
        db.flush()
        
        # Get the admin role (name matches CORE_ROLES definition: "Admin")
        admin_role = get_role_by_name(db, "Admin")
        if not admin_role:
            logger.error("Admin role not found. Please make sure roles are initialized.")
            db.rollback()
            return
        
        # Assign admin role
        user.roles.append(admin_role)
        
        # Commit changes
        db.commit()
        logger.info(f"Admin user '{username}' created successfully")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating admin user: {str(e)}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python create_admin.py <username> <email> <password>")
        sys.exit(1)
    
    username = sys.argv[1]
    email = sys.argv[2]
    password = sys.argv[3]
    
    create_admin_user(username, email, password) 