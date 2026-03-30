# Audit Log Inventory — XSpark HRMS

A single list of everything in the application that is **currently loggable (audit log)** and what is **loggable/auditable** by area. Use this for compliance (e.g. POPIA), security reviews, and to extend the audit system.

This inventory is intended to be **exhaustive for all current production APIs under `app/api` and core services in `lib/services`** as of 2026‑03‑13. Explicit dev/test tooling routes (for example: `/api/employees/debug`, `/api/employees/test`, `/api/supabase/*-test`, `/api/supabase/view-test`, `/api/supabase/schema`) are **out of scope** and should not be enabled in production; if they are, treat them as admin tooling and log access to them via the same patterns used for other sensitive admin operations.

---

## 1. Currently implemented (audit-logged)

### 1.1 Profile API (`/api/profile`, `lib/crypto.logAuditEvent`)

| Action / event              | Audit event name                     | Severity  | Where |
|-----------------------------|--------------------------------------|-----------|--------|
| Profile creation success    | `profile_created`                    | high      | POST success |
| Profile creation error      | `profile_creation_error`             | critical  | POST catch |
| Profile validation failed   | `profile_validation_failed`         | medium    | POST validation fail |
| Profile read (accessed)     | `profile_accessed`                  | low       | GET success |
| Profile retrieval error     | `profile_retrieval_error`            | critical  | GET catch |
| Profile update success      | `profile_updated`                   | high      | PUT success |
| Profile update validation   | `profile_update_validation_failed`  | medium    | PUT validation fail |
| Profile update error        | `profile_update_error`              | critical  | PUT catch |
| Profile deletion success    | `profile_deleted`                   | critical  | DELETE success |
| Profile deletion error      | `profile_deletion_error`            | critical  | DELETE catch |

**Details logged:** `userId`, `employeeId` (when relevant), `ip`, `userAgent`, `errors` (validation), `sensitiveFieldsChanged` (updates).

---

### 1.2 Re-authentication API (`/api/reauth`, `lib/crypto.logAuditEvent`)

| Action / event           | Audit event name                     | Severity  | Where |
|--------------------------|--------------------------------------|-----------|--------|
| Reauth password failure  | `reauth_password_failed`            | high      | POST invalid password |
| Reauth 2FA failure       | `reauth_2fa_failed`                 | high      | POST invalid 2FA |
| Reauth success           | `reauth_successful`                 | high      | POST success |
| Reauth generic error     | `reauth_error`                      | critical  | POST catch |
| Session verified         | `reauth_session_verified`           | medium    | GET success |
| Session verification err | `reauth_session_verification_error` | critical  | GET catch |
| Session revoked          | `reauth_session_revoked`            | medium    | DELETE success |
| Session revocation err   | `reauth_session_revocation_error`   | critical  | DELETE catch |

**Sensitive operations** that trigger reauth (and thus these events):  
`update_id_number`, `update_tax_number`, `update_passport_number`, `update_banking_details`, `delete_profile`, `update_sensitive_data`.

**Details logged:** `userId`, `operation`, `sessionToken` (hashed), `ip`, `userAgent`, `error`.

---

### 1.3 Document access (`lib/services/documents-service.logDocumentAccess`)

| Action   | Logged as | Where called |
|----------|-----------|---------------|
| Upload   | `"upload"`  | After new document upload; after version upload |
| Delete   | `"delete"`  | Soft delete and permanent delete |
| Download | `"download"`| `downloadDocument()` |

**Note:** Implemented as **console.log** only (“Document access logged: …”). No persistence to DB or external logger. `getDocumentAccessLogs()` / `getAllAccessLogs()` return `[]`. UI “Audit History” tab shows nothing until a real access log store exists.

---

### 1.4 Database-level audit (Supabase/Postgres)

#### 1.4.1 `audit_logs` table (schema: `database-schema.md`, `database/complete-schema.sql`)

**Action type enum:** `created`, `updated`, `approved`, `rejected`, `deleted`, `archived`, `restored`, `escalated`, `resolved`.  
**Severity enum:** `low`, `high`, `critical`.

| Target / trigger                    | Action types recorded        | Table / trigger name |
|------------------------------------|------------------------------|------------------------|
| Employee record changes            | created, updated, deleted    | `audit_employee_changes_trigger` on `employees` |
| Leave request changes              | created, updated, approved, rejected | `audit_leave_request_changes_trigger` on `leave_requests` |

**Typical fields:** `employee_id`, `employee_name`, `employee_number`, `action`, `action_type`, `severity`, `target_table`, `target_record_id`, `previous_value`, `new_value`, `description`, `published_by`, `published_by_system`, `created_at`.

