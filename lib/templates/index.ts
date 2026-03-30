// ============================================================================
// EMAIL TEMPLATES INDEX - Export all email template functions
// ============================================================================

// Asset Management System Templates
export {
  sendBorrowRequestEmail,
  sendBorrowRequestToSupervisorEmail,
  sendReturnRequestEmail,
  sendReturnRequestToSupervisorEmail,
  sendPendingBorrowEmail,
  sendReturnReminderEmail,
  sendSupervisorUpdateEmail,
  sendBookingConflictEmail,
  sendMeetingCheckInEmail,
  sendMeetingCheckOutEmail,
  sendMeetingRescheduleEmail,
  type BorrowRequestData,
  type ReturnRequestData,
  type PendingBorrowData,
  type ReturnReminderData,
  type SupervisorUpdateData,
  type BookingConflictData,
  type MeetingCheckInData,
  type MeetingCheckOutData,
  type MeetingRescheduleData,
} from './ams-templates'

// HR Management System Templates
// Export HRMS templates as they are added
// export { ... } from './hrms-templates'

// Email Service
export { emailService, EmailService, type EmailOptions, type SendEmailResult } from '../services/email-service'
