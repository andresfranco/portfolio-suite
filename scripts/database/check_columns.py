#!/usr/bin/env python
"""
Script to check for database columns
Usage: python check_columns.py [table_name] [column_name]
"""
import psycopg2
import os
import sys

def check_column_exists(db_url, table_name, column_name):
    """Check if a column exists in a table"""
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # Query to check if column exists
        query = """
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = %s 
        AND column_name = %s
        """
        cur.execute(query, (table_name, column_name))
        result = cur.fetchall()
        
        exists = len(result) > 0
        
        # Get all columns for additional info
        cur.execute(
            """
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = %s
            ORDER BY ordinal_position
            """,
            (table_name,)
        )
        all_columns = cur.fetchall()
        
        cur.close()
        conn.close()
        
        return exists, [col[0] for col in all_columns]
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return False, []

if __name__ == "__main__":
    # Get connection string from environment variable
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL environment variable not set")
        print("Usage: DATABASE_URL='postgresql://user:pass@host:port/dbname' python check_columns.py [table] [column]")
        sys.exit(1)
    
    # Get table and column from command line args
    table_name = sys.argv[1] if len(sys.argv) > 1 else "users"
    column_name = sys.argv[2] if len(sys.argv) > 2 else "is_active"
    
    # Check for column
    exists, all_columns = check_column_exists(db_url, table_name, column_name)
    print(f"Database check for table '{table_name}':")
    print(f"  Column '{column_name}' exists: {exists}")
    print(f"  All columns: {', '.join(all_columns)}")
