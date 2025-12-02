#!/bin/bash

# Configuration
DB_USER="admindb"
DB_PASS="P@stGres!Adm1n#2025$"
DB_NAME="portfolioai"
DB_HOST="localhost"
OUTPUT_FILE="portfolio_dump_$(date +%Y%m%d_%H%M%S).dump"

# Export password for pg_dump
export PGPASSWORD=$DB_PASS

echo "Starting export of database '$DB_NAME'..."

# Create dump in custom format (compressed)
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME --format=c --file=$OUTPUT_FILE

if [ $? -eq 0 ]; then
    echo "✅ Database exported successfully to: $OUTPUT_FILE"
    echo ""
    echo "To import this on your Mac:"
    echo "1. Transfer '$OUTPUT_FILE' to your Mac."
    echo "2. Run the following command on your Mac (ensure postgres is running and user/db exist):"
    echo "   pg_restore -h localhost -U $DB_USER -d $DB_NAME --clean --if-exists -v $OUTPUT_FILE"
else
    echo "❌ Export failed."
    exit 1
fi
