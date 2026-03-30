# Email Templates Documentation

This directory contains email templates for the X Spark HRMS and Asset Management System.

## Setup

### Environment Variables

Add the following environment variables to your `.env.local` file:

```env
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

- `RESEND_API_KEY`: Your Resend API key (get it from [resend.com](https://resend.com))
- `RESEND_FROM_EMAIL`: The email address to send emails from (must be verified in Resend)
- `NEXT_PUBLIC_APP_URL`: Your application URL for links in emails

## Asset Management System Templates

### 1. Borrow Request Emails

#### `sendBorrowRequestEmail`
Sends an email to the employee when they submit a borrow request.

```typescript
import { sendBorrowRequestEmail } from '@/lib/templates'

await sendBorrowRequestEmail({
  employeeName: 'John Doe',
  employeeEmail: 'john@example.com',
  deviceName: 'MacBook Pro',
  assetTag: 'ASSET-001',
  borrowDate: '2024-01-15',
  expectedReturnDate: '2024-01-20',
  purpose: 'Project work',
  borrowId: 'borrow-uuid'
})
```

#### `sendBorrowRequestToSupervisorEmail`
Sends an email to the supervisor when a new borrow request is submitted.

```typescript
import { sendBorrowRequestToSupervisorEmail } from '@/lib/templates'

await sendBorrowRequestToSupervisorEmail('supervisor@example.com', {
  employeeName: 'John Doe',
  employeeEmail: 'john@example.com',
  deviceName: 'MacBook Pro',
  assetTag: 'ASSET-001',
  borrowDate: '2024-01-15',
  expectedReturnDate: '2024-01-20',
  purpose: 'Project work',
  borrowId: 'borrow-uuid'
})
```

### 2. Return Request Emails

#### `sendReturnRequestEmail`
Sends an email to the employee when they submit a return request.

```typescript
import { sendReturnRequestEmail } from '@/lib/templates'

await sendReturnRequestEmail({
  employeeName: 'John Doe',
  employeeEmail: 'john@example.com',
  deviceName: 'MacBook Pro',
  assetTag: 'ASSET-001',
  borrowDate: '2024-01-15',
  returnDate: '2024-01-20',
  borrowId: 'borrow-uuid'
})
```

#### `sendReturnRequestToSupervisorEmail`
Sends an email to the supervisor when a return request is submitted.

```typescript
import { sendReturnRequestToSupervisorEmail } from '@/lib/templates'

await sendReturnRequestToSupervisorEmail('supervisor@example.com', {
  employeeName: 'John Doe',
  employeeEmail: 'john@example.com',
  deviceName: 'MacBook Pro',
  assetTag: 'ASSET-001',
  borrowDate: '2024-01-15',
  returnDate: '2024-01-20',
  borrowId: 'borrow-uuid'
})
```

### 3. Pending Borrow Email

#### `sendPendingBorrowEmail`
Sends an email to notify about a pending borrow that requires attention.

```typescript
import { sendPendingBorrowEmail } from '@/lib/templates'

await sendPendingBorrowEmail({
  employeeName: 'John Doe',
  employeeEmail: 'john@example.com',
  deviceName: 'MacBook Pro',
  assetTag: 'ASSET-001',
  borrowDate: '2024-01-15',
  expectedReturnDate: '2024-01-20',
  status: 'Pending Approval',
  borrowId: 'borrow-uuid'
})
```

### 4. Return Reminder Email

#### `sendReturnReminderEmail`
Sends a reminder email when the return date is approaching.

```typescript
import { sendReturnReminderEmail } from '@/lib/templates'

await sendReturnReminderEmail({
  employeeName: 'John Doe',
  employeeEmail: 'john@example.com',
  deviceName: 'MacBook Pro',
  assetTag: 'ASSET-001',
  expectedReturnDate: '2024-01-20',
  daysRemaining: 2,
  borrowId: 'borrow-uuid'
})
```

### 5. Supervisor Update Email

#### `sendSupervisorUpdateEmail`
Sends an email when a supervisor provides an update on maintenance or incident reports.

```typescript
import { sendSupervisorUpdateEmail } from '@/lib/templates'

