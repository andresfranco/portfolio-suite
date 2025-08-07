#!/usr/bin/env python
"""
Script to check for the is_active column in both portfolioai and portfolioai_dev databases
"""
import psycopg2
import os

# Database connection strings
DEV_DB_URL = "postgresql://admindb:P%405tGres%21Adm1n%232025%24@localhost:5432/portfolioai_dev"
PROD_DB_URL = "postgresql://admindb:P%405tGres%21Adm1n%232025%24@localhost:5432/portfolioai"

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
        cur.execute(f"SELECT * FROM information_schema.columns WHERE table_name = '{table_name}'")
        all_columns = cur.fetchall()
        
        cur.close()
        conn.close()
        
        return exists, [col[3] for col in all_columns]  # Return column names
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return False, []

if __name__ == "__main__":
    # Check for is_active in production database
    prod_exists, prod_columns = check_column_exists(PROD_DB_URL, "users", "is_active")
    print(f"Production database (portfolioai):")
    print(f"  'is_active' column exists: {prod_exists}")
    print(f"  All columns: {', '.join(prod_columns)}")
    print()
    
    # Check for is_active in development database
    dev_exists, dev_columns = check_column_exists(DEV_DB_URL, "users", "is_active")
    print(f"Development database (portfolioai_dev):")
    print(f"  'is_active' column exists: {dev_exists}")
    print(f"  All columns: {', '.join(dev_columns)}") 