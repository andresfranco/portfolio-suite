#!/bin/bash

# Test script to verify skill management API endpoints

API_URL="http://localhost:8000"

echo "Testing Skill Management API Endpoints"
echo "======================================"
echo ""

# Note: These tests require authentication
# You'll need to replace TOKEN with a valid auth token

TOKEN="your-auth-token-here"

echo "1. Testing GET all skills..."
curl -s -X GET "${API_URL}/api/skills/?page=1&page_size=10" \
  -H "Content-Type: application/json" \
  | jq '.items | length' 2>/dev/null || echo "Error or no jq installed"

echo ""
echo "2. Testing POST add skill to project (requires auth)..."
echo "   Example: curl -X POST '${API_URL}/api/projects/1/skills/1' -H 'Authorization: Bearer TOKEN'"

echo ""
echo "3. Testing DELETE remove skill from project (requires auth)..."
echo "   Example: curl -X DELETE '${API_URL}/api/projects/1/skills/1' -H 'Authorization: Bearer TOKEN'"

echo ""
echo "======================================"
echo "Test script completed"
echo "Note: Authentication tests are shown as examples only"
