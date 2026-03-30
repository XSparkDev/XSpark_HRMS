# Notifications Service Implementation Guide

## Table of Contents
1. [Schema Analysis](#schema-analysis)
2. [Column Usage Guidelines](#column-usage-guidelines)
3. [Notification Flows](#notification-flows)
4. [Service Alignment](#service-alignment)
5. [Test Payloads](#test-payloads)
6. [Service Improvements](#service-improvements)

---

## Schema Analysis

### Notifications Table Structure

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE, -- NULL for company-wide
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type notification_type_enum NOT NULL, -- 'internal' | 'external'
    is_confidential BOOLEAN DEFAULT FALSE,
    published_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Column Usage Guidelines

### Mandatory Fields

| Column | Required | Purpose |
|--------|----------|---------|
| `id` | ✅ Auto-generated | Primary key, UUID |
| `title` | ✅ **Required** | Short notification title (max 255 chars) |
| `message` | ✅ **Required** | Full notification message content |
| `notification_type` | ✅ **Required** | Enum: `'internal'` or `'external'` |
| `employee_id` | ⚠️ **Conditional** | Required for employee-specific notifications. NULL for company-wide |
| `created_at` | ✅ Auto-generated | Timestamp of creation |
| `updated_at` | ✅ Auto-generated | Timestamp of last update |

### Optional Fields

| Column | Default | Purpose |
|--------|---------|---------|
| `published_by` | `NULL` | UUID of employee who triggered the notification (e.g., supervisor who approved/rejected) |
| `is_confidential` | `FALSE` | Mark sensitive notifications (e.g., disciplinary actions) |
| `is_read` | `FALSE` | Track if notification has been read |
| `read_at` | `NULL` | Timestamp when notification was marked as read |
| `email_sent` | `FALSE` | Track if email notification was sent |
| `email_sent_at` | `NULL` | Timestamp when email was sent |

### Field Population Rules

#### For Borrow Request Notifications

| Field | Value | Notes |
|-------|-------|-------|
| `employee_id` | **Supervisor's UUID** | The supervisor who needs to approve |
| `published_by` | **Requesting Employee's UUID** | Employee who submitted the request |
| `notification_type` | `'internal'` | Internal system notification |
| `is_confidential` | `FALSE` | Borrow requests are not confidential |

#### For Approval Notifications

| Field | Value | Notes |
|-------|-------|-------|
| `employee_id` | **Requesting Employee's UUID** | Employee who submitted the request |
| `published_by` | **Supervisor's UUID** | Supervisor who approved |
| `notification_type` | `'internal'` | Internal system notification |
| `is_confidential` | `FALSE` | Approvals are not confidential |

#### For Rejection Notifications

| Field | Value | Notes |
|-------|-------|-------|
| `employee_id` | **Requesting Employee's UUID** | Employee who submitted the request |
| `published_by` | **Supervisor's UUID** | Supervisor who rejected |
| `notification_type` | `'internal'` | Internal system notification |
| `is_confidential` | `FALSE` | Rejections are not confidential (unless sensitive reason) |

---

## Notification Flows

### Flow 1: Borrow Request Submitted

**Trigger:** Employee submits a device borrow request

**Recipient:** Supervisor(s) with approval permissions

**Publisher:** Employee who submitted the request

**Email:** ✅ Should be sent to supervisor

**Notification Details:**
```typescript
{
  employee_id: supervisorId,        // Supervisor receives notification
  published_by: requestingEmployeeId, // Employee who submitted
  title: "New Device Borrow Request",
  message: "Employee [Name] has requested to borrow [Device Name] (Asset: [Tag]). Expected return: [Date].",
  notification_type: "internal",
  is_confidential: false
}
```

**Implementation:**
- Create notification when borrow record is created
- Send email to supervisor
- Update `email_sent` and `email_sent_at` after successful email

---

### Flow 2: Request Approved

**Trigger:** Supervisor approves a borrow request (via QR scan or manual approval)

**Recipient:** Employee who submitted the request

**Publisher:** Supervisor who approved

**Email:** ✅ Should be sent to employee

**Notification Details:**
```typescript
{
  employee_id: requestingEmployeeId, // Employee receives notification
  published_by: supervisorId,        // Supervisor who approved
  title: "Borrow Request Approved",
  message: "Your request to borrow [Device Name] (Asset: [Tag]) has been approved. Please collect the device.",
  notification_type: "internal",
  is_confidential: false
}
```

**Implementation:**
- Create notification when `approveBorrowRequest` succeeds
- Send email to employee
- Update `email_sent` and `email_sent_at` after successful email

---

### Flow 3: Request Rejected

**Trigger:** Supervisor rejects a borrow request

**Recipient:** Employee who submitted the request

**Publisher:** Supervisor who rejected

**Email:** ✅ Should be sent to employee

**Notification Details:**
```typescript
{
  employee_id: requestingEmployeeId, // Employee receives notification
  published_by: supervisorId,        // Supervisor who rejected
  title: "Borrow Request Rejected",
  message: "Your request to borrow [Device Name] (Asset: [Tag]) has been rejected. Reason: [Rejection Reason]",
  notification_type: "internal",
  is_confidential: false // Set to true if rejection reason is sensitive
}
```

**Implementation:**
- Create notification when `rejectBorrowRequest` succeeds
- Include rejection reason in message
- Send email to employee
- Update `email_sent` and `email_sent_at` after successful email

---

## Service Alignment

### Current Service Issues

1. ❌ `email_sent` and `email_sent_at` are not updated after sending emails
2. ❌ No duplicate prevention mechanism
3. ❌ No integration with borrow request flow
4. ❌ Email sending is not tracked in the database

### Required Service Updates

#### 1. Update `createNotification` to handle email tracking

The service should:
- Accept optional `sendEmail` parameter
- Track email status in database
- Update `email_sent` and `email_sent_at` after successful email

#### 2. Add duplicate prevention

Before creating a notification, check for:
- Same `employee_id`
- Same `notification_type`
- Same `title` (or similar message)
- Created within last 5 minutes

#### 3. Ensure read/unread state works correctly

- `is_read` defaults to `FALSE`
- `read_at` is set when `markAsRead` is called
- `markAllAsRead` updates all unread notifications for an employee

---

## Test Payloads

### Payload 1: Borrow Request → Supervisor

```json
{
  "employee_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "New Device Borrow Request",
  "message": "Employee John Doe (ID: EMP-001) has requested to borrow MacBook Pro 16\" (Asset: DEV-019). Expected return date: 2024-12-31. Purpose: Project development work.",
  "notification_type": "internal",
  "published_by": "7bca7b2d-d395-4321-80af-1afac4a9a476",
  "is_confidential": false
}
```

**Field Mapping:**
- `employee_id`: Supervisor's UUID (recipient)
- `published_by`: Requesting employee's UUID
- `title`: Descriptive title
- `message`: Includes employee name, device details, return date, purpose
- `notification_type`: `"internal"` for system notifications
- `is_confidential`: `false` for standard borrow requests

---

### Payload 2: Approval Notification → Employee

```json
{
  "employee_id": "7bca7b2d-d395-4321-80af-1afac4a9a476",
  "title": "Borrow Request Approved",
  "message": "Your request to borrow MacBook Pro 16\" (Asset: DEV-019) has been approved by Supervisor Jane Smith. Please collect the device from the IT department. You can scan the device QR code to complete pickup.",
  "notification_type": "internal",
  "published_by": "550e8400-e29b-41d4-a716-446655440000",
  "is_confidential": false
}
```

**Field Mapping:**
- `employee_id`: Requesting employee's UUID (recipient)
- `published_by`: Supervisor's UUID who approved
- `title`: Clear approval message
- `message`: Includes device details, supervisor name, next steps
- `notification_type`: `"internal"`
- `is_confidential`: `false`

---

### Payload 3: Rejection Notification → Employee (with reason)

```json
{
  "employee_id": "7bca7b2d-d395-4321-80af-1afac4a9a476",
  "title": "Borrow Request Rejected",
  "message": "Your request to borrow MacBook Pro 16\" (Asset: DEV-019) has been rejected by Supervisor Jane Smith. Reason: Device is currently unavailable due to maintenance. Please submit a new request when the device becomes available.",
  "notification_type": "internal",
  "published_by": "550e8400-e29b-41d4-a716-446655440000",
  "is_confidential": false
}
```

**Field Mapping:**
- `employee_id`: Requesting employee's UUID (recipient)
- `published_by`: Supervisor's UUID who rejected
- `title`: Clear rejection message
- `message`: Includes device details, supervisor name, rejection reason, next steps
- `notification_type`: `"internal"`
- `is_confidential`: `false` (set to `true` if rejection reason contains sensitive information)

---

## Service Improvements

### 1. Enhanced `createNotification` Method

```typescript
async createNotification(
  payload: CreateNotificationInput,
  options?: {
    sendEmail?: boolean
    preventDuplicates?: boolean
    duplicateWindowMinutes?: number
  }
): Promise<NotificationRecord> {
  const { sendEmail = false, preventDuplicates = true, duplicateWindowMinutes = 5 } = options || {}
  
  // Check for duplicates if enabled
  if (preventDuplicates) {
    const duplicate = await this.checkForDuplicate(
      payload.employee_id,
      payload.title,
      duplicateWindowMinutes
    )
    if (duplicate) {
      return duplicate // Return existing notification instead of creating duplicate
    }
  }
  
  // Create notification
  const notification = await this.createNotification(payload)
  
  // Send email if requested
  if (sendEmail) {
    try {
      await this.sendNotificationEmail(notification)
      // Update email tracking
      await this.updateEmailStatus(notification.id, true)
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError)
      // Notification is still created, but email failed
    }
  }
  
  return notification
}
```

### 2. Duplicate Prevention Method

```typescript
private async checkForDuplicate(
  employeeId: string,
  title: string,
  windowMinutes: number = 5
): Promise<NotificationRecord | null> {
  const cutoffTime = new Date()
  cutoffTime.setMinutes(cutoffTime.getMinutes() - windowMinutes)
  
  const { data } = await this.supabase
    .from(this.table)
    .select('*')
    .eq('employee_id', employeeId)
    .eq('title', title)
    .gte('created_at', cutoffTime.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  return data ? this.normalize(data) : null
}
```

### 3. Email Status Update Method

```typescript
async updateEmailStatus(
  notificationId: string,
  emailSent: boolean
): Promise<NotificationRecord | null> {
  const updateData: any = {
    email_sent: emailSent,
    updated_at: new Date().toISOString()
  }
  
  if (emailSent) {
    updateData.email_sent_at = new Date().toISOString()
  }
  
  const record = await this.executeUpdate<any>(
    async () =>
      await this.supabase
        .from(this.table)
        .update(updateData)
        .eq('id', notificationId)
        .select('*')
        .maybeSingle(),
    'update email status'
  )
  
  return record ? this.normalize(record) : null
}
```

### 4. Email Sending Method

```typescript
private async sendNotificationEmail(
  notification: NotificationRecord
): Promise<{ success: boolean; error?: string }> {
  // Get employee email from employee_id
  const { data: employee } = await this.supabase
    .from('employees')
    .select('email, name')
    .eq('id', notification.employee_id)
    .maybeSingle()
  
  if (!employee?.email) {
    return { success: false, error: 'Employee email not found' }
  }
  
  // Use existing email service (Resend API)
  try {
    const result = await emailService.sendEmail({
      to: employee.email,
      subject: notification.title,
      html: this.formatNotificationEmail(notification, employee.name)
    })
    
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email'
    }
  }
}
```

### 5. Read/Unread State Handling

The existing `markAsRead` and `markAllAsRead` methods are correct, but ensure:

```typescript
async markAsRead(notificationId: string): Promise<NotificationRecord | null> {
  // ✅ Correctly updates is_read and read_at
  const record = await this.executeUpdate<any>(
    async () =>
      await this.supabase
        .from(this.table)
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString() // ✅ Also update updated_at
        })
        .eq('id', notificationId)
        .select('*')
        .maybeSingle(),
    'mark notification as read'
  )
  
  return record ? this.normalize(record) : null
}
```

---

## Integration Points

### 1. Borrow Request Creation

**Location:** `app/api/borrows/route.ts` (POST handler)

**Add after line 186:**
```typescript
// Send notification to supervisor
try {
  const { data: supervisor } = await supabaseAdmin
    .from('employees')
    .select('id, role_id')
    .eq('role_id', supervisorRoleId) // Get supervisor role ID
    .limit(1)
    .maybeSingle()
  
  if (supervisor?.id) {
    await notificationService.createNotification({
      employee_id: supervisor.id,
      title: 'New Device Borrow Request',
      message: `Employee ${borrowerEmployee?.name || 'Unknown'} has requested to borrow ${device?.model || 'device'}. Expected return: ${payload.return_date || 'Not specified'}.`,
      notification_type: 'internal',
      published_by: employeeUuid,
      is_confidential: false
    }, {
      sendEmail: true,
      preventDuplicates: true
    })
  }
} catch (notifError) {
  console.error('[borrows] Failed to send notification:', notifError)
  // Don't fail the request if notification fails
}
```

### 2. Borrow Request Approval

**Location:** `lib/services/supervisor-dashboard-service.ts` (approveBorrowRequest method)

**Add after line 844:**
```typescript
// Send approval notification to employee
try {
  const { data: borrowDetails } = await supabase
    .from('borrows')
    .select(`
      borrowed_by,
      devices:device_id (model, asset_tag),
      employees:borrowed_by (name)
    `)
    .eq('borrow_id', requestId)
    .single()
  
  if (borrowDetails?.borrowed_by) {
    await notificationService.createNotification({
      employee_id: borrowDetails.borrowed_by,
      title: 'Borrow Request Approved',
      message: `Your request to borrow ${borrowDetails.devices?.model || 'device'} (Asset: ${borrowDetails.devices?.asset_tag || 'N/A'}) has been approved. Please collect the device.`,
      notification_type: 'internal',
      published_by: getCurrentUser()?.id || null, // Supervisor ID
      is_confidential: false
    }, {
      sendEmail: true,
      preventDuplicates: true
    })
  }
} catch (notifError) {
  console.error('[supervisor-dashboard] Failed to send approval notification:', notifError)
}
```

### 3. Borrow Request Rejection

**Location:** `lib/services/supervisor-dashboard-service.ts` (rejectBorrowRequest method)

**Add after line 871:**
```typescript
// Send rejection notification to employee
try {
  const { data: borrowDetails } = await supabase
    .from('borrows')
    .select(`
      borrowed_by,
      devices:device_id (model, asset_tag),
      employees:borrowed_by (name)
    `)
    .eq('borrow_id', requestId)
    .single()
  
  if (borrowDetails?.borrowed_by) {
    await notificationService.createNotification({
      employee_id: borrowDetails.borrowed_by,
      title: 'Borrow Request Rejected',
      message: `Your request to borrow ${borrowDetails.devices?.model || 'device'} (Asset: ${borrowDetails.devices?.asset_tag || 'N/A'}) has been rejected.${reason ? ` Reason: ${reason}` : ''}`,
      notification_type: 'internal',
      published_by: getCurrentUser()?.id || null, // Supervisor ID
      is_confidential: false
    }, {
      sendEmail: true,
      preventDuplicates: true
    })
  }
} catch (notifError) {
  console.error('[supervisor-dashboard] Failed to send rejection notification:', notifError)
}
```

---

## Summary

### Key Points

1. **Schema Compliance:** All payloads match the database schema exactly
2. **Field Mapping:** Clear rules for `employee_id`, `published_by`, and `notification_type`
3. **Email Tracking:** `email_sent` and `email_sent_at` are properly updated
4. **Duplicate Prevention:** Prevents duplicate notifications within a time window
5. **Read State:** `is_read` and `read_at` are correctly managed
6. **Confidential Support:** `is_confidential` flag is properly used

### Next Steps

1. Update `notification-service.ts` with enhanced methods
2. Integrate notifications into borrow request flow
3. Test all three notification scenarios
4. Verify email delivery and tracking
5. Monitor for duplicate notifications

---

## Appendix: Complete Notification Service Interface

```typescript
interface CreateNotificationInput {
  employee_id: string                    // ✅ Required: Recipient UUID
  title: string                           // ✅ Required: Max 255 chars
  message: string                         // ✅ Required: Full message
  notification_type: 'internal' | 'external' // ✅ Required: Enum value
  published_by?: string | null            // Optional: Publisher UUID
  is_confidential?: boolean               // Optional: Default false
}

interface CreateNotificationOptions {
  sendEmail?: boolean                      // Default: false
  preventDuplicates?: boolean            // Default: true
  duplicateWindowMinutes?: number         // Default: 5
}
```
