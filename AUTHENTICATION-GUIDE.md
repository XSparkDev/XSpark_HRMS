# Authentication System Guide

## 📋 Overview

The X Spark HRMS now has a complete authentication system integrated with Supabase Auth and the employee database.

## 🎯 Components Created

### **1. Auth Service** (`lib/services/auth-service.ts`)
Comprehensive authentication service with:
- Login/logout functionality
- Session management
- Password management
- Employee-auth integration
- Admin operations

### **2. API Endpoints**

#### **POST `/api/auth/login`**
Login with email and password.

**Request:**
```json
{
  "email": "john.smith@xspark.com",
  "password": "yourPassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { /* Auth user data */ },
    "employee": { /* Employee data */ },
    "session": { /* Session tokens */ }
  }
}
```

#### **POST `/api/auth/logout`**
Logout current user.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### **GET `/api/auth/me`**
Get current authenticated user with employee data.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { /* Auth user data */ },
    "employee": { /* Employee data */ },
    "session": { /* Session data */ }
  }
}
```

#### **POST `/api/auth/signup`**
Create new auth user (note: doesn't create employee).

**Request:**
```json
{
  "email": "new.user@xspark.com",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+27123456789"
}
```

#### **POST `/api/auth/reset-password`**
Request password reset or update password.

**Request (Reset):**
```json
{
  "email": "john.smith@xspark.com"
}
```

**Request (Update):**
```json
{
  "newPassword": "NewSecurePass123!"
}
```

## 🔧 Service Methods

### **Authentication**
```typescript
// Login
const authResponse = await authService.login({ 
  email: 'john@xspark.com', 
  password: 'password' 
})

// Logout
await authService.logout()

// Get current user
const user = await authService.getCurrentUser()

// Get current user with employee data
const userWithEmployee = await authService.getCurrentUserWithEmployee()
```

### **Employee + Auth Creation**
```typescript
// Create employee WITH login access
const { employee, authUser } = await authService.createEmployeeWithAuth(
  {
    first_name: "John",
    last_name: "Smith",
    email: "john.smith@xspark.com",
    dob: "1985-03-15",
    sex: "male",
    nationality: "South Africa",
    id_number: "8503151234567",
    date_hired: "2023-01-15"
  },
  "SecurePassword123!", // password
  true // send welcome email
)
```

### **Link Existing Employee to Auth**
```typescript
// Give existing employee login access
const { employee, authUser } = await authService.linkEmployeeToAuth(
  'employee-uuid',
  'SecurePassword123!'
)
```

### **Password Management**
```typescript
// Request password reset
await authService.requestPasswordReset('john@xspark.com')

// Change password
await authService.changePassword({
  currentPassword: 'oldPassword',
  newPassword: 'NewPassword123!'
})

// Validate password strength
const validation = authService.validatePasswordStrength('password123')
// Returns: { valid: boolean, errors: string[] }

// Generate random password
const randomPassword = authService.generateRandomPassword(12)
```

### **Admin Operations**
```typescript
// Get all auth users
const { users, total } = await authService.getAllAuthUsers(1, 50)

// Delete auth user
await authService.deleteAuthUser('user-uuid')

// Admin reset password
await authService.adminResetPassword('user-uuid', 'NewPassword123!')

// Update user email
await authService.updateUserEmail('user-uuid', 'newemail@xspark.com')
```

## 🎯 Testing the Authentication

### **1. Create Employee with Auth**
```bash
curl -X POST http://localhost:3000/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Smith",
    "email": "john.smith@xspark.com",
    "dob": "1985-03-15",
    "sex": "male",
    "nationality": "South Africa",
    "id_number": "8503151234567",
    "date_hired": "2023-01-15"
  }'
```

### **2. Link Employee to Auth** (using service)
```typescript
// In your code or API route
import { authService } from '@/lib/services/auth-service'

const result = await authService.linkEmployeeToAuth(
  'employee-id-from-step-1',
  'Password123!'
)
```

### **3. Test Login**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.smith@xspark.com",
    "password": "Password123!"
  }'
```

### **4. Get Current User**
```bash
curl -X GET http://localhost:3000/api/auth/me
```

### **5. Logout**
```bash
curl -X POST http://localhost:3000/api/auth/logout
```

## ⚠️ Important Notes

### **Employee vs Auth User**
- **Employee creation** (`POST /api/employees`) creates database record only
- **Auth creation** (`authService.createEmployeeWithAuth()`) creates both
- Existing employees can be linked to auth using `linkEmployeeToAuth()`

### **Password Requirements**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### **Security**
- Sessions are managed by Supabase Auth
- JWT tokens are used for authentication
- Row Level Security (RLS) should be configured in Supabase
- Admin operations require proper authentication

## 🔐 Next Steps

1. **Enable RLS Policies** in Supabase for `employees` table
2. **Configure Email Templates** in Supabase for password reset
3. **Set Environment Variable** `NEXT_PUBLIC_APP_URL` for password reset redirects
4. **Create Frontend Login Forms** to use these endpoints
5. **Add Middleware** to protect routes that require authentication

## 📚 Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [JWT Authentication](https://jwt.io/introduction)

## ✅ Features Included

- ✅ Login/Logout
- ✅ Session Management
- ✅ Password Reset
- ✅ Password Change
- ✅ Employee-Auth Integration
- ✅ Admin User Management
- ✅ Password Strength Validation
- ✅ Email Verification Support
- ✅ Random Password Generation
- ✅ Comprehensive Error Handling

---

**Created:** 2025-10-24  
**Version:** 1.0.0  
**Status:** Ready for Testing

