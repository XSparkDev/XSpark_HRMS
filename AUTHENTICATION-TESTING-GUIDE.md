# X Spark HRMS - Authentication API Testing Guide

## 📋 Overview

This guide provides comprehensive testing instructions for the X Spark HRMS Authentication API using Postman.

## 🚀 Quick Start

### **1. Import Postman Collection**
1. Open Postman
2. Click **Import** button
3. Select `X-Spark-HRMS-Auth-Postman-Collection.json`
4. Collection will be imported with all test requests

### **2. Set Up Environment Variables**
The collection includes these variables:
- `base_url`: `http://localhost:3000` (default)
- `access_token`: Auto-populated after login
- `employee_id`: Auto-populated after login
- `user_email`: `test.user@xspark.com` (default)
- `user_password`: `SecurePass123!` (default)

## 🎯 Test Categories

### **1. Authentication Tests**
- ✅ **Login** - Test with valid credentials
- ✅ **Get Current User** - Retrieve user + employee data
- ✅ **Logout** - End user session
- ✅ **Signup** - Create new auth user
- ✅ **Password Reset** - Request reset email
- ✅ **Update Password** - Change password

### **2. Employee Management Tests**
- ✅ **Create Employee** - SA citizen with ID number
- ✅ **Create Foreign Employee** - Foreigner with passport
- ✅ **Get All Employees** - List all active employees
- ✅ **Get Employee by ID** - Retrieve specific employee
- ✅ **Update Employee** - Modify employee data

### **3. Error Testing**
- ✅ **Invalid Login** - Wrong password
- ✅ **Non-existent Email** - Login with fake email
- ✅ **Weak Password** - Signup with weak password
- ✅ **Invalid Email** - Signup with malformed email
- ✅ **Missing Fields** - Employee creation with missing data
- ✅ **Constraint Violation** - Employee without ID/passport
- ✅ **Unauthorized Access** - Access protected route without auth

### **4. Database Tests**
- ✅ **Database Connection** - Test Supabase connectivity
- ✅ **Employee Service** - Test service methods
- ✅ **Simple Creation** - Minimal employee creation

### **5. Workflow Tests**
- ✅ **Complete Workflow** - End-to-end employee + auth creation

## 🔧 Test Execution Order

### **Recommended Testing Sequence:**

#### **Phase 1: Basic Setup**
1. **Database Connection Test** - Verify Supabase connectivity
2. **Create Employee** - Create test employee record
3. **Signup** - Create auth user for employee

#### **Phase 2: Authentication Flow**
4. **Login** - Test authentication
5. **Get Current User** - Verify session data
6. **Logout** - Test session termination

#### **Phase 3: Error Handling**
7. **Invalid Login** - Test error responses
8. **Weak Password** - Test validation
9. **Missing Fields** - Test required field validation

#### **Phase 4: Advanced Features**
10. **Password Reset** - Test reset flow
11. **Update Password** - Test password change
12. **Complete Workflow** - End-to-end test

## 📊 Expected Results