// For maintenance updates
await sendSupervisorUpdateEmail({
  employeeName: 'John Doe',
  employeeEmail: 'john@example.com',
  updateType: 'maintenance',
  title: 'Maintenance Completed',
  message: 'Your device has been repaired and is ready for use.',
  deviceName: 'MacBook Pro',
  assetTag: 'ASSET-001',
  maintenanceRequestId: 'maintenance-uuid',
  priority: 'high'
})

// For incident reports
await sendSupervisorUpdateEmail({
  employeeName: 'John Doe',
  employeeEmail: 'john@example.com',
  updateType: 'incident',
  title: 'Incident Report Update',
  message: 'Your incident report has been reviewed and resolved.',
  deviceName: 'MacBook Pro',
  assetTag: 'ASSET-001',
  incidentId: 'incident-uuid',
  priority: 'medium'
})
```

### 6. Booking Conflict Email

#### `sendBookingConflictEmail`
Sends an email when a room booking conflicts with an existing booking.

```typescript
import { sendBookingConflictEmail } from '@/lib/templates'

await sendBookingConflictEmail({
  employeeName: 'John Doe',
  employeeEmail: 'john@example.com',
  roomName: 'Conference Room A',
  requestedDate: '2024-01-15',
  requestedTime: '10:00 AM - 11:00 AM',
  conflictingEmployeeName: 'Jane Smith',
  conflictingTime: '10:00 AM - 11:30 AM'
})
```

### 7. Meeting Check-In Email

#### `sendMeetingCheckInEmail`
Sends an email confirmation when an employee checks in to a meeting.

```typescript
import { sendMeetingCheckInEmail } from '@/lib/templates'

await sendMeetingCheckInEmail({
  employeeName: 'John Doe',
  employeeEmail: 'john@example.com',
  roomName: 'Conference Room A',
  meetingAgenda: 'Team Standup',
  meetingDate: '2024-01-15',
  meetingTime: '10:00 AM - 11:00 AM',
  checkInTime: '2024-01-15 10:00 AM'
})
```

### 8. Meeting Check-Out Email

#### `sendMeetingCheckOutEmail`
Sends an email confirmation when an employee checks out of a meeting.

```typescript
import { sendMeetingCheckOutEmail } from '@/lib/templates'

await sendMeetingCheckOutEmail({
  employeeName: 'John Doe',
  employeeEmail: 'john@example.com',
  roomName: 'Conference Room A',
  meetingAgenda: 'Team Standup',
  meetingDate: '2024-01-15',
  meetingTime: '10:00 AM - 11:00 AM',
  checkOutTime: '2024-01-15 11:00 AM'
})
```

## HR Management System Templates

HRMS email templates are available in `hrms-templates.ts`. Add specific templates as needed for:
- Leave requests
- Payroll notifications
- Employee onboarding
- Performance reviews
- etc.

## Direct Email Service Usage

You can also use the email service directly for custom emails:

```typescript
import { emailService } from '@/lib/templates'

const result = await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Custom Email',
  html: '<h1>Hello World</h1>',
  from: 'custom@example.com', // Optional, defaults to RESEND_FROM_EMAIL
  replyTo: 'support@example.com' // Optional
})

if (result.success) {
  console.log('Email sent:', result.messageId)
} else {
  console.error('Failed to send email:', result.error)
}
```

## Error Handling

All email template functions return a result object:

```typescript
{
  success: boolean
  error?: string
}
```

Always check the `success` property and handle errors appropriately:

```typescript
const result = await sendBorrowRequestEmail(data)
if (!result.success) {
  console.error('Failed to send email:', result.error)
  // Handle error (log, retry, notify user, etc.)
}
```

## Notes

- All emails use a consistent design with the X Spark branding
- Emails are responsive and work on mobile devices
- Links in emails use the `NEXT_PUBLIC_APP_URL` environment variable
- If `RESEND_API_KEY` is not configured, emails will not be sent but will not throw errors (logs a warning instead)
