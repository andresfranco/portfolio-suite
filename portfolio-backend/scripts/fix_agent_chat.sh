#!/bin/bash
# Fix corrupted Excel file issue in Agent Chat

echo "================================="
echo "Fixing Corrupted Excel File Issue"
echo "================================="
echo ""

# Step 1: Remove corrupted RAG chunks from database
echo "Step 1: Cleaning database..."
cd /home/andres/projects/portfolio-suite/portfolio-backend
source venv/bin/activate

psql -d portfolio_db -f fix_corrupted_excel_chunks.sql

# Step 2: Remove physical files
echo ""
echo "Step 2: Removing physical files..."
rm -f "static/uploads/projects/2/attachments/Houston Neighborhoods.xlsx"
rm -f "static/uploads/portfolios/1/attachments/Houston Neighborhoods.xlsx"

echo ""
echo "✓ Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Test the GPT Mini agent again with 'Hello' message"
echo "2. If you want to re-upload Houston Neighborhoods.xlsx, use the proper file upload feature"
echo "   (The system should now properly parse Excel files)"
