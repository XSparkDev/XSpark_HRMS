# Notification Workflow Implementation - Complete Guide

## Overview
This document outlines the complete notification system implementation for the Asset Management System, including borrow request notifications and room booking conflict notifications.

---

## 1. Borrow Request Notifications

### ✅ Implementation Status: COMPLETE

### 1.1 When Employee Submits Borrow Request

**Location:** `app/api/borrows/route.ts` (POST handler, lines 172-247)

**Flow:**
1. Employee submits a borrow request
2. System creates borrow record
3. System finds all supervisors (employees with role containing "supervisor")
4. Sends notification to each supervisor

**Notification Details:**
- **Title:** "New Device Borrow Request"
- **Recipient:** All supervisors
- **Message Includes:**
  - Employee name and ID
  - Device name and asset tag
  - Expected return date
  - Request notes (if provided)
- **Type:** Internal
- **Confidential:** No
- **Email:** Sent automatically if configured
- **Duplicate Prevention:** 5-minute window

**Example Message:**
```
Employee John Doe (ID: EMP-001) has requested to borrow MacBook Pro 16" (Asset: DEV-019). Expected return date: 12/31/2024. Notes: Project development work.
```

---

### 1.2 When Supervisor Approves Request

**Location:** `lib/services/borrow-service.ts` (`approveBorrow` method, lines 296-334)

**Flow:**
1. Supervisor approves borrow request (via QR scan or manual approval)
2. System updates borrow record (`is_borrowed = true`)
3. System updates device status to "borrowed"
4. Sends notification to requesting employee

**Notification Details:**
- **Title:** "Borrow Request Approved"
- **Recipient:** Employee who submitted the request
- **Message Includes:**
  - Device name and asset tag
  - Collection instructions
- **Type:** Internal
- **Confidential:** No
- **Email:** Sent automatically if configured
- **Duplicate Prevention:** 5-minute window

**Example Message:**
```
Your request to borrow MacBook Pro 16" (Asset: DEV-019) has been approved. Please collect the device.
```

---

### 1.3 When Supervisor Rejects Request

**Location:** `lib/services/borrow-service.ts` (`rejectBorrow` method, lines 375-412)

**Flow:**
1. Supervisor rejects borrow request
2. System updates device status back to "available"
3. Sends notification to requesting employee

**Notification Details:**
- **Title:** "Borrow Request Rejected"
- **Recipient:** Employee who submitted the request
- **Message Includes:**
  - Device name and asset tag
  - Rejection reason (if provided)
- **Type:** Internal
- **Confidential:** No (unless rejection reason is sensitive)
- **Email:** Sent automatically if configured
- **Duplicate Prevention:** 5-minute window

**Example Message:**
```
Your request to borrow MacBook Pro 16" (Asset: DEV-019) has been rejected. Reason: Device is currently unavailable due to maintenance.
```

---

## 2. Room Booking Conflict Notifications

### ✅ Implementation Status: COMPLETE (NEW)

### 2.1 When Room Booking Conflict is Detected

**Location:** `app/api/room-bookings/route.ts` (`handleCreateBooking` function, lines 460-550)

**Flow:**
1. Employee attempts to book a room
2. System checks for overlapping bookings:
   - Same room
   - Overlapping date & time range
3. If conflict exists:
   - System detects conflicts BEFORE throwing error
   - Sends notification to ALL supervisors
   - Then throws error (booking still fails)

**Notification Details:**
- **Title:** "Room Booking Conflict Detected"
- **Recipient:** All supervisors
- **Message Includes:**
  - Room name
  - Employee attempting to book (name and ID)
  - Date and time of attempted booking
  - Conflicting booking details (employee names, times)
- **Type:** Internal
- **Confidential:** Yes (marked as confidential)
- **Email:** Sent automatically if configured
- **Duplicate Prevention:** 5-minute window

**Example Message:**
```
Room booking conflict detected for Conference Room A. Employee Jane Smith (ID: EMP-002) attempted to book Conference Room A on 12/15/2024 from 14:00 - 15:00, but the room is already booked by: John Doe (14:00 - 15:30).
```

