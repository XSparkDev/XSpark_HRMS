# Borrow Request Notifications - Implementation Summary

## Overview
Fixed the notification system to send notifications to supervisors when borrow requests are created, and to employees when requests are approved or rejected.

## Changes Made

### 1. Borrow Request Creation (`app/api/borrows/route.ts`)

**Added**: Notification to all supervisors when a borrow request is created

**Implementation**:
- After creating a borrow record, the system:
  1. Finds all employees with supervisor role (role_name contains "supervisor")
  2. Gets borrower and device information
  3. Sends a notification to each supervisor with:
     - Title: "New Device Borrow Request"
     - Message: Includes employee name, device details, expected return date, and notes
     - Type: "internal"
     - Email: Sent automatically (if configured)

**Code Location**: Lines 169-250 in `app/api/borrows/route.ts`

### 2. Borrow Request Approval (`lib/services/borrow-service.ts`)

**Added**: Notification to employee when request is approved

**Implementation**:
- After approving a borrow request, the system:
  1. Gets device and employee information
  2. Sends notification to the requesting employee with:
     - Title: "Borrow Request Approved"
     - Message: Device details and collection instructions
     - Type: "internal"
     - Email: Sent automatically (if configured)

**Code Location**: `approveBorrow()` method in `lib/services/borrow-service.ts`

### 3. Borrow Request Rejection (`lib/services/borrow-service.ts`)

**Added**: Notification to employee when request is rejected

**Implementation**:
- After rejecting a borrow request, the system:
  1. Gets device and employee information
  2. Sends notification to the requesting employee with:
     - Title: "Borrow Request Rejected"
     - Message: Device details and rejection reason (if provided)
     - Type: "internal"
     - Email: Sent automatically (if configured)

**Code Location**: `rejectBorrow()` method in `lib/services/borrow-service.ts`

## Notification Features

### All Notifications Include:
- ✅ **Duplicate Prevention**: Prevents duplicate notifications within 5 minutes
- ✅ **Email Support**: Automatically sends email if `RESEND_API_KEY` is configured
- ✅ **Error Handling**: Notification failures don't break the main operation
- ✅ **Detailed Messages**: Includes device name, asset tag, employee info, and relevant dates

### Notification Recipients:

1. **Borrow Request Created**:
   - Recipients: All supervisors (employees with supervisor role)
   - Publisher: Employee who submitted the request

2. **Borrow Request Approved**:
   - Recipient: Employee who requested the device
   - Publisher: Supervisor who approved

3. **Borrow Request Rejected**:
   - Recipient: Employee who requested the device
   - Publisher: Supervisor who rejected

## Testing

### Test Borrow Request Creation:
1. Submit a borrow request via the UI or API
2. Check supervisor dashboard notifications
3. Verify notification appears in supervisor's notification bell icon
4. Check email (if configured)

### Test Approval:
1. Approve a borrow request as supervisor
2. Check employee's notifications
3. Verify notification appears in employee's notification bell icon
4. Check email (if configured)

### Test Rejection:
1. Reject a borrow request as supervisor
2. Check employee's notifications
3. Verify notification appears with rejection reason
4. Check email (if configured)

## Database Schema

Notifications are stored in the `notifications` table with:
- `employee_id`: Recipient UUID
- `title`: Notification title
- `message`: Full notification message
- `notification_type`: "internal" for system notifications
- `published_by`: UUID of person who triggered the notification
- `is_read`: Read status (default: false)
- `email_sent`: Email delivery status
- `created_at`: Timestamp

## Supervisor Role Detection

The system finds supervisors by:
1. Querying the `roles` table for roles with `role_name` containing "supervisor" (case-insensitive)
2. Finding all employees with that `role_id`
3. Sending notifications to all active supervisors (not deleted)

## Error Handling

- Notification failures are logged but don't prevent the main operation
- If supervisor role is not found, a warning is logged
- If no supervisors are found, a warning is logged
- Individual notification failures don't prevent other notifications from being sent

## Future Enhancements

Potential improvements:
- [ ] Add notification preferences (email on/off per user)
- [ ] Add notification templates for different languages
- [ ] Add notification grouping for multiple requests
- [ ] Add notification read receipts
- [ ] Add notification priority levels