#### 1.4.2 `notes_audit_log` table (legacy `notes` only; `database/notes-schema.sql`)

| Action             | When |
|--------------------|------|
| `create`           | INSERT on `notes` |
| `edit`             | UPDATE on `notes` (when visibility unchanged) |
| `visibility_change`| UPDATE on `notes` (when visibility changed) |
| `delete`           | DELETE on `notes` |

**Trigger:** `trigger_log_note_changes` (calls `insert_notes_audit_log`).  
**Stored:** `note_id`, `actor_id`, `actor_role`, `action`, `previous_value`, `new_value`, `ip_address`, `user_agent`, `created_at`.

#### 1.4.3 Leave accrual history (audit-style table, not “audit log” API)

| Concept | Table | Purpose |
|---------|--------|---------|
| Accrual events | `leave_accrual_history` | When leave was added: `employee_id`, `leave_type_id`, `balance_id`, `accrual_date`, `amount`, `accrual_reason`, `notes`. |

---

## 2. Loggable but not yet fully audited (candidates)

These are areas where the app performs meaningful actions that are **loggable** and should be considered for a unified audit log.

### 2.1 Authentication

| Event / action        | Suggested event name / scope        | Where it happens |
|-----------------------|-------------------------------------|-------------------|
| Login success         | e.g. `auth_login_success`           | `lib/services/auth-service.ts` signIn |
| Login failure         | e.g. `auth_login_failed`            | signIn error paths |
| Logout                | e.g. `auth_logout`                 | logout |
| Signup / create user  | e.g. `auth_signup`                | createEmployeeWithAuth, signUp |
| Password reset request| e.g. `auth_password_reset_request` | requestPasswordReset |
| Password update       | e.g. `auth_password_updated`      | updatePassword, changePassword |
| Session refresh       | e.g. `auth_session_refreshed`      | refreshSession |
| Auth user deleted     | e.g. `auth_user_deleted`           | deleteAuthUser |
| Auth user email change| e.g. `auth_email_updated`          | updateUserEmail |
| Employee linked/unlinked to auth | e.g. `auth_employee_linked` / `auth_employee_unlinked` | linkEmployeeToAuth, unlinkEmployeeFromAuth |

**Note:** No `logAuditEvent` (or equivalent) in auth routes or auth-service today; only `console.error` / `console.log` in error paths.

---

### 2.2 Employees

| Event / action       | Suggested event name / scope   | Where it happens |
|----------------------|--------------------------------|-------------------|
| Employee created     | Already in DB via trigger      | `POST /api/employees`, employeeService.create |
| Employee updated     | Already in DB via trigger      | `PUT /api/employees/[id]`, employeeService.update |
| Employee archived    | Already in DB (if trigger fires on status change) | `PUT /api/employees/[id]` archive |
| Employee restored    | Same as above                  | restore endpoint |
| Employee fetched by ID | e.g. `employee_viewed` (sensitive) | GET `/api/employees/[id]` |
| Next of kin upsert   | e.g. `next_of_kin_updated`     | Next-of-kin API / profile save |
| Role assignment      | e.g. `employee_role_assigned`   | `POST /api/admin/employees/assign-roles` |
| ID / bank / work permit verified | e.g. `employee_verification_updated` | employeeService verifyId, verifyBankDetails, verifyWorkPermit |

**Note:** DB trigger covers row-level employee changes; API-level audit would add actor (who called the API), IP, and timestamp.

---

### 2.3 Leave

| Event / action        | Suggested event name / scope   | Where it happens |
|-----------------------|--------------------------------|-------------------|
| Leave request created | Already in DB via trigger      | POST `/api/leave/requests` |
| Leave request approved/rejected/cancelled | Already in DB via trigger | PUT `/api/leave/requests` |
| Leave balances read   | e.g. `leave_balances_viewed`   | GET leave balances/available APIs |
| Accrual backfill run  | e.g. `leave_accrual_backfill_run` | POST `/api/leave/accruals/backfill` |

---

### 2.4 Notes (Notes2)

| Event / action   | Suggested event name / scope | Where it happens |
|------------------|------------------------------|-------------------|
| Note created     | e.g. `notes2_created`        | POST `/api/notes2`, notes2-service createNote |
| Note updated     | e.g. `notes2_updated`        | PATCH `/api/notes2/[noteId]` |
| Note deleted     | e.g. `notes2_deleted`        | DELETE `/api/notes2/[noteId]` |
| Scheduled notes fetched | e.g. `notes2_scheduled_viewed` | GET scheduled API / dashboard |