**Technical Implementation:**
- Uses `bookingsService.checkForRoomConflicts()` to detect conflicts
- Fetches room details via `roomsService.getRoomById()`
- Fetches employee details for both requesting and conflicting bookings
- Sends notifications to all supervisors before throwing error
- Booking request still fails (conflict notifications are informational)

---

## 3. Notification Service Features

### ✅ All Required Features Implemented

### 3.1 Core Features

**Location:** `lib/services/notification-service.ts`

#### Create Notification
- ✅ Creates notifications in database
- ✅ Validates required fields
- ✅ Supports optional fields (published_by, is_confidential)
- ✅ Returns normalized notification record

#### Duplicate Prevention
- ✅ Checks for duplicates within configurable time window (default: 5 minutes)
- ✅ Prevents duplicate notifications based on:
  - Same `employee_id`
  - Same `title`
  - Created within time window
- ✅ Returns existing notification if duplicate found

#### Email Support
- ✅ Sends email notifications via Resend API
- ✅ Tracks email status (`email_sent`, `email_sent_at`)
- ✅ Updates database after successful email
- ✅ Gracefully handles email failures (notification still created)
- ✅ Requires `RESEND_API_KEY` environment variable

#### Read/Unread Tracking
- ✅ `markAsRead(notificationId)` - Marks single notification as read
- ✅ `markAllAsRead(employeeId)` - Marks all unread notifications for employee
- ✅ `getUnreadNotifications(employeeId)` - Returns only unread notifications
- ✅ `getAllNotifications(employeeId)` - Returns all notifications
- ✅ Tracks `is_read` and `read_at` timestamps

#### Database Fields
All required fields are supported:
- ✅ `id` - UUID primary key
- ✅ `employee_id` - Recipient UUID
- ✅ `title` - Notification title (max 255 chars)
- ✅ `message` - Full notification message
- ✅ `notification_type` - 'internal' or 'external'
- ✅ `is_confidential` - Boolean flag
- ✅ `published_by` - UUID of person who triggered notification
- ✅ `is_read` - Read status
- ✅ `read_at` - Timestamp when read
- ✅ `email_sent` - Email delivery status
- ✅ `email_sent_at` - Timestamp when email sent
- ✅ `created_at` - Creation timestamp
- ✅ `updated_at` - Last update timestamp

---

## 4. Notification API Endpoints

### 4.1 GET /api/notifications

