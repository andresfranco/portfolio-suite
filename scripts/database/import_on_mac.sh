#!/bin/bash

# Usage: ./import_on_mac.sh <dump_file>

if [ -z "$1" ]; then
    echo "Usage: $0 <dump_file>"
    echo "Example: $0 portfolio_dump_20251123_120000.dump"
    exit 1
fi

DUMP_FILE="$1"
DB_USER="admindb"
DB_NAME="portfolioai"
DB_HOST="localhost"

# Check if pg_restore is available
if ! command -v pg_restore &> /dev/null; then
    echo "Error: pg_restore is not installed or not in PATH."
    exit 1
fi

echo "Importing '$DUMP_FILE' into database '$DB_NAME'..."

# Note: You might need to set PGPASSWORD or have a .pgpass file on your Mac
# export PGPASSWORD="YourMacPostgresPassword" 

# Create DB if it doesn't exist (requires user to have createdb permission)
# createdb -h $DB_HOST -U $DB_USER $DB_NAME 2>/dev/null

pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME --clean --if-exists -v "$DUMP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Import successful."
else
    echo "❌ Import failed."
    exit 1
fi
