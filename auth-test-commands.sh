#!/bin/bash

# ==============================================================================
# Authentication API Test Commands
# ==============================================================================
# Quick test commands for the X Spark HRMS Authentication System
# ==============================================================================

BASE_URL="http://localhost:3000"

echo "🔐 X Spark HRMS Authentication Test Commands"
echo "============================================="
echo ""

# ==============================================================================
# 1. CREATE EMPLOYEE (No Auth)
# ==============================================================================
echo "1️⃣  Create Employee (database only, no login access)"
echo "POST $BASE_URL/api/employees"
echo ""
curl -X POST $BASE_URL/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test",
    "last_name": "User",
    "email": "test.user@xspark.com",
    "dob": "1990-01-01",
    "sex": "male",
    "nationality": "South Africa",
    "id_number": "9001011234567",
    "date_hired": "2025-01-01"
  }' | jq .

echo ""
echo "============================================="
echo ""

# ==============================================================================
# 2. SIGNUP (Creates Auth User)
# ==============================================================================
echo "2️⃣  Signup (creates auth user, but NOT employee)"
echo "POST $BASE_URL/api/auth/signup"
echo ""
curl -X POST $BASE_URL/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "new.user@xspark.com",
    "password": "SecurePass123!",
    "first_name": "New",
    "last_name": "User",
    "phone": "+27123456789"
  }' | jq .

echo ""
echo "============================================="
echo ""

# ==============================================================================
# 3. LOGIN
# ==============================================================================
echo "3️⃣  Login"
echo "POST $BASE_URL/api/auth/login"
echo ""
curl -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.user@xspark.com",
    "password": "Password123!"
  }' | jq .

echo ""
echo "============================================="
echo ""

# ==============================================================================
# 4. GET CURRENT USER
# ==============================================================================
echo "4️⃣  Get Current User"
echo "GET $BASE_URL/api/auth/me"
echo ""
curl -X GET $BASE_URL/api/auth/me | jq .

echo ""
echo "============================================="
echo ""

# ==============================================================================
# 5. REQUEST PASSWORD RESET
# ==============================================================================
echo "5️⃣  Request Password Reset"
echo "POST $BASE_URL/api/auth/reset-password"
echo ""
curl -X POST $BASE_URL/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.user@xspark.com"
  }' | jq .

echo ""
echo "============================================="
echo ""

# ==============================================================================
# 6. LOGOUT
# ==============================================================================
echo "6️⃣  Logout"
echo "POST $BASE_URL/api/auth/logout"
echo ""
curl -X POST $BASE_URL/api/auth/logout | jq .

echo ""
echo "============================================="
echo ""

# ==============================================================================
# INDIVIDUAL TESTS (uncomment to use)
# ==============================================================================

# Test Login with valid credentials
# curl -X POST $BASE_URL/api/auth/login \
#   -H "Content-Type: application/json" \
#   -d '{"email":"john.smith@xspark.com","password":"YourPassword123!"}' | jq .

# Test Login with invalid credentials
# curl -X POST $BASE_URL/api/auth/login \
#   -H "Content-Type: application/json" \
#   -d '{"email":"john.smith@xspark.com","password":"wrongpassword"}' | jq .

# Test Signup with weak password
# curl -X POST $BASE_URL/api/auth/signup \
#   -H "Content-Type: application/json" \
#   -d '{"email":"weak@xspark.com","password":"123","first_name":"Weak","last_name":"Pass"}' | jq .

echo "✅ All test commands executed!"
echo ""
echo "📝 Note: Remember to link employees to auth using the service:"
echo "   authService.linkEmployeeToAuth('employee-id', 'password')"
echo ""

