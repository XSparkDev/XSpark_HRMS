// ============================================================================
// ASSET MANAGEMENT SYSTEM EMAIL TEMPLATES
// ============================================================================

import { emailService } from '../services/email-service'

export interface BorrowRequestData {
  employeeName: string
  employeeEmail: string
  deviceName: string
  assetTag: string
  borrowDate: string
  expectedReturnDate: string
  purpose?: string
  borrowId?: string
}

export interface ReturnRequestData {
  employeeName: string
  employeeEmail: string
  deviceName: string
  assetTag: string
  borrowDate: string
  returnDate: string
  borrowId?: string
}

export interface PendingBorrowData {
  employeeName: string
  employeeEmail: string
  deviceName: string
  assetTag: string
  borrowDate: string
  expectedReturnDate: string
  status: string
  borrowId?: string
}

export interface ReturnReminderData {
  employeeName: string
  employeeEmail: string
  deviceName: string
  assetTag: string
  expectedReturnDate: string
  daysRemaining: number
  borrowId?: string
}

export interface SupervisorUpdateData {
  employeeName: string
  employeeEmail: string
  updateType: 'maintenance' | 'incident'
  title: string
  message: string
  deviceName?: string
  assetTag?: string
  incidentId?: string
  maintenanceRequestId?: string
  priority?: string
}

export interface BookingConflictData {
  employeeName: string
  employeeEmail: string
  roomName: string
  requestedDate: string
  requestedTime: string
  conflictingEmployeeName: string
  conflictingTime: string
}

export interface MeetingCheckInData {
  employeeName: string
  employeeEmail: string
  roomName: string
  meetingAgenda: string
  meetingDate: string
  meetingTime: string
  checkInTime: string
}

export interface MeetingCheckOutData {
  employeeName: string
  employeeEmail: string
  roomName: string
  meetingAgenda: string
  meetingDate: string
  meetingTime: string
  checkOutTime: string
}

export interface MeetingRescheduleData {
  employeeName: string
  employeeEmail: string
  roomName: string
  meetingAgenda: string
  originalDate: string
  originalTime: string
  newDate: string
  newTime: string
  reason?: string
  bookingId?: string
}

