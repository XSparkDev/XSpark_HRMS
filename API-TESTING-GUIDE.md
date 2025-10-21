# X Spark HRMS API Testing Guide

## 🚀 **Quick Start Testing**

Your server is running on **http://localhost:3001** (port 3001 because 3000 was in use).

## 📋 **Testing Options**

### **Option 1: Postman Collection**
1. Import the `X-Spark-HRMS-Postman-Collection.json` file into Postman
2. Set the `base_url` variable to `http://localhost:3001`
3. Run the requests in order

### **Option 2: cURL Commands**
1. Use the commands in `api-test-commands.sh`
2. Copy and paste individual commands into your terminal
3. Or run the entire script: `bash api-test-commands.sh`

### **Option 3: Browser Testing**
Open these URLs directly in your browser:
- http://localhost:3001/api/employees
- http://localhost:3001/api/supabase/simple-test
- http://localhost:3001/api/employees/test

## 🧪 **Recommended Testing Sequence**

### **1. Database Connection Test**
```bash
curl -X POST http://localhost:3001/api/supabase/test \
  -H "Content-Type: application/json" \
  -d '{"testType": "database"}'
```
**Expected Response**: `{"success": true, "testType": "database", "result": "Database connection successful"}`

### **2. Create Test Employee**
```bash
curl -X POST http://localhost:3001/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@xspark.com",
    "dob": "1990-01-01",
    "sex": "male",
    "date_hired": "2025-01-01",
    "nationality": "South Africa",
    "employment_status": "probation"
  }'
```
**Expected Response**: Employee object with generated `id` and `employee_id`

### **3. Get All Employees**
```bash
curl -X GET http://localhost:3001/api/employees \
  -H "Accept: application/json"
```
**Expected Response**: Array with the employee you just created

### **4. Test Employee Service**
```bash
curl -X GET http://localhost:3001/api/employees/test \
  -H "Accept: application/json"
```
**Expected Response**: All 4 tests passing with 100% success rate

## 📊 **API Endpoints Available**

### **Employee Management**
- `GET /api/employees` - Get all employees
- `POST /api/employees` - Create employee
- `PUT /api/employees` - Update employee
- `GET /api/employees/{id}` - Get employee by ID

### **Leave Management**
- `GET /api/leave/requests` - Get leave requests
- `POST /api/leave/requests` - Create leave request

### **File Upload**
- `POST /api/upload` - Upload file
- `DELETE /api/upload` - Delete file

### **Database Tests**
- `GET /api/supabase/simple-test` - Test database schema
- `POST /api/supabase/test` - Test specific connections
- `GET /api/employees/test` - Test employee service

## 🔍 **Expected Responses**

### **Successful Employee Creation**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "employee_id": "XSP25/01/001",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@xspark.com",
    "is_active": true,
    "employment_status": "probation"
  },
  "message": "Employee created successfully"
}
```

### **Successful Employee List**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-here",
      "employee_id": "XSP25/01/001",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@xspark.com"
    }
  ],
  "meta": {
    "count": 1,
    "limit": 50,
    "offset": 0
  }
}
```

### **Database Test Success**
```json
{
  "success": true,
  "summary": {
    "totalTests": 5,
    "passedTests": 5,
    "failedTests": 0,
    "successRate": "100%"
  },
  "tests": {
    "roles": {"success": true, "hasData": true},
    "employees": {"success": true, "hasData": false},
    "jobTitles": {"success": true, "hasData": true},
    "leaveBalances": {"success": true, "hasData": false},
    "activeEmployeesView": {"success": true, "hasData": false}
  }
}
```

## ⚠️ **Troubleshooting**

### **Server Not Running**
```bash
npm run dev
```

### **Port Already in Use**
The server will automatically use port 3001 if 3000 is busy.

### **Database Connection Issues**
Check your `.env` file has the correct Supabase credentials:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_STORAGE_BUCKET`

### **Empty Responses**
Empty arrays are normal when no data exists yet. Create some test data first.

## 🎯 **Success Criteria**

✅ **Database Connection**: All connection tests pass  
✅ **Employee CRUD**: Create, read, update operations work  
✅ **Service Layer**: All 42 unit tests pass  
✅ **API Responses**: Proper JSON responses with success/error handling  
✅ **File Upload**: Storage integration works  

## 📝 **Notes**

- The database schema is fully functional
- All service layer methods are working
- API endpoints return proper HTTP status codes
- Error handling is implemented
- File upload/download is ready for testing

**Status**: ✅ **READY FOR TESTING**
