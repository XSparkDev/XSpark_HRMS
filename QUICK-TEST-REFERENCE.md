# X Spark HRMS - Quick Test Reference

## 🚀 Essential Tests (Run These First)

### **1. Database Connection**
```
GET {{base_url}}/api/supabase/simple-test
```
**Expected:** 200 OK with database status

### **2. Create Test Employee**
```
POST {{base_url}}/api/employees
Content-Type: application/json

{
  "first_name": "Test",
  "last_name": "User",
  "email": "test.user@xspark.com",
  "dob": "1990-01-01",
  "sex": "male",
  "nationality": "South Africa",
  "id_number": "9001011234567",
  "date_hired": "2025-01-01"
}
```
**Expected:** 200 OK with employee data

### **3. Login Test**
```
POST {{base_url}}/api/auth/login
Content-Type: application/json

{
  "email": "test.user@xspark.com",
  "password": "Password123!"
}
```
**Expected:** 401 Unauthorized (no auth user yet)

### **4. Signup Test**
```
POST {{base_url}}/api/auth/signup
Content-Type: application/json

{
  "email": "test.user@xspark.com",
  "password": "SecurePass123!",
  "first_name": "Test",
  "last_name": "User"
}
```
**Expected:** 200 OK with auth user

### **5. Login Again**
```
POST {{base_url}}/api/auth/login
Content-Type: application/json

{
  "email": "test.user@xspark.com",
  "password": "SecurePass123!"
}
```
**Expected:** 200 OK with user + employee + session

## 🔧 Quick Commands

### **cURL Commands**
```bash
# Test database
curl -X GET http://localhost:3000/api/supabase/simple-test

# Create employee
curl -X POST http://localhost:3000/api/employees \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Test","last_name":"User","email":"test@xspark.com","dob":"1990-01-01","sex":"male","nationality":"South Africa","id_number":"9001011234567","date_hired":"2025-01-01"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@xspark.com","password":"Password123!"}'
```

## ⚠️ Common Issues

| Issue | Solution |
|-------|----------|
| "unrecognized configuration parameter" | Run disable encryption SQL |
| "violates check constraint" | Add id_number (SA) or passport_number (foreign) |
| "duplicate key value" | Use different email |
| "Not authenticated" | Login first, save token |
| "Employee record not found" | Create employee before linking to auth |

## 📊 Test Status Checklist

- [ ] Database connection works
- [ ] Employee creation works (SA citizen)
- [ ] Employee creation works (foreigner)
- [ ] Signup creates auth user
- [ ] Login works with valid credentials
- [ ] Login fails with invalid credentials
- [ ] Get current user returns data
- [ ] Logout works
- [ ] Password validation works
- [ ] Error handling returns proper codes

## 🎯 Success Indicators

✅ **All Good When:**
- Database tests return 200 OK
- Employee creation returns employee data
- Login returns user + employee + session
- Error tests return appropriate error codes
- Response times < 2 seconds

❌ **Needs Fix When:**
- Database connection fails
- Employee creation fails with constraint errors
- Login always fails
- No error handling
- Response times > 5 seconds