const getBaseEmailTemplate = (content: string, title: string): string => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .email-container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #92278F 0%, #BE1E2D 100%);
      color: white;
      padding: 20px;
      border-radius: 8px 8px 0 0;
      margin: -30px -30px 30px -30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      margin: 20px 0;
    }
    .info-box {
      background-color: #f9fafb;
      border-left: 4px solid #92278F;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      font-weight: 600;
      color: #6b7280;
    }
    .info-value {
      color: #1f2937;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(135deg, #92278F 0%, #BE1E2D 100%);
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 500;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
    .warning {
      background-color: #fef3c7;
      border-left-color: #f59e0b;
      color: #92400e;
    }
    .success {
      background-color: #d1fae5;
      border-left-color: #10b981;
      color: #065f46;
    }
    .error {
      background-color: #fee2e2;
      border-left-color: #ef4444;
      color: #991b1b;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>X Spark Asset Management</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>This is an automated email from X Spark Asset Management System.</p>
      <p>Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

// ============================================================================
// BORROW REQUEST TEMPLATES
// ============================================================================

export async function sendBorrowRequestEmail(data: BorrowRequestData): Promise<{ success: boolean; error?: string }> {
  const content = `
    <h2>Device Borrow Request Submitted</h2>
    <p>Hello ${data.employeeName},</p>
    <p>Your device borrow request has been submitted and is pending supervisor approval.</p>
    
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Device:</span>
        <span class="info-value">${data.deviceName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Asset Tag:</span>
        <span class="info-value">${data.assetTag}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Borrow Date:</span>
        <span class="info-value">${data.borrowDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Expected Return Date:</span>
        <span class="info-value">${data.expectedReturnDate}</span>
      </div>
      ${data.purpose ? `
      <div class="info-row">
        <span class="info-label">Purpose:</span>
        <span class="info-value">${data.purpose}</span>
      </div>
      ` : ''}
    </div>
    
    <p>You will receive a notification once your request has been reviewed by a supervisor.</p>
  `

  const result = await emailService.sendEmail({
    to: data.employeeEmail,
    subject: `Device Borrow Request - ${data.deviceName}`,
    html: getBaseEmailTemplate(content, 'Device Borrow Request'),
  })

  return result
}

export async function sendBorrowRequestToSupervisorEmail(
  supervisorEmail: string,
  data: BorrowRequestData
): Promise<{ success: boolean; error?: string }> {
  const content = `
    <h2>New Device Borrow Request</h2>
    <p>A new device borrow request requires your approval.</p>
    
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Employee:</span>
        <span class="info-value">${data.employeeName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Device:</span>
        <span class="info-value">${data.deviceName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Asset Tag:</span>
        <span class="info-value">${data.assetTag}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Borrow Date:</span>
        <span class="info-value">${data.borrowDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Expected Return Date:</span>
        <span class="info-value">${data.expectedReturnDate}</span>
      </div>
      ${data.purpose ? `
      <div class="info-row">
        <span class="info-label">Purpose:</span>
        <span class="info-value">${data.purpose}</span>
      </div>
      ` : ''}
    </div>
    
    <a href="${emailService.getAppUrl()}/ams-supervisor" class="button">Review Request</a>
  `

  const result = await emailService.sendEmail({
    to: supervisorEmail,
    subject: `Pending Device Borrow Request - ${data.employeeName}`,
    html: getBaseEmailTemplate(content, 'Pending Borrow Request'),
  })

  return result
}

// ============================================================================
// RETURN REQUEST TEMPLATES
// ============================================================================

export async function sendReturnRequestEmail(data: ReturnRequestData): Promise<{ success: boolean; error?: string }> {
  const content = `
    <h2>Device Return Request Submitted</h2>
    <p>Hello ${data.employeeName},</p>
    <p>Your device return request has been submitted and is pending supervisor approval.</p>
    
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Device:</span>
        <span class="info-value">${data.deviceName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Asset Tag:</span>
        <span class="info-value">${data.assetTag}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Borrow Date:</span>
        <span class="info-value">${data.borrowDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Return Date:</span>
        <span class="info-value">${data.returnDate}</span>
      </div>
    </div>
    
    <p>You will receive a notification once your return has been processed by a supervisor.</p>
  `

  const result = await emailService.sendEmail({
    to: data.employeeEmail,
    subject: `Device Return Request - ${data.deviceName}`,
    html: getBaseEmailTemplate(content, 'Device Return Request'),
  })

  return result
}

export async function sendReturnRequestToSupervisorEmail(
  supervisorEmail: string,
  data: ReturnRequestData
): Promise<{ success: boolean; error?: string }> {
  const content = `
    <h2>New Device Return Request</h2>
    <p>A device return request requires your approval.</p>
    
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Employee:</span>
        <span class="info-value">${data.employeeName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Device:</span>
        <span class="info-value">${data.deviceName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Asset Tag:</span>
        <span class="info-value">${data.assetTag}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Borrow Date:</span>
        <span class="info-value">${data.borrowDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Return Date:</span>
        <span class="info-value">${data.returnDate}</span>
      </div>
    </div>
    
    <a href="${emailService.getAppUrl()}/ams-supervisor" class="button">Review Return</a>
  `

  const result = await emailService.sendEmail({
    to: supervisorEmail,
    subject: `Pending Device Return - ${data.employeeName}`,
    html: getBaseEmailTemplate(content, 'Pending Return Request'),
  })

  return result
}

// ============================================================================
// PENDING BORROWS TEMPLATE
// ============================================================================

export async function sendPendingBorrowEmail(data: PendingBorrowData): Promise<{ success: boolean; error?: string }> {
  const content = `
    <h2>Pending Device Borrow</h2>
    <p>Hello ${data.employeeName},</p>
    <p>You have a pending device borrow that requires attention.</p>
    
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Device:</span>
        <span class="info-value">${data.deviceName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Asset Tag:</span>
        <span class="info-value">${data.assetTag}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Status:</span>
        <span class="info-value">${data.status}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Borrow Date:</span>
        <span class="info-value">${data.borrowDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Expected Return Date:</span>
        <span class="info-value">${data.expectedReturnDate}</span>
      </div>
    </div>
    
    <a href="${emailService.getAppUrl()}/ams-dashboard" class="button">View Details</a>
  `

  const result = await emailService.sendEmail({
    to: data.employeeEmail,
    subject: `Pending Device Borrow - ${data.deviceName}`,
    html: getBaseEmailTemplate(content, 'Pending Device Borrow'),
  })

  return result
}

// ============================================================================
// RETURN REMINDER TEMPLATE
// ============================================================================

export async function sendReturnReminderEmail(data: ReturnReminderData): Promise<{ success: boolean; error?: string }> {
  const daysText = data.daysRemaining === 0 
    ? 'today' 
    : data.daysRemaining === 1 
    ? 'tomorrow' 
    : `in ${data.daysRemaining} days`

  const content = `
    <h2>Device Return Reminder</h2>
    <p>Hello ${data.employeeName},</p>
    <p>This is a reminder that your borrowed device is due for return ${daysText}.</p>
    
    <div class="info-box warning">
      <div class="info-row">
        <span class="info-label">Device:</span>
        <span class="info-value"><strong>${data.deviceName}</strong></span>
      </div>
      <div class="info-row">
        <span class="info-label">Asset Tag:</span>
        <span class="info-value">${data.assetTag}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Expected Return Date:</span>
        <span class="info-value"><strong>${data.expectedReturnDate}</strong></span>
      </div>
      <div class="info-row">
        <span class="info-label">Days Remaining:</span>
        <span class="info-value"><strong>${data.daysRemaining}</strong></span>
      </div>
    </div>
    
    <p>Please ensure the device is returned on or before the expected return date.</p>
    <a href="${emailService.getAppUrl()}/ams-dashboard" class="button">View Borrow Details</a>
  `

  const result = await emailService.sendEmail({
    to: data.employeeEmail,
    subject: `Return Reminder: ${data.deviceName} due ${daysText}`,
    html: getBaseEmailTemplate(content, 'Device Return Reminder'),
  })

  return result
}

// ============================================================================
// SUPERVISOR UPDATE TEMPLATES (Maintenance & Incident Reports)
// ============================================================================

export async function sendSupervisorUpdateEmail(data: SupervisorUpdateData): Promise<{ success: boolean; error?: string }> {
  const updateTypeLabel = data.updateType === 'maintenance' ? 'Maintenance Update' : 'Incident Report Update'
  const priorityBadge = data.priority 
    ? `<span style="background-color: ${data.priority === 'high' ? '#ef4444' : data.priority === 'medium' ? '#f59e0b' : '#10b981'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${data.priority.toUpperCase()}</span>`
    : ''

  const content = `
    <h2>${updateTypeLabel}</h2>
    <p>Hello ${data.employeeName},</p>
    <p>You have received an update regarding a ${data.updateType === 'maintenance' ? 'maintenance request' : 'incident report'}.</p>
    
    <div class="info-box ${data.priority === 'high' ? 'error' : data.priority === 'medium' ? 'warning' : 'success'}">
      <div class="info-row">
        <span class="info-label">Update Type:</span>
        <span class="info-value">${updateTypeLabel}</span>
      </div>
      ${data.deviceName ? `
      <div class="info-row">
        <span class="info-label">Device:</span>
        <span class="info-value">${data.deviceName}</span>
      </div>
      ` : ''}
      ${data.assetTag ? `
      <div class="info-row">
        <span class="info-label">Asset Tag:</span>
        <span class="info-value">${data.assetTag}</span>
      </div>
      ` : ''}
      ${data.priority ? `
      <div class="info-row">
        <span class="info-label">Priority:</span>
        <span class="info-value">${priorityBadge}</span>
      </div>
      ` : ''}
      <div class="info-row">
        <span class="info-label">Title:</span>
        <span class="info-value"><strong>${data.title}</strong></span>
      </div>
    </div>
    
    <div style="background-color: #f9fafb; padding: 15px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Message:</strong></p>
      <p style="margin: 10px 0 0 0; white-space: pre-wrap;">${data.message}</p>
    </div>
    
    <a href="${emailService.getAppUrl()}/ams-maintenance" class="button">View Details</a>
  `

  const result = await emailService.sendEmail({
    to: data.employeeEmail,
    subject: `${updateTypeLabel}: ${data.title}`,
    html: getBaseEmailTemplate(content, updateTypeLabel),
  })

  return result
}

// ============================================================================
// BOOKING CONFLICT TEMPLATE
// ============================================================================

export async function sendBookingConflictEmail(data: BookingConflictData): Promise<{ success: boolean; error?: string }> {
  const content = `
    <h2>Room Booking Conflict</h2>
    <p>Hello ${data.employeeName},</p>
    <p>Unfortunately, your room booking request could not be completed due to a scheduling conflict.</p>
    
    <div class="info-box error">
      <div class="info-row">
        <span class="info-label">Room:</span>
        <span class="info-value">${data.roomName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Requested Date:</span>
        <span class="info-value">${data.requestedDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Requested Time:</span>
        <span class="info-value">${data.requestedTime}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Already Booked By:</span>
        <span class="info-value">${data.conflictingEmployeeName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Conflicting Time:</span>
        <span class="info-value">${data.conflictingTime}</span>
      </div>
    </div>
    
    <p>Please select a different time slot or room for your meeting.</p>
    <a href="${emailService.getAppUrl()}/ams-bookings" class="button">Book Another Room</a>
  `

  const result = await emailService.sendEmail({
    to: data.employeeEmail,
    subject: `Room Booking Conflict - ${data.roomName}`,
    html: getBaseEmailTemplate(content, 'Booking Conflict'),
  })

  return result
}

// ============================================================================
// MEETING CHECK-IN TEMPLATE
// ============================================================================

export async function sendMeetingCheckInEmail(data: MeetingCheckInData): Promise<{ success: boolean; error?: string }> {
  const content = `
    <h2>Meeting Check-In Confirmation</h2>
    <p>Hello ${data.employeeName},</p>
    <p>You have successfully checked in to your meeting.</p>
    
    <div class="info-box success">
      <div class="info-row">
        <span class="info-label">Room:</span>
        <span class="info-value">${data.roomName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Meeting Agenda:</span>
        <span class="info-value">${data.meetingAgenda}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Date:</span>
        <span class="info-value">${data.meetingDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Time:</span>
        <span class="info-value">${data.meetingTime}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Check-In Time:</span>
        <span class="info-value">${data.checkInTime}</span>
      </div>
    </div>
    
    <p>Your meeting attendance has been recorded. Have a productive meeting!</p>
    <a href="${emailService.getAppUrl()}/ams-dashboard" class="button">View Dashboard</a>
  `

  const result = await emailService.sendEmail({
    to: data.employeeEmail,
    subject: `Meeting Check-In: ${data.meetingAgenda}`,
    html: getBaseEmailTemplate(content, 'Meeting Check-In'),
  })

  return result
}

// ============================================================================
// MEETING CHECK-OUT TEMPLATE
// ============================================================================

export async function sendMeetingCheckOutEmail(data: MeetingCheckOutData): Promise<{ success: boolean; error?: string }> {
  const content = `
    <h2>Meeting Check-Out Confirmation</h2>
    <p>Hello ${data.employeeName},</p>
    <p>You have successfully checked out of your meeting.</p>
    
    <div class="info-box success">
      <div class="info-row">
        <span class="info-label">Room:</span>
        <span class="info-value">${data.roomName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Meeting Agenda:</span>
        <span class="info-value">${data.meetingAgenda}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Date:</span>
        <span class="info-value">${data.meetingDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Time:</span>
        <span class="info-value">${data.meetingTime}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Check-Out Time:</span>
        <span class="info-value">${data.checkOutTime}</span>
      </div>
    </div>
    
    <p>Thank you for using the room booking system. Your meeting has been marked as attended.</p>
    <a href="${emailService.getAppUrl()}/ams-dashboard" class="button">View Dashboard</a>
  `

  const result = await emailService.sendEmail({
    to: data.employeeEmail,
    subject: `Meeting Check-Out: ${data.meetingAgenda}`,
    html: getBaseEmailTemplate(content, 'Meeting Check-Out'),
  })

  return result
}

// ============================================================================
// MEETING RESCHEDULE TEMPLATE
// ============================================================================

export async function sendMeetingRescheduleEmail(data: MeetingRescheduleData): Promise<{ success: boolean; error?: string }> {
  const content = `
    <h2>Meeting Rescheduled</h2>
    <p>Hello ${data.employeeName},</p>
    <p>Your meeting has been successfully rescheduled. Please see the updated details below.</p>
    
    <div class="info-box warning">
      <h3 style="margin-top: 0; color: #92400e;">Previous Schedule</h3>
      <div class="info-row">
        <span class="info-label">Room:</span>
        <span class="info-value">${data.roomName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Date:</span>
        <span class="info-value">${data.originalDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Time:</span>
        <span class="info-value">${data.originalTime}</span>
      </div>
    </div>
    
    <div class="info-box success">
      <h3 style="margin-top: 0; color: #065f46;">New Schedule</h3>
      <div class="info-row">
        <span class="info-label">Room:</span>
        <span class="info-value"><strong>${data.roomName}</strong></span>
      </div>
      <div class="info-row">
        <span class="info-label">Date:</span>
        <span class="info-value"><strong>${data.newDate}</strong></span>
      </div>
      <div class="info-row">
        <span class="info-label">Time:</span>
        <span class="info-value"><strong>${data.newTime}</strong></span>
      </div>
      <div class="info-row">
        <span class="info-label">Meeting Agenda:</span>
        <span class="info-value">${data.meetingAgenda}</span>
      </div>
    </div>
    
    ${data.reason ? `
    <div style="background-color: #f9fafb; padding: 15px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Reason for reschedule:</strong></p>
      <p style="margin: 10px 0 0 0; white-space: pre-wrap;">${data.reason}</p>
    </div>
    ` : ''}
    
    <p>Please update your calendar with the new meeting time. We look forward to seeing you!</p>
    <a href="${emailService.getAppUrl()}/ams-bookings" class="button">View Booking Details</a>
  `

  const result = await emailService.sendEmail({
    to: data.employeeEmail,
    subject: `Meeting Rescheduled: ${data.meetingAgenda}`,
    html: getBaseEmailTemplate(content, 'Meeting Rescheduled'),
  })

  return result
}
