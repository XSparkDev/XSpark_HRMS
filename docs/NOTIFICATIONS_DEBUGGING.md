# Notifications Debugging Guide

## Issue: Notifications Not Appearing

If you've created a notification but it's not appearing for the user, follow these steps:

## Step 1: Verify the Notification Was Created

### Check the Database Directly

```sql
-- Check if notification exists
SELECT * FROM notifications 
WHERE employee_id = 'YOUR_EMPLOYEE_UUID_HERE'
ORDER BY created_at DESC;

-- Check all recent notifications
SELECT id, employee_id, title, created_at 
FROM notifications 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check via API

```bash
# Get all notifications for an employee
curl "http://localhost:3000/api/notifications?employeeId=YOUR_EMPLOYEE_UUID_HERE"

# Get only unread notifications
curl "http://localhost:3000/api/notifications?employeeId=YOUR_EMPLOYEE_UUID_HERE&onlyUnread=true"
```

## Step 2: Common Issues

### Issue 1: Employee ID Mismatch

**Problem:** The `employee_id` used when creating the notification doesn't match the `employee_id` used when fetching.

**Solution:**
- Ensure you're using the exact same UUID format
- Check for whitespace: `employeeId.trim()`
- Verify the UUID is from the `employees` table

**Check:**
```typescript
// When creating notification
const notification = await notificationService.createNotification({
  employee_id: employeeId, // Make sure this is correct
  // ...
})

// When fetching notifications
const notifications = await notificationService.getAllNotifications(employeeId) // Must match!
```

### Issue 2: UUID Format

**Problem:** UUID might have different casing or format.

**Solution:** The service now normalizes UUIDs, but verify:
- UUID should be lowercase: `550e8400-e29b-41d4-a716-446655440000`
- No extra spaces or characters
- Valid UUID format

### Issue 3: Notification Created but Not Visible

**Check the logs:**
- Look for `[NotificationService] Notification created successfully` in console
- Check `[NotificationService] Found X notifications for employee` in console
- Verify the `employee_id` in the log matches what you're querying

## Step 3: Debug Using the Service

```typescript
import { notificationService } from '@/lib/services/notification-service'

// Debug method to check all notifications
const debug = await notificationService.debugGetNotificationsForEmployee(employeeId)

console.log('Exact matches:', debug.exactMatch)
console.log('All notifications:', debug.allNotifications)
console.log('Employee ID variations found:', debug.employeeIdVariations)
```

## Step 4: Verify API Endpoint

### Test the GET endpoint:

```bash
# Replace with actual employee UUID
curl "http://localhost:3000/api/notifications?employeeId=550e8400-e29b-41d4-a716-446655440000"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "employee_id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "...",
      "message": "...",
      "is_read": false,
      ...
    }
  ]
}
```

## Step 5: Check Frontend Implementation

If notifications exist in the database but aren't showing in the UI:

1. **Check the API call:**
   ```typescript
   const response = await fetch(`/api/notifications?employeeId=${employeeId}`)
   const { data } = await response.json()
   console.log('Notifications from API:', data)
   ```

2. **Verify employee ID:**
   ```typescript
   const currentUser = getCurrentUser()
   const employeeId = currentUser?.id || currentUser?.employeeId
   console.log('Current employee ID:', employeeId)
   ```

3. **Check for filtering:**
   - Make sure you're not filtering out notifications
   - Check if `onlyUnread` parameter is being used incorrectly

## Step 6: Common Fixes

### Fix 1: Ensure Consistent Employee ID

```typescript
// Get employee ID from current user
const currentUser = getCurrentUser()
const employeeId = currentUser?.id || currentUser?.employeeId

if (!employeeId) {
  console.error('Employee ID not found!')
  return
}

// Use the same employeeId for both creating and fetching
await notificationService.createNotification({
  employee_id: employeeId, // ✅ Use same ID
  // ...
})

const notifications = await notificationService.getAllNotifications(employeeId) // ✅ Same ID
```

### Fix 2: Check Database Constraints

```sql
-- Verify employee exists
SELECT id, employee_id, name FROM employees WHERE id = 'YOUR_EMPLOYEE_UUID';

-- Check foreign key constraint
SELECT * FROM notifications 
WHERE employee_id NOT IN (SELECT id FROM employees);
```

### Fix 3: Verify Notification Type

```typescript
// Make sure notification_type is valid
const validTypes = ['internal', 'external']
if (!validTypes.includes(payload.notification_type)) {
  console.error('Invalid notification_type:', payload.notification_type)
}
```

## Step 7: Test with a Simple Notification

```typescript
// Create a test notification
const testNotification = await notificationService.createNotification({
  employee_id: 'YOUR_EMPLOYEE_UUID',
  title: 'Test Notification',
  message: 'This is a test notification to verify the system is working.',
  notification_type: 'internal',
  published_by: null,
  is_confidential: false
})

console.log('Test notification created:', testNotification.id)

// Immediately fetch it
const fetched = await notificationService.getAllNotifications('YOUR_EMPLOYEE_UUID')
console.log('Fetched notifications:', fetched)
console.log('Test notification found:', fetched.find(n => n.id === testNotification.id))
```

## Quick Checklist

- [ ] Notification was created successfully (check logs)
- [ ] `employee_id` matches exactly when creating and fetching
- [ ] UUID format is correct (lowercase, no spaces)
- [ ] Employee exists in `employees` table
- [ ] API endpoint returns the notification
- [ ] Frontend is using the correct `employee_id`
- [ ] No filters are hiding the notification
- [ ] Check browser console for errors

## Still Not Working?

1. **Check the database directly:**
   ```sql
   SELECT * FROM notifications WHERE employee_id = 'YOUR_UUID';
   ```

2. **Check the service logs:**
   - Look for `[NotificationService]` in console
   - Check for error messages

3. **Verify the employee ID:**
   ```typescript
   const user = getCurrentUser()
   console.log('User ID:', user?.id)
   console.log('Employee ID:', user?.employeeId)
   ```

4. **Test the API directly:**
   ```bash
   curl "http://localhost:3000/api/notifications?employeeId=YOUR_UUID"
   ```