### **Successful Responses (200)**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* response data */ }
}
```

### **Error Responses (400/401/403/404)**
```json
{
  "success": false,
  "error": "Error description",
  "details": [ /* validation errors */ ]
}
```

## 🎯 Key Test Scenarios

### **1. Employee Creation Tests**

#### **SA Citizen (Valid)**
```json
{
  "first_name": "John",
  "last_name": "Smith",
  "email": "john.smith@xspark.com",
  "dob": "1985-03-15",
  "sex": "male",
  "nationality": "South Africa",
  "id_number": "8503151234567",
  "date_hired": "2023-01-15"
}
```
**Expected:** 200 OK with employee data

#### **Foreign National (Valid)**
```json
{
  "first_name": "David",
  "last_name": "Williams",
  "email": "david.williams@xspark.com",
  "dob": "1988-11-08",
  "sex": "male",
  "nationality": "United Kingdom",
  "passport_number": "GB123456789",
  "date_hired": "2023-03-10"
}
```
**Expected:** 200 OK with employee data

#### **Constraint Violation (Invalid)**
```json
{
  "first_name": "Invalid",
  "last_name": "Employee",
  "email": "invalid@xspark.com",
  "dob": "1990-01-01",
  "sex": "male",
  "nationality": "South Africa",
  "date_hired": "2023-01-01"
}
```
**Expected:** 400 Bad Request (missing id_number)

### **2. Authentication Tests**

#### **Valid Login**
```json
{
  "email": "test.user@xspark.com",
  "password": "SecurePass123!"
}
```
**Expected:** 200 OK with user + employee + session data

#### **Invalid Login**
```json
{
  "email": "test.user@xspark.com",
  "password": "wrongpassword"
}
```
**Expected:** 401 Unauthorized

### **3. Password Validation Tests**

#### **Weak Password**
```json
{
  "email": "weak@xspark.com",
  "password": "123",
  "first_name": "Weak",
  "last_name": "Password"
}
```
**Expected:** 400 Bad Request with validation errors

#### **Strong Password**
```json
{
  "email": "strong@xspark.com",
  "password": "StrongPass123!",
  "first_name": "Strong",
  "last_name": "Password"
}
```
**Expected:** 200 OK

## 🔍 Debugging Tips

### **1. Check Server Logs**
Monitor terminal output for detailed error messages:
```bash
npm run dev
```

### **2. Verify Database State**
Use Supabase dashboard to check:
- Employee records created
- Auth users created
- Session data

### **3. Test Individual Components**
- Test database connection first
- Test employee creation separately
- Test auth operations separately

### **4. Common Issues**

#### **"Employee record not found"**
- Employee exists but not linked to auth user
- Use `linkEmployeeToAuth()` service method

#### **"Not authenticated"**
- Session expired or invalid
- Re-run login request

#### **"Validation failed"**
- Check required fields
- Verify data types
- Check constraint compliance

## 📈 Performance Expectations

- **Response Time:** < 2 seconds for most operations
- **Login Time:** < 1 second
- **Database Queries:** < 500ms
- **Error Responses:** < 100ms

## 🛠️ Advanced Testing

### **1. Load Testing**
Use Postman Runner to:
- Run multiple iterations
- Test concurrent users
- Measure performance under load

### **2. Security Testing**
- Test with invalid tokens
- Test with expired sessions
- Test SQL injection attempts
- Test XSS prevention

### **3. Integration Testing**
- Test with real Supabase instance
- Test email delivery
- Test password reset flow
- Test session persistence

## 📝 Test Data Management

### **Cleanup Script**
After testing, clean up test data:
```sql
-- Delete test employees
DELETE FROM employees WHERE email LIKE '%test%';

-- Delete test auth users (via Supabase dashboard)
```

### **Test Data Sets**
- **Valid SA Citizen:** `john.smith@xspark.com`
- **Valid Foreigner:** `david.williams@xspark.com`
- **Test User:** `test.user@xspark.com`
- **Workflow Test:** `workflow.test@xspark.com`

## ✅ Success Criteria

### **All Tests Pass When:**
- ✅ Employee creation works for both SA citizens and foreigners
- ✅ Authentication flow completes successfully
- ✅ Error handling returns appropriate status codes
- ✅ Password validation works correctly
- ✅ Session management functions properly
- ✅ Database constraints are enforced
- ✅ API responses follow consistent format

## 🚨 Troubleshooting

### **Common Error Solutions**

#### **"unrecognized configuration parameter app.encryption_key"**
- Run the disable encryption trigger SQL script
- Or set the encryption key in Supabase

#### **"new row violates check constraint chk_sa_id_or_passport"**
- SA citizens need `id_number`
- Foreigners need `passport_number`

#### **"duplicate key value violates unique constraint"**
- Email already exists
- Use different email for testing

#### **"relation does not exist"**
- Database schema not created
- Run the database schema SQL

---

**Created:** 2025-10-24  
**Version:** 1.0.0  
**Status:** Ready for Testing

**Next Steps:**
1. Import Postman collection
2. Start development server (`npm run dev`)
3. Run tests in recommended order
4. Verify all scenarios pass
5. Clean up test data when done
