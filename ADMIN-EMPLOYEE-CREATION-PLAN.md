# Admin Employee Creation Implementation Plan

## Overview
Implement a unified admin endpoint that creates both Supabase Auth user and employee record atomically, with proper validation, rollback, and encryption.

---

## Implementation Phases

### Phase 1: Service Layer Foundation
**Goal:** Create the core service method with all and business logic

#### 1.1 Early Email Uniqueness Check
- [x] Create `checkEmailUniqueness(email: string)` method
  - Check Supabase Auth via `supabaseAdmin.auth.admin.listUsers()` 
  - Check employees table via `employeeService.getByEmail(email)`
  - Return clear error messages:
    - "Email already registered in authentication system" (409)
    - "Email already exists in employee records" (409)
- [x] Integrate check into creation flow before auth user creation

#### 1.2 Encryption Migration (Backend Service)
- [x] Update `employeeService.create()` to encrypt `id_number` and `tax_number` before insert
  - Use `lib/crypto.ts` `encrypt()` function
  - Store encrypted values, remove plaintext from payload
- [x] Create SQL migration script to disable DB encryption trigger
  - Document as fallback option
  - Add note about trigger re-enable procedure

#### 1.3 Create Employee with Auth Service Method
- [x] Extend/enhance `authService.createEmployeeWithAuth()` with:
  - Input (required fields, SA vs foreign rules, password strength)
  - Early email uniqueness check
  - Create Supabase Auth user (service role)
    - Set `email_confirm = !options.sendEmail`
    - Set `user_metadata` (first_name, last_name, phone)
  - Encrypt sensitive fields (id_number, tax_number) before employee insert
  - Create employee record with `auth_user_id` linked
  - Sync `employee_id` back to auth user metadata
  - Rollback: Delete auth user if employee creation fails
  - Return `{ employee, authUser }`

#### 1.4 Foreign National Validation
- [x] Add logic:
  - If `nationality !== 'South Africa'`:
    - Require `passport_number`
    - Optional: require `work_permit_url`
    - Set `work_permit_verified = false` by default
  - If `nationality === 'South Africa'`:
    - Require `id_number` (13 digits)

---

### Phase 2: API Endpoint
**Goal:** Create admin endpoint that uses the service

#### 2.1 Create Admin Endpoint
- [x] Create `app/api/admin/employees/route.ts`
- [x] Implement `POST /api/admin/employees`
  - Accept request body:
    ```typescript
    {
      employee: CreateEmployeeData,
      password: string,
      options?: { sendEmail?: boolean }
    }
    ```
  - Validate request body with Zod schema
  - Call `authService.createEmployeeWithAuth()`
  - Return 201 with `{ success: true, data: { employee, authUser } }`
  - Handle errors: 400 (validation), 409 (email conflict), 500 (server)
- [x] **No admin guard yet** (deferred to future additions)

---

### Phase 3: Testing & Documentation
**Goal:** Ensure reliability and provide usage examples

#### 3.1 Unit Tests
- [ ] Test happy path (SA national with ID)
- [ ] Test happy path (foreign national with passport)
- [ ] Test email uniqueness check (Auth conflict)
- [ ] Test email uniqueness check (Employee conflict)
- [ ] Test rollback scenario (auth created, employee fails)
- [ ] Test errors (missing required fields)
- [ ] Test SA vs foreign nationality rules

#### 3.2 Postman Collection
- [x] Add example request to Postman collection:
  ```json
  POST /api/admin/employees
  {
    "employee": {
      "first_name": "Jane",
      "last_name": "Doe",
      "email": "jane.doe@example.com",
      "dob": "1992-05-10",
      "sex": "female",
      "nationality": "South Africa",
      "id_number": "9205101234567",
      "date_hired": "2025-11-01",
      "employment_status": "probation"
    },
    "password": "SecurePass123!",
    "options": { "sendEmail": false }
  }
  ```
- [x] Add example for foreign national (passport)
- [x] Document error responses

---

## Technical Decisions Made

### ✅ Early Email Check
**Decision:** Check both Supabase Auth (`listUsers()`) and employees table
**Rationale:** Prevents orphaned records and provides clear error messages

### ✅ Backend Encryption Service
**Decision:** Migrate from DB trigger to backend service using `lib/crypto.ts`
**Rationale:** Better key management, easier debugging, consistent with codebase
**Action:** Disable DB trigger, encrypt in service layer before insert

### ✅ Audit Logging
**Decision:** Keep DB trigger for now (works with service role)
**Rationale:** Automatic, cannot be bypassed, sufficient for current needs
**Future:** Re-evaluate if app-level logging or external systems needed

