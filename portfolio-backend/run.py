#!/usr/bin/env python
import os
import sys
import subprocess
from pathlib import Path

def main():
    # Get the project directory
    project_dir = Path(__file__).parent.absolute()
    print(f"Project directory: {project_dir}")
    
    # Check for missing imports in the __init__.py file
    schemas_init = project_dir / 'app' / 'schemas' / '__init__.py'
    if schemas_init.exists():
        print(f"Checking schemas __init__.py at {schemas_init}")
        
        # Read the file
        with open(schemas_init, 'r') as f:
            content = f.read()
        
        # Check for necessary imports and fix them
        fixes_needed = False
        updated_content = content
        
        # Fix 1: Ensure EmailRequest/EmailSchema is properly imported
        if 'from app.schemas.email import EmailSchema' in content and 'EmailRequest' not in content:
            print("Fixing EmailSchema import")
            updated_content = updated_content.replace(
                'from app.schemas.email import EmailSchema',
                'from app.schemas.email import EmailRequest, EmailSchema'
            )
            fixes_needed = True
            
        # Fix 2: Update imports to use proper image module classes  
        if 'from app.schemas.image import' in content and 'ImageBase' not in content:
            print("Fixing Image imports")
            updated_content = updated_content.replace(
                'from app.schemas.image import ImageIn, ImageOut',
                'from app.schemas.image import ImageBase, ImageCreate, ImageUpdate, Image, ImageOut, ImageIn'
            )
            fixes_needed = True
            
        # Save changes if needed
        if fixes_needed:
            print("Saving schema __init__.py with fixes")
            with open(schemas_init, 'w') as f:
                f.write(updated_content)
    
    # Ensure the import aliases are consistent
    email_schema = project_dir / 'app' / 'schemas' / 'email.py'
    if email_schema.exists():
        print(f"Checking email schema at {email_schema}")
        
        # Read the file  
        with open(email_schema, 'r') as f:
            content = f.read()
            
        # Add the alias if missing
        if 'EmailSchema = EmailRequest' not in content:
            print("Adding EmailSchema alias to email.py")
            with open(email_schema, 'a') as f:
                f.write("\n\n# Alias for backward compatibility\nEmailSchema = EmailRequest\n")
    
    # Start the application
    print("Starting FastAPI application...")
    try:
        subprocess.run(["python", "-m", "app.main"], check=True)
    except KeyboardInterrupt:
        print("\nApplication stopped by user")
    except Exception as e:
        print(f"Error starting application: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 