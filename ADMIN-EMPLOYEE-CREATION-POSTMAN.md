# Admin Employee Creation - Postman Guide

## Overview
This guide provides Postman examples for creating employees with authentication via the admin endpoint.

---

## Endpoint

**POST** `/api/admin/employees`

Creates both a Supabase Auth user and employee record atomically with proper validation, rollback, and encryption.

---

## Example 1: South African Employee

### Request
```http
POST http://localhost:3000/api/admin/employees
Content-Type: application/json
```

### Body
```json
{
  "employee": {
    "first_name": "Thabo",
    "middle_name": "James",
    "last_name": "Ndlovu",
    "preferred_name": "TJ",
    "id_number": "9205101234567",
    "dob": "1992-05-10",
    "sex": "male",
    "gender": "male",
    "pronouns": "he/him",
    "email": "thabo.ndlovu@xspark.com",
    "phone": "+27812345678",
    "alternative_phone": "+27119876543",
    "address": "123 Main Road, Johannesburg, 2001",
    "tax_number": "1234567890",
    "nationality": "South Africa",
    "employment_status": "probation",
    "date_hired": "2025-11-01"
  },
  "password": "SecurePass123!",
  "options": {
    "sendEmail": false
  }
}
```

### Success Response (201)
```json
{
  "success": true,
  "data": {
    "employee": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "auth_user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "first_name": "Thabo",
      "middle_name": "James",
      "last_name": "Ndlovu",
      "preferred_name": "TJ",
      "employee_id": "XSP25/11/001",
      "email": "thabo.ndlovu@xspark.com",
      "phone": "+27812345678",
      "nationality": "South Africa",
      "employment_status": "probation",
      "date_hired": "2025-11-01",
      "id_verified": false,
      "work_permit_verified": false,
      "bank_verified": false,
      "is_active": true,
      "created_at": "2025-10-31T12:00:00.000Z",
      "updated_at": "2025-10-31T12:00:00.000Z"
    },
    "authUser": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "email": "thabo.ndlovu@xspark.com",
      "created_at": "2025-10-31T12:00:00.000Z"
    }
  },
  "message": "Employee created successfully with authentication"
}
```

---

## Example 2: Foreign National Employee

### Request
```http
POST http://localhost:3000/api/admin/employees
Content-Type: application/json
```

### Body
```json
{
  "employee": {
    "first_name": "John",
    "last_name": "Smith",
    "email": "john.smith@xspark.com",
    "dob": "1985-03-15",
    "sex": "male",
    "gender": "male",
    "phone": "+27823456789",
    "nationality": "United Kingdom",
    "passport_number": "GB123456789",
    "passport_document_url": "https://storage.example.com/passports/john-smith.pdf",
    "work_permit_url": "https://storage.example.com/permits/john-smith-permit.pdf",
    "employment_status": "probation",
    "date_hired": "2025-11-01"
  },
  "password": "UKEmployee2025!",
  "options": {
    "sendEmail": false
  }
}
```

### Success Response (201)
Same structure as Example 1, but `work_permit_verified` will be `false` by default.

---

## Example 3: With Email Invitation

### Body
```json
{
  "employee": {
    "first_name": "Sarah",
    "last_name": "Williams",
    "email": "sarah.williams@xspark.com",
    "dob": "1990-07-22",
    "sex": "female",
    "nationality": "South Africa",
    "id_number": "9007221234567",
    "employment_status": "probation",
    "date_hired": "2025-11-01"
  },
  "password": "TempPassword123!",
  "options": {
    "sendEmail": true
  }
}
```

**Note:** When `sendEmail: true`, Supabase will send a verification email to the employee. They must click the link before logging in.

---

## Error Responses

### 400 - Validation Error
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "type": "string",
      "inclusive": true,
      "exact": false,
      "message": "String must contain at least 1 character(s)",
      "path": ["employee", "first_name"]
    }
  ]
}
```

### 400 - Missing Required Field (SA)
```json
{
  "success": false,
  "error": "South African employees must provide a valid 13-digit ID number"
}
```

### 400 - Missing Required Field (Foreign)
```json
{
  "success": false,
  "error": "Foreign nationals must provide a passport number"
}
```

### 400 - Password Validation Failed
```json
{
  "success": false,
  "error": "Password validation failed: Password must contain at least one uppercase letter, Password must contain at least one special character"
}
```

### 409 - Email Already Exists (Auth)
```json
{
  "success": false,
  "error": "Email already registered in authentication system"
}
```

### 409 - Email Already Exists (Employee)
```json
{
  "success": false,
  "error": "Email already exists in employee records"
}
```

### 500 - Server Error
```json
{
  "success": false,
  "error": "Failed to create employee with authentication"
}
```

---

## Field Requirements

### Required Fields (All Employees)
- `first_name`
- `last_name`
- `email`
- `dob` (format: YYYY-MM-DD)
- `sex` (male/female)
- `date_hired` (format: YYYY-MM-DD)
- `password` (min 8 chars, must include: uppercase, lowercase, number, special char)

### Required Fields (South African)
- `nationality: "South Africa"`
- `id_number` (exactly 13 digits)

### Required Fields (Foreign Nationals)
- `nationality` (not "South Africa")
- `passport_number`

### Optional Fields
- `middle_name`
- `preferred_name`
- `gender` (male/female/other/prefer_not_to_say)
- `pronouns`
- `job_title_id` (UUID)
- `role_id` (UUID)
- `phone`
- `alternative_phone`
- `address`
- `tax_number`
- `passport_document_url` (for foreign nationals)
- `work_permit_url` (for foreign nationals)
- `employment_status` (default: "probation")
- `profile_picture_url`

---

## Features

✅ **Early Email Check** - Validates email uniqueness before creation  
✅ **Encryption** - Automatically encrypts `id_number` and `tax_number`  
✅ **Rollback** - Deletes auth user if employee creation fails  
✅ **Validation** - SA vs foreign nationality rules enforced  
✅ **Password Strength** - Enforces strong password requirements  
✅ **Metadata Sync** - Syncs `employee_id` to auth user metadata  
✅ **Email Options** - Support for invite emails or auto-confirm  
✅ **Audit Logging** - Automatic via database trigger  

---

## Testing Checklist

- [ ] Create SA employee with valid ID number
- [ ] Create foreign employee with passport
- [ ] Test with `sendEmail: true`
- [ ] Test with `sendEmail: false`
- [ ] Verify email conflict (Auth)
- [ ] Verify email conflict (Employee)
- [ ] Test missing required fields
- [ ] Test invalid ID number format
- [ ] Test weak password
- [ ] Verify rollback on failure
- [ ] Check encrypted fields in database
- [ ] Verify `employee_id` in auth metadata

---

## Notes

- **No Admin Guard:** Currently open for testing. Admin access control will be added later (see `/future-additions/admin-access-control.md`)
- **Service Role:** All operations use service role to bypass RLS
- **Employee ID:** Auto-generated by database (format: `XSP<YY>/<MM>/<NNN>`)
- **Encryption:** Uses AES-256-GCM via `lib/crypto.ts` (not DB trigger)
- **Audit:** Logged automatically via DB trigger on `employees` table

---

## Import to Postman

1. Create a new request in Postman
2. Set method to **POST**
3. Set URL to `http://localhost:3000/api/admin/employees`
4. Set Headers: `Content-Type: application/json`
5. Paste body from examples above
6. Click **Send**

---

**Status:** ✅ Ready for testing  
**Last Updated:** 2025-10-31

