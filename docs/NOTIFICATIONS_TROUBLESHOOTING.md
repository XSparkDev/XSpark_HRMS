# Notifications Not Appearing - Quick Troubleshooting

## Issue: Notification created via Postman but not showing in bell icon

### Step 1: Check the Employee ID Match

**The most common issue is an employee ID mismatch.**

When you create a notification in Postman, you use an `employee_id`. When the frontend fetches notifications, it uses a different employee ID source.

#### How to Check:

1. **Open the browser console** (F12)
2. **Click the bell icon** to open notifications
3. **Look for these console logs:**
   ```
   [Notifications] Fetching notifications for employee ID: <UUID>
   [Notifications] User object: { id: ..., employeeId: ... }
   [Notifications] Employee profile: { id: ..., employee_id: ... }
   [Notifications] API response: { success: true, data: [...] }
   ```

4. **Check the Employee ID shown in the dropdown** (in development mode, it shows at the top of the notifications dropdown)

#### Compare with Postman:

- **Postman `employee_id`**: The UUID you used in the POST request
- **Frontend Employee ID**: The UUID shown in the console logs

**They must match exactly!**

### Step 2: Verify the Notification Exists

Test the GET endpoint directly with the same employee ID:

```bash
# Replace with the employee ID from console logs
curl "http://localhost:3000/api/notifications?employeeId=YOUR_EMPLOYEE_UUID"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "employee_id": "YOUR_EMPLOYEE_UUID",
      "title": "...",
      "message": "..."
    }
  ]
}
```

If this returns your notification but the UI doesn't show it, the issue is in the frontend.

### Step 3: Check Database Directly

```sql
-- Check if notification exists
SELECT id, employee_id, title, created_at 
FROM notifications 
WHERE employee_id = 'YOUR_EMPLOYEE_UUID'
ORDER BY created_at DESC;

-- Check all recent notifications
SELECT id, employee_id, title, created_at 
FROM notifications 
ORDER BY created_at DESC 
LIMIT 10;
```

### Step 4: Common Fixes

#### Fix 1: Use the Correct Employee ID

The frontend tries to get employee ID from multiple sources in this order:
1. `employeeProfile.id` (from localStorage `xspark_employee`)
2. `employeeProfile.employee_id`
3. `user.id` (from localStorage `xspark_user`)
4. `user.employeeId`

**Solution:** Use the same employee ID that appears in the console logs when creating the notification in Postman.

#### Fix 2: Check UUID Format

Ensure the UUID is:
- Lowercase: `550e8400-e29b-41d4-a716-446655440000` ✅
- Not uppercase: `550E8400-E29B-41D4-A716-446655440000` ❌
- No extra spaces
- Valid UUID format

#### Fix 3: Verify Employee Exists

```sql
-- Check if employee exists
SELECT id, employee_id, name, email 
FROM employees 
WHERE id = 'YOUR_EMPLOYEE_UUID' 
   OR employee_id = 'YOUR_EMPLOYEE_UUID';
```

### Step 5: Quick Test

1. **Get your current employee ID from the console:**
   - Open browser console
   - Click bell icon
   - Note the Employee ID shown in logs

2. **Create a test notification in Postman:**
   ```json
   {
     "employee_id": "<USE_THE_ID_FROM_CONSOLE>",
     "title": "Test Notification",
     "message": "Testing if notifications appear",
     "notification_type": "internal"
   }
   ```

3. **Click the bell icon again** - it should appear immediately

### Step 6: Check Server Logs

Look for these logs in your server console:

```
[notifications] GET request: { employeeId: '...', onlyUnread: false }
[NotificationService] Found X notifications for employee ...
[notifications] GET response: { employeeId: '...', count: X, ... }
```

If you see `count: 0` but the notification exists in the database, there's an ID mismatch.

## Still Not Working?

1. **Check browser console for errors**
2. **Check server console for errors**
3. **Verify the notification was actually created:**
   ```sql
   SELECT * FROM notifications WHERE id = 'NOTIFICATION_ID_FROM_POSTMAN';
   ```
4. **Compare employee IDs character by character** - even one character difference will cause it to not appear

## Debug Mode

In development mode, the notifications dropdown shows the Employee ID being used. Compare this with the `employee_id` you used in Postman - they must match exactly!
