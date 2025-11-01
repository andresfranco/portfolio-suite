#!/bin/bash

# Test adding category to portfolio
# Usage: ./test_add_category.sh

echo "========================================="
echo "Testing Add Category to Portfolio"
echo "========================================="
echo ""

# Get auth token
echo "1. Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✓ Login successful"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Try to add category 38 to portfolio 1
echo "2. Adding category 38 to portfolio 1..."
ADD_RESPONSE=$(curl -s -X POST "http://localhost:8000/api/v1/portfolios/1/categories/38" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Response: $ADD_RESPONSE"
echo ""

# Check if successful
if echo "$ADD_RESPONSE" | grep -q "successfully"; then
  echo "✓ Category added successfully!"
else
  echo "❌ Failed to add category"
fi

echo ""
echo "3. Checking backend terminal output for debug logs..."
echo "   (Look for permission check debugging info)"
