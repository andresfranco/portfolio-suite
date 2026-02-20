#!/bin/bash
echo "=== Testing Security Features ==="
echo ""

# 1. Test login and get access token
echo "1. Testing Login with testuser..."
LOGIN_RESPONSE=$(curl -s -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser&password=testpass123")

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Login failed. Response:"
  echo $LOGIN_RESPONSE | python3 -m json.tool
  exit 1
fi
echo "✅ Login successful"
echo ""

# 2. Test Account Status endpoint
echo "2. Testing GET /api/account/status"
echo "   Response:"
curl -s -X GET "http://localhost:8000/api/account/status" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | python3 -m json.tool
echo ""

# 3. Test MFA Status endpoint
echo "3. Testing GET /api/mfa/status"
echo "   Response:"
curl -s -X GET "http://localhost:8000/api/mfa/status" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | python3 -m json.tool
echo ""

# 4. Test MFA Enrollment
echo "4. Testing POST /api/mfa/enroll"
echo "   Starting MFA enrollment..."
MFA_RESPONSE=$(curl -s -X POST "http://localhost:8000/api/mfa/enroll" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password": "testpass123"}')

echo "   Response (truncated for readability):"
echo $MFA_RESPONSE | python3 -c "import sys, json; data = json.load(sys.stdin); print(json.dumps({'secret': data.get('secret', 'N/A'), 'qr_code_url': 'data:image/png;base64,...' if 'qr_code_url' in data else 'N/A', 'backup_codes_count': len(data.get('backup_codes', []))}, indent=2))"
echo ""

# 5. Test audit logs (check database)
echo "5. Checking Audit Logs..."
echo "   Recent audit entries:"
