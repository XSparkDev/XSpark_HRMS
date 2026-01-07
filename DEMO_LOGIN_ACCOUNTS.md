# Demo Login Accounts

This document lists all the demo login accounts available for testing the XSpark HRMS & Asset Management System.

## Quick Access

The login page (`/login`) includes:
- **Auto-fill dropdown**: Select an account to auto-fill credentials
- **Quick login buttons**: Click to login directly with one click
- **Full login form**: Manual entry for any account

## Demo Accounts

### 1. Supervisor Account
- **Email**: `wegecev800@gyknife.com`
- **Password**: `SecurePass123!`
- **Role**: `supervisor`
- **Access**: Full AMS access with approvals
- **Dashboard**: `/ams-supervisor`
- **Permissions**: Can perform all AMS employee actions plus approvals/overrides

### 2. Employee Account
- **Email**: `hehop16671@keevle.com`
- **Password**: `SecurePass123!`
- **Role**: `employee`
- **Access**: Standard employee access
- **Dashboard**: `/ams-dashboard`
- **Permissions**: 
  - View own profile
  - Request leave
  - Upload documents
  - View payslips
  - AMS: View devices, Book rooms

### 3. HR Manager Account
- **Email**: `hr.manager@xspark.com`
- **Password**: `SecurePass123!`
- **Role**: `hr_manager`
- **Access**: HR management access
- **Dashboard**: `/dashboard`
- **Permissions**:
  - All employee permissions
  - View employees
  - Approve leave
  - Verify documents
  - Edit employees
  - Manage users
  - View reports

### 4. Admin Account
- **Email**: `admin@xspark.com`
- **Password**: `SecurePass123!`
- **Role**: `admin`
- **Access**: Full system access
- **Dashboard**: `/dashboard`
- **Permissions**: All permissions (`*`)

### 5. Super Admin Account
- **Email**: `superadmin@xspark.com`
- **Password**: `SecurePass123!`
- **Role**: `super_admin`
- **Access**: Complete system control
- **Dashboard**: `/dashboard`
- **Permissions**: All permissions (`*`)

## Password

All demo accounts use the same password:
```
SecurePass123!
```

This password is consistent across all roles for easy testing.

## Setup Instructions

### Prerequisites
These accounts must exist in your Supabase Auth system. To create them:

1. **Using Supabase Dashboard**:
   - Go to Authentication → Users
   - Click "Add User" → "Create new user"
   - Enter email and password
   - Set email as confirmed

2. **Using API** (Recommended):
   - Use the `authService.createEmployeeWithAuth()` method
   - Or use the admin API endpoints

3. **Using SQL** (Direct database):
   ```sql
   -- Note: This requires Supabase service role access
   -- Use authService methods instead for production
   ```

### Creating Demo Accounts via API

You can create these accounts programmatically using the auth service:

```typescript
import { authService } from '@/lib/services/auth-service'

// Example: Create supervisor account
await authService.createEmployeeWithAuth({
  email: 'supervisor@xspark.com',
  first_name: 'Supervisor',
  last_name: 'User',
  dob: '1990-01-01',
  sex: 'Male',
  date_hired: '2024-01-01',
  // ... other required fields
}, 'Supervisor123!', { sendEmail: false })
```

## Features

### Login Page Features:
1. **Email/Password Login**: Standard authentication form
2. **Remember Me**: Option to persist session
3. **Password Visibility Toggle**: Show/hide password
4. **Quick Login Dropdown**: Select account to auto-fill
5. **Quick Login Buttons**: One-click login for each account
6. **Error Handling**: Clear error messages
7. **Loading States**: Visual feedback during login
8. **Toast Notifications**: Success/error notifications

### Security Features:
- Bank-level encryption
- POPIA Compliant
- ISO 27001 Certified
- Session management via localStorage
- Automatic redirect based on role

## Testing Scenarios

### Test Case 1: Standard Login
1. Enter email: `employee@xspark.com`
2. Enter password: `Employee123!`
3. Click "Sign In"
4. Should redirect to `/ams-dashboard`

### Test Case 2: Quick Login
1. Select "Employee" from dropdown
2. Credentials auto-fill
3. Click "Sign In"
4. Should redirect to `/ams-dashboard`

### Test Case 3: One-Click Login
1. Click "Employee" quick login button
2. Automatically logs in and redirects
3. Should redirect to `/ams-dashboard`

### Test Case 4: Invalid Credentials
1. Enter wrong email/password
2. Should show error message
3. Should not redirect

### Test Case 5: Supervisor Login
1. Login as supervisor
2. Should redirect to `/ams-supervisor`
3. Should have supervisor permissions

## Role-Based Routing

After successful login, users are redirected based on their role:

| Role | Default Route |
|------|---------------|
| `employee` | `/ams-dashboard` |
| `supervisor` | `/ams-supervisor` |
| `junior_hr` | `/dashboard` |
| `hr_manager` | `/dashboard` |
| `admin` | `/dashboard` |
| `super_admin` | `/dashboard` |

If no role matches, redirects to `/system-selector`.

## Troubleshooting

### Issue: "Login failed"
- **Solution**: Verify account exists in Supabase Auth
- **Check**: Email and password are correct
- **Verify**: Account is active (`is_active = true`)

### Issue: "Employee record not found"
- **Solution**: Employee record must be linked to auth user
- **Check**: `auth_user_id` is set in employees table
- **Verify**: Employee exists in database

### Issue: "Account deactivated"
- **Solution**: Account is inactive
- **Check**: `is_active = true` in employees table
- **Action**: Contact HR to reactivate

### Issue: Redirect not working
- **Solution**: Check localStorage for session
- **Check**: User object has correct role
- **Verify**: Router is working correctly

## Notes

- All demo accounts use the same password pattern for easy testing
- Passwords meet security requirements (8+ chars, uppercase, lowercase, number, special char)
- Accounts should be created in Supabase Auth before use
- Employee records must be linked via `auth_user_id`
- Sessions are stored in localStorage (client-side)

## Support

For issues with demo accounts:
1. Verify account exists in Supabase Auth
2. Check employee record is linked
3. Verify account is active
4. Check browser console for errors
5. Verify API endpoint `/api/auth/login` is working