**Note:** Legacy `notes` table has `notes_audit_log`; Notes2 uses a different table and has **no** DB audit trigger or `logAuditEvent` calls.

---

### 2.5 Documents

| Event / action     | Suggested event name / scope | Where it happens |
|--------------------|------------------------------|-------------------|
| Document upload   | Already “logged” via console | documents-service, `/api/documents/upload-file`, `/api/documents/upload` |
| Document metadata update | e.g. `document_updated` | PUT `/api/documents`, documents-service update |
| Document delete   | Already “logged” via console | documents-service delete / permanentlyDelete |
| Document download | Already “logged” via console | documents-service downloadDocument |
| Document list fetched | e.g. `documents_list_viewed` (optional) | GET documents |

**Gap:** All document “audit” is console only; no DB or central log.

---

### 2.6 HR tickets / cases

| Event / action   | Suggested event name / scope | Where it happens |
|------------------|------------------------------|-------------------|
| Ticket created   | e.g. `hr_ticket_created`     | POST `/api/hr-tickets` |

---

### 2.7 Chatbot / AI chat

| Event / action     | Suggested event name / scope | Where it happens |
|--------------------|------------------------------|-------------------|
| Chat session created  | e.g. `chat_session_created`  | ai-chat-widget, backend chat route |
| Chat message sent     | e.g. `chat_message_sent`     | Same |
| Chat session closed   | e.g. `chat_session_closed`   | Same |

---

### 2.8 Sensitive / decrypted data access

| Event / action        | Suggested event name / scope | Where it happens |
|-----------------------|------------------------------|-------------------|
| Decrypted profile read (ID/tax etc.) | e.g. `profile_decrypted_accessed` | GET `/api/profile/decrypted` |

---

### 2.9 Roles and admin

| Event / action   | Suggested event name / scope | Where it happens |
|------------------|------------------------------|-------------------|
| Roles list read  | e.g. `roles_list_viewed`     | GET `/api/roles` |
| Authenticated user profile read | e.g. `auth_me_viewed` | GET `/api/auth/me` (optional) |

---

### 2.10 Other API / system

| Area                                   | Examples of loggable events / suggested names                          | Where it happens |
|----------------------------------------|-------------------------------------------------------------------------|------------------|
| Job titles                             | List read (`job_titles_list_viewed`), create/update (`job_title_updated`) | `/api/job-titles` |
| Next-of-kin                            | Upsert (`next_of_kin_updated`)                                         | `/api/next-of-kin/upsert` |
| Rooms                                  | Create/update/delete (`room_updated`), list read (`rooms_list_viewed`) | `/api/rooms` |
| Resources                              | Create/update/delete (`resource_updated`), list read (`resources_list_viewed`) | `/api/resources` |
| Devices                                | Create/update/delete (`device_updated`), list read (`devices_list_viewed`) | `/api/devices` |
| Assigned devices                       | Assign/unassign (`device_assigned` / `device_unassigned`), list read (`assigned_devices_list_viewed`) | `/api/assigned-devices` |
| Generic file upload                    | Upload (`generic_upload_created`) — consider consolidating with Documents | `/api/upload` |
| Chatbot references                     | References list/view (`chat_references_viewed`)                        | `/api/chatbot/references` |
| Notes (legacy) dashboard               | Dashboard data read (`notes_dashboard_viewed`)                          | `/api/notes/dashboard` |
| Employees “simple create”              | Simplified employee create (`employee_simple_created`)                 | `/api/employees/simple-create` |
| Supabase encryption key management     | Encryption key set/updated (`supabase_encryption_key_set`) — **critical** | `/api/supabase/set-encryption-key` |
| Supabase schema / debug / test routes  | Admin tooling access (`supabase_admin_tool_accessed`) — only if exposed in production | `/api/supabase/*` (schema/test/view/simple-test) |

---

### 2.11 Payroll (income, payslips, reporting)

The payroll domain currently lives in `lib/services/payroll-service.ts` and is accessed by the UI rather than dedicated API routes, but the underlying actions are log-worthy and should be included in the unified audit log.