**Query Parameters:**
- `employeeId` (required) - Employee UUID or employee_id string
- `onlyUnread` (optional) - If true, returns only unread notifications

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "employee_id": "uuid",
      "title": "Notification Title",
      "message": "Full message content",
      "notification_type": "internal",
      "is_confidential": false,
      "published_by": "uuid",
      "is_read": false,
      "read_at": null,
      "email_sent": true,
      "email_sent_at": "2024-12-15T10:00:00Z",
      "created_at": "2024-12-15T10:00:00Z",
      "updated_at": "2024-12-15T10:00:00Z"
    }
  ]
}
```

**Features:**
- ✅ Resolves `employee_id` strings to UUIDs automatically
- ✅ Supports filtering by read/unread status
- ✅ Returns notifications ordered by creation date (newest first)

---

## 5. Frontend Integration

### 5.1 Notification Bell Icon

**Location:** `components/ams-dashboard-layout.tsx`

**Features:**
- ✅ Displays notification bell icon in top right
- ✅ Shows unread count badge
- ✅ Fetches notifications on component mount
- ✅ Subscribes to real-time updates (if available)
- ✅ Opens notification panel on click

### 5.2 Notification Display

**Features:**
- ✅ Shows notification title and message
- ✅ Displays read/unread status
- ✅ Shows timestamp
- ✅ Allows marking as read
- ✅ Supports "Mark all as read" action

---

## 6. Testing Checklist

### 6.1 Borrow Request Notifications

- [ ] Submit borrow request → Verify supervisors receive notification
- [ ] Approve borrow request → Verify employee receives approval notification
- [ ] Reject borrow request → Verify employee receives rejection notification
- [ ] Check notification appears in notification bell
- [ ] Verify email is sent (if configured)
- [ ] Test duplicate prevention (submit same request twice within 5 minutes)

### 6.2 Room Booking Conflict Notifications

- [ ] Attempt to book room with conflict → Verify supervisors receive notification
- [ ] Check notification includes all conflict details
- [ ] Verify notification is marked as confidential
- [ ] Test duplicate prevention (attempt same conflict twice within 5 minutes)
- [ ] Verify booking still fails after notification is sent

### 6.3 Notification Service Features

- [ ] Test read/unread tracking
- [ ] Test mark as read functionality
- [ ] Test mark all as read functionality
- [ ] Test duplicate prevention
- [ ] Test email sending (if configured)
- [ ] Verify all database fields are populated correctly

---

## 7. Configuration

### 7.1 Environment Variables

**Required for Email Notifications:**
```env
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=notifications@yourdomain.com
```

**Note:** If `RESEND_API_KEY` is not configured, notifications will still be created in the database, but emails will not be sent.

### 7.2 Supervisor Role Detection

The system finds supervisors by:
1. Querying `roles` table for roles with `role_name` containing "supervisor" (case-insensitive)
2. Finding all employees with that role ID
3. Filtering out deleted employees (`deleted_at IS NULL`)

---

## 8. Error Handling

### 8.1 Notification Failures Don't Break Main Operations

- ✅ If notification creation fails, the main operation (borrow request, approval, etc.) still succeeds
- ✅ Errors are logged to console but don't throw exceptions
- ✅ Email failures don't prevent notification creation

### 8.2 Graceful Degradation

- ✅ If no supervisors are found, operation continues without notifications
- ✅ If employee email is missing, notification is still created (email just fails)
- ✅ If Resend API is unavailable, notification is still created

---

## 9. Performance Considerations

### 9.1 Duplicate Prevention

- ✅ Prevents database bloat from duplicate notifications
- ✅ Uses indexed queries for fast duplicate detection
- ✅ Configurable time window (default: 5 minutes)

### 9.2 Batch Operations

- ✅ Uses `Promise.allSettled()` for sending notifications to multiple supervisors
- ✅ Continues even if some notifications fail
- ✅ Logs success/failure counts

---

## 10. Summary

### ✅ Completed Features

1. **Borrow Request Notifications**
   - ✅ Submit → Supervisors notified
   - ✅ Approve → Employee notified
   - ✅ Reject → Employee notified

2. **Room Booking Conflict Notifications**
   - ✅ Conflict detection
   - ✅ Supervisor notifications
   - ✅ Detailed conflict information

3. **Notification Service**
   - ✅ Create notifications
   - ✅ Duplicate prevention
   - ✅ Email support
   - ✅ Read/unread tracking
   - ✅ All required database fields

4. **Frontend Integration**
   - ✅ Notification bell icon
   - ✅ Unread count badge
   - ✅ Real-time updates

### 🎯 Expected Outcome

After implementation:
- ✅ Borrow workflow notifications trigger correctly
- ✅ Room booking conflicts notify supervisors immediately
- ✅ No duplicate notifications
- ✅ Notifications appear correctly in UI
- ✅ Email notifications work if configured
- ✅ Read/unread tracking persists properly

---

## 11. Files Modified/Created

### Modified Files:
1. `app/api/borrows/route.ts` - Added supervisor notifications on borrow request creation
2. `lib/services/borrow-service.ts` - Added approval/rejection notifications
3. `app/api/room-bookings/route.ts` - Added conflict detection and supervisor notifications
4. `lib/services/bookings-service.ts` - Added `checkForRoomConflicts()` method

### Service Files (Already Implemented):
1. `lib/services/notification-service.ts` - Complete notification service
2. `app/api/notifications/route.ts` - Notification API endpoints
3. `components/ams-dashboard-layout.tsx` - Frontend notification display

---

## 12. Next Steps

1. Test all notification workflows end-to-end
2. Verify email delivery (if Resend API is configured)
3. Monitor notification creation in production
4. Review notification content for clarity and completeness
5. Consider adding notification preferences (opt-in/opt-out)

---

**Last Updated:** December 2024
**Status:** ✅ Implementation Complete
