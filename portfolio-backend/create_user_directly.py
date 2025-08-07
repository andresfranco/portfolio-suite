import sys
import psycopg2
from psycopg2 import sql
from passlib.context import CryptContext
from app.core.db_config import db_config

# Password context for hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_admin_user(username, email, password):
    # Connect to the database
    conn = psycopg2.connect(db_config.url)
    cur = conn.cursor()
    
    try:
        # Check if the user already exists
        cur.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cur.fetchone():
            print(f"User '{username}' already exists")
            return
        
        # Hash the password
        hashed_password = pwd_context.hash(password)
        
        # Insert the user
        cur.execute("""
            INSERT INTO users (username, email, hashed_password, created_by, updated_by)
            VALUES (%s, %s, %s, 1, 1)
            RETURNING id
        """, (username, email, hashed_password))
        
        user_id = cur.fetchone()[0]
        
        # Get the admin role ID
        cur.execute("SELECT id FROM roles WHERE name = 'Administrator'")
        admin_role = cur.fetchone()
        
        if not admin_role:
            print("Administrator role not found. Please make sure roles are initialized.")
            conn.rollback()
            return
        
        admin_role_id = admin_role[0]
        
        # Assign admin role to the user
        cur.execute("""
            INSERT INTO user_roles (user_id, role_id)
            VALUES (%s, %s)
        """, (user_id, admin_role_id))
        
        # Commit the transaction
        conn.commit()
        print(f"Admin user '{username}' created successfully with ID {user_id}")
        
    except Exception as e:
        conn.rollback()
        print(f"Error creating admin user: {str(e)}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python create_user_directly.py <username> <email> <password>")
        sys.exit(1)
    
    username = sys.argv[1]
    email = sys.argv[2]
    password = sys.argv[3]
    
    create_admin_user(username, email, password) 