| Event / action                            | Suggested event name / scope                 | Where it happens |
|-------------------------------------------|----------------------------------------------|------------------|
| Income record read                        | e.g. `payroll_income_viewed`                 | `payrollService.getIncome` |
| Income created/updated (upsert)           | e.g. `payroll_income_upserted`               | `payrollService.upsertIncome` |
| Basic salary updated                      | e.g. `payroll_basic_salary_updated`          | `payrollService.updateBasicSalary` |
| Bonus updated                             | e.g. `payroll_bonus_updated`                 | `payrollService.addBonus` |
| Overtime updated                          | e.g. `payroll_overtime_updated`              | `payrollService.addOvertime` |
| Payslips list/read                        | e.g. `payslips_viewed`                       | `payrollService.getPayslips`, `getPayslipsByEmployee` |
| Single payslip read                       | e.g. `payslip_viewed`                        | `payrollService.getPayslipById`, `getLatestPayslip` |
| Payslip generated for employee            | e.g. `payslip_generated`                     | `payrollService.generatePayslip` |
| Payslips generated for all employees      | e.g. `payslips_bulk_generated`               | `payrollService.generateAllPayslips` |
| Payroll summary report viewed             | e.g. `payroll_summary_viewed`                | `payrollService.getPayrollSummary` |
| Payslip statistics viewed                 | e.g. `payslip_statistics_viewed`             | `payrollService.getPayslipStatistics` |

For all payroll events, ensure the audit log captures: `employee_id` (where applicable), the acting user (`actor_id`), `action`, `previous_value` / `new_value` for key monetary fields (at least for salary/bonus/overtime), and `severity` (usually `high` for monetary changes).

## 3. Infrastructure summary

| Mechanism | Scope | Persistence |
|-----------|--------|-------------|
| `logAuditEvent()` in `lib/crypto.ts` | Profile + Reauth only | Console in dev; production hook (e.g. Winston/CloudWatch) is commented out |
| `logDocumentAccess()` in documents-service | Document upload, delete, download | Console only; no DB |
| `audit_logs` + triggers | Employees, leave_requests | Persisted in Postgres |
| `notes_audit_log` + trigger | Legacy `notes` table only | Persisted in Postgres |
| `leave_accrual_history` | Accrual events | Persisted in Postgres |

---

## 4. Single consolidated list of “audit log” events

**Already implemented (app or DB):**

- profile_validation_failed  
- profile_created  
- profile_creation_error  
- profile_accessed  
- profile_retrieval_error  
- profile_update_validation_failed  
- profile_updated  
- profile_update_error  
- profile_deleted  
- profile_deletion_error  
- reauth_password_failed  
- reauth_2fa_failed  
- reauth_successful  
- reauth_error  
- reauth_session_verified  
- reauth_session_verification_error  
- reauth_session_revoked  
- reauth_session_revocation_error  
- document_access (upload | delete | download) — console only  
- employee (created | updated | deleted) — DB trigger → `audit_logs`  
- leave_request (created | updated | approved | rejected) — DB trigger → `audit_logs`  
- notes (create | edit | delete | visibility_change) — DB trigger → `notes_audit_log` (legacy notes only)  
- leave_accrual_history rows — accrual audit trail (separate table)

**Recommended to add (loggable, not yet audited):**

- auth_login_success / auth_login_failed  
- auth_logout  
- auth_signup  
- auth_password_reset_request / auth_password_updated  
- auth_session_refreshed  
- auth_user_deleted / auth_email_updated  
- auth_employee_linked / auth_employee_unlinked  
- employee_viewed (sensitive)  
- next_of_kin_updated  
- employee_role_assigned  
- employee_verification_updated  
- leave_balances_viewed (optional)  
- leave_accrual_backfill_run  
- notes2_created / notes2_updated / notes2_deleted  
- notes2_high_alert_viewed  
- document_updated (metadata)  
- documents_list_viewed (optional)  
- hr_ticket_created  
- chat_session_created / chat_message_sent / chat_session_closed  
- chat_references_viewed  
- profile_decrypted_accessed  
- roles_list_viewed  
- job_titles_list_viewed / job_title_updated  
- rooms_list_viewed / room_updated  
- resources_list_viewed / resource_updated  
- devices_list_viewed / device_updated  
- assigned_devices_list_viewed / device_assigned / device_unassigned  
- generic_upload_created (if not covered by document access)  
- supabase_encryption_key_set  
- supabase_admin_tool_accessed (for schema/debug/test tooling if enabled in production)  
- payroll_income_viewed / payroll_income_upserted  
- payroll_basic_salary_updated / payroll_bonus_updated / payroll_overtime_updated  
- payslips_viewed / payslip_viewed / payslips_bulk_generated  
- payroll_summary_viewed / payslip_statistics_viewed  

Use this list to drive implementation of a unified audit log (e.g. writing to `audit_logs` or a dedicated audit service) and to ensure all sensitive actions are covered for compliance.