### ✅ Rollback Strategy
**Decision:** Backend service function (not stored procedure)
**Implementation:** Delete auth user via `supabaseAdmin.auth.admin.deleteUser()` if employee insert fails
**Location:** In `authService.createEmployeeWithAuth()` try/catch block

### ✅ Admin Access Control
**Decision:** Deferred to future additions
**Rationale:** No admin users yet, testing phase
**File:** `/future-additions/admin-access-control.md`

### ✅ Sync Auth Metadata
**Decision:** Implement now - sync `employee_id` to auth user metadata
**Rationale:** Makes `employee_id` available in JWT/user metadata for frontend use
**Implementation:** Update auth user after employee creation succeeds

### ✅ Email Flow
**Decision:** Support both options via `options.sendEmail`
- `sendEmail: true` → `email_confirm: false` (trigger invite email)
- `sendEmail: false` → `email_confirm: true` (auto-confirm, immediate login)

---

## Files to Create/Modify

### New Files
- [x] `app/api/admin/employees/route.ts` - Admin endpoint
- [x] `future-additions/admin-access-control.md` ✅ (already created)
- [x] `future-additions/idempotency-keys.md` ✅ (already created)
- [x] `database/disable-encryption-trigger.sql` - SQL migration script
- [x] `ADMIN-EMPLOYEE-CREATION-POSTMAN.md` - Postman documentation

### Modified Files
- [x] `lib/services/auth-service.ts` - Enhance `createEmployeeWithAuth()`
- [x] `lib/services/employee-service.ts` - Add encryption to `create()`
- [x] `lib/supabase-admin.ts` - Service role client created

---

## Error Handling Strategy

### Errors (400)
- Missing required fields
- Invalid email format
- Invalid date format
- Invalid ID number format (SA)
- Missing passport (foreign)
- Password doesn't meet strength requirements

### Conflict Errors (409)
- Email exists in Auth
- Email exists in employees table

### Server Errors (500)
- Auth user creation failed
- Employee creation failed
- Rollback failed (logged, but return original error)

---

## Success Criteria

✅ One API call creates both auth user and employee  
✅ Early email check prevents conflicts before creation  
✅ Encryption happens in backend service (no DB trigger)  
✅ Rollback works: auth user deleted if employee fails  
✅ Foreign nationals validated (passport required)  
✅ SA nationals validated (ID number required)  
✅ `employee_id` synced to auth user metadata  
✅ Clear error messages for all failure scenarios  
✅ Postman examples work end-to-end  

---

## Implementation Order

1. **Early email check** (Foundation)
2. **Encryption migration** (Foundation)
3. **Service method** (`createEmployeeWithAuth` enhancement)
4. **API endpoint** (`/api/admin/employees`)
5. **Testing & Documentation**

---

## Notes

- All database operations use `supabaseAdmin` (service role) to bypass RLS
- Encryption key managed via `ENCRYPTION_KEY` env var (Node.js)
- DB trigger for encryption disabled but documented for fallback
- Admin access control deferred - endpoint open for testing
- Audit logging remains automatic via DB trigger (no code changes needed)

---

**Status:** ✅ Implementation Complete - Ready for Testing  
**Priority:** High  
**Estimated Complexity:** Medium

## What Was Implemented

### Phase 1: Service Layer ✅
- ✅ Early email uniqueness check (Auth + employees table)
- ✅ Encryption migration (backend service using `lib/crypto.ts`)
- ✅ Enhanced `createEmployeeWithAuth()` with and rollback
- ✅ Foreign national (passport requirement)
- ✅ Metadata sync (employee_id to auth user)
- ✅ SQL script to disable DB encryption trigger

### Phase 2: API Endpoint ✅
- ✅ Created `/api/admin/employees` POST endpoint
- ✅ Zod for request body
- ✅ Error handling (400, 409, 500)
- ✅ No admin guard (deferred)

### Phase 3: Documentation ✅
- ✅ Postman guide with examples (SA and foreign)
- ✅ Error response documentation
- ✅ Testing checklist

### Remaining Work
- [ ] Unit/integration tests (Phase 3.1)
- [ ] Run SQL migration to disable DB trigger
- [ ] Test in Postman
- [ ] Verify encryption in database

## Next Steps

1. **Run SQL migration:**
   ```bash
   # In Supabase SQL Editor
   # Run: database/disable-encryption-trigger.sql
   ```

2. **Test in Postman:**
   - Use examples from `ADMIN-EMPLOYEE-CREATION-POSTMAN.md`
   - Test SA employee creation
   - Test foreign employee creation
   - Verify email conflict handling

3. **Verify:**
   - Check `encrypted_id_number` and `encrypted_tax_number` in database
   - Confirm auth user metadata contains `employee_id`
   - Test rollback by forcing employee insert failure

