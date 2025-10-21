# X Spark HRMS API Test Commands
# Copy and paste these commands into your terminal for quick testing

# ============================================================================
# EMPLOYEE MANAGEMENT TESTS
# ============================================================================

# 1. GET All Employees
curl -X GET http://localhost:3001/api/employees \
  -H "Accept: application/json"

# 2. GET All Employees with Filters
curl -X GET "http://localhost:3001/api/employees?search=john&limit=10&offset=0" \
  -H "Accept: application/json"

# 3. POST Create Employee
curl -X POST http://localhost:3001/api/employees \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@xspark.com",
    "dob": "1990-01-01",
    "sex": "male",
    "date_hired": "2025-01-01",
    "nationality": "South Africa",
    "phone": "+27123456789",
    "id_number": "1234567890123",
    "employment_status": "probation",
    "passport_number": "A12345678"
  }'

# 4. PUT Update Employee (replace EMPLOYEE_ID with actual ID from create response)
curl -X PUT http://localhost:3001/api/employees \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "id": "EMPLOYEE_ID",
    "first_name": "John Updated",
    "phone": "+27987654321",
    "employment_status": "active"
  }'

# 5. GET Employee by ID (replace EMPLOYEE_ID with actual ID)
curl -X GET http://localhost:3001/api/employees/EMPLOYEE_ID \
  -H "Accept: application/json"

# ============================================================================
# LEAVE MANAGEMENT TESTS
# ============================================================================

# 6. GET Leave Requests
curl -X GET http://localhost:3001/api/leave/requests \
  -H "Accept: application/json"

# 7. POST Create Leave Request (replace EMPLOYEE_ID with actual ID)
curl -X POST http://localhost:3001/api/leave/requests \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "employee_id": "EMPLOYEE_ID",
    "full_name": "John Doe",
    "employee_number": "XSP25/01/001",
    "id_number": "1234567890123",
    "job_title": "Software Engineer",
    "leave_type": "annual",
    "leave_day_from": "2025-02-01",
    "leave_day_to": "2025-02-05",
    "total_days": 5,
    "reason": "Family vacation"
  }'

# ============================================================================
# FILE UPLOAD TESTS
# ============================================================================

# 8. POST Upload File (replace /path/to/file.pdf with actual file path)
curl -X POST http://localhost:3001/api/upload \
  -F "file=@/path/to/file.pdf" \
  -F "bucket=employee-documents" \
  -F "path=test-documents"

# 9. DELETE File
curl -X DELETE http://localhost:3001/api/upload \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "bucket": "employee-documents",
    "path": "test-documents/file.pdf"
  }'

# ============================================================================
# DATABASE CONNECTION TESTS
# ============================================================================

# 10. GET Database Status
curl -X GET http://localhost:3001/api/supabase/simple-test \
  -H "Accept: application/json"

# 11. POST Test Database Connection
curl -X POST http://localhost:3001/api/supabase/test \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"testType": "database"}'

# 12. POST Test Storage Connection
curl -X POST http://localhost:3001/api/supabase/test \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"testType": "storage"}'

# 13. GET Employee Service Test
curl -X GET http://localhost:3001/api/employees/test \
  -H "Accept: application/json"

# ============================================================================
# TESTING WORKFLOW
# ============================================================================

# Step 1: Test database connection
echo "Testing database connection..."
curl -X POST http://localhost:3001/api/supabase/test \
  -H "Content-Type: application/json" \
  -d '{"testType": "database"}'

# Step 2: Create an employee
echo "Creating test employee..."
EMPLOYEE_RESPONSE=$(curl -s -X POST http://localhost:3001/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test",
    "last_name": "User",
    "email": "test.user@xspark.com",
    "dob": "1990-01-01",
    "sex": "male",
    "date_hired": "2025-01-01",
    "nationality": "South Africa",
    "employment_status": "probation"
  }')

echo "Employee creation response: $EMPLOYEE_RESPONSE"

# Step 3: Get all employees
echo "Getting all employees..."
curl -X GET http://localhost:3001/api/employees \
  -H "Accept: application/json"

# Step 4: Test employee service
echo "Testing employee service..."
curl -X GET http://localhost:3001/api/employees/test \
  -H "Accept: application/json"
