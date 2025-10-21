import { z } from "zod"
import { addDays, isBefore, isAfter, isSameDay, eachDayOfInterval, isWeekend, differenceInMonths, differenceInDays } from "date-fns"

// Leave type enum
export const leaveTypeEnum = z.enum([
  "sick",
  "annual", 
  "unpaid",
  "maternity",
  "paternity",
  "family_responsibility",
  "other"
])

// Leave status enum
export const leaveStatusEnum = z.enum([
  "pending",
  "approved", 
  "rejected",
  "cancelled"
])

// Alert level enum for notes
export const alertLevelEnum = z.enum([
  "high",
  "medium", 
  "low"
])

// Visibility enum for notes
export const visibilityEnum = z.enum([
  "personal",
  "public"
])

// Reminder repeat enum
export const reminderRepeatEnum = z.enum([
  "none",
  "daily",
  "weekly", 
  "monthly"
])

// Notes validation schema
export const noteSchema = z.object({
  note_id: z.string().uuid().optional(),
  employee_id: z.string().uuid("Invalid employee ID format."),
  author_id: z.string().uuid("Invalid author ID format."),
  author_role: z.string().min(1, "Author role is required."),
  content: z.string().min(1, "Note content is required.").max(2000, "Note content cannot exceed 2000 characters."),
  created_at: z.date().default(() => new Date()),
  updated_at: z.date().default(() => new Date()),
  reminder_at: z.date().optional(),
  alert_level: alertLevelEnum.default("low"),
  visibility: visibilityEnum.default("personal"),
  reminder_enabled: z.boolean().default(false),
  reminder_repeat: reminderRepeatEnum.default("none"),
  pinned: z.boolean().default(false),
  attachments: z.array(z.string().url()).default([]),
  tags: z.string().optional(),
  status: z.enum(["active", "archived"]).default("active"),
})

export type NoteFormData = z.infer<typeof noteSchema>

// Leave request validation schema
export const leaveRequestSchema = z.object({
  // Auto-filled from profile (read-only)
  employee_id: z.string().uuid("Invalid employee ID format."),
  full_name: z.string().min(1, "Full name is required."),
  employee_number: z.string().min(1, "Employee number is required."),
  id_number: z.string().length(13, "ID Number must be 13 digits.").optional(),
  job_title: z.string().min(1, "Job title is required."),
  department: z.string().optional(),
  email: z.string().email("Invalid email format.").optional(),
  direct_superior: z.string().optional(),
  
  // User input fields
  leave_type: leaveTypeEnum,
  leave_type_other: z.string().max(255).optional(),
  reason: z.string().min(10, "Reason for leave must be at least 10 characters.").max(500, "Reason cannot exceed 500 characters."),
  
  // Date fields
  leave_day_from: z.date({
    required_error: "Start date is required.",
  }).refine((date) => isAfter(date, addDays(new Date(), -1)), {
    message: "Leave start date cannot be in the past.",
  }),
  leave_day_to: z.date({
    required_error: "End date is required.",
  }),
  
  // Auto-calculated fields
  total_days: z.number().min(0.5, "Leave duration must be at least half a day."),
  leave_balance_before: z.number().optional(),
  leave_balance_after: z.number().optional(),
  
  // Document fields
  supporting_document_url: z.string().url("Invalid document URL.").optional().or(z.literal("")),
  employee_signature: z.string().optional(), // Base64 or URL
  employer_signature: z.string().optional(), // Base64 or URL, admin field
  
  // Status and approval
  status: leaveStatusEnum.default("pending"),
  rejection_reason: z.string().optional(),
  approver_comment: z.string().optional(),
  reviewed_by: z.string().uuid("Invalid reviewer ID format.").optional(),
  reviewed_at: z.date().optional(),
  
  // Timestamps
  created_at: z.date().default(() => new Date()),
  updated_at: z.date().default(() => new Date()),
}).superRefine((data, ctx) => {
  // Ensure leave_day_from is before or same as leave_day_to
  if (data.leave_day_from && data.leave_day_to && isAfter(data.leave_day_from, data.leave_day_to)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Leave start date cannot be after end date.",
      path: ["leave_day_to"],
    })
  }
  
  // If leave type is 'other', 'leave_type_other' must be provided
  if (data.leave_type === "other" && (!data.leave_type_other || data.leave_type_other.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please specify the leave type.",
      path: ["leave_type_other"],
    })
  }
  
  // Validate leave balance
  if (data.leave_balance_before !== undefined && data.total_days > data.leave_balance_before && data.leave_type !== "unpaid") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Insufficient leave balance. Available: ${data.leave_balance_before} days, Requested: ${data.total_days} days.`,
      path: ["total_days"],
    })
  }
})

export type LeaveRequestFormData = z.infer<typeof leaveRequestSchema>

// South African Public Holidays 2024-2025 (simplified list)
const SA_PUBLIC_HOLIDAYS = [
  "2024-01-01", "2024-03-21", "2024-03-29", "2024-04-01", "2024-04-27", "2024-05-01", "2024-06-16", "2024-08-09", "2024-09-24", "2024-12-16", "2024-12-25", "2024-12-26",
  "2025-01-01", "2025-03-21", "2025-04-18", "2025-04-21", "2025-04-27", "2025-05-01", "2025-06-16", "2025-08-09", "2025-09-24", "2025-12-16", "2025-12-25", "2025-12-26"
]

// Leave balance calculation functions with South African rules
export const calculateLeaveBalance = (employeeId: string, leaveType: string, dateHired?: Date): number => {
  // Mock implementation - replace with actual database query
  const mockBalances: Record<string, number> = {
    "annual": calculateAnnualLeaveBalance(dateHired),
    "sick": 30, // 30 days per 36-month cycle
    "family_responsibility": 3, // 3 days per 12 months
    "maternity": 120, // 4 months (120 days) per event
    "paternity": 10, // 10 days per event
    "unpaid": 999, // Effectively unlimited
  }
  
  return mockBalances[leaveType] || 0
}

// Calculate annual leave balance based on South African rules
export const calculateAnnualLeaveBalance = (dateHired?: Date): number => {
  if (!dateHired) return 0
  
  const monthsWorked = differenceInMonths(new Date(), dateHired)
  const annualLeaveAccrued = Math.min(monthsWorked, 19) // Cap at 19 days
  return annualLeaveAccrued
}

export const calculateWorkingDays = (startDate: Date, endDate: Date): number => {
  const days = eachDayOfInterval({ start: startDate, end: endDate })
  const workingDays = days.filter(day => {
    // Exclude weekends
    if (isWeekend(day)) return false
    
    // Exclude public holidays
    const dateStr = day.toISOString().split('T')[0]
    if (SA_PUBLIC_HOLIDAYS.includes(dateStr)) return false
    
    return true
  }).length
  
  // Round to nearest 0.5 day
  return Math.round(workingDays * 2) / 2
}

// Check if employee is eligible for specific leave types
export const checkLeaveEligibility = (leaveType: string, dateHired?: Date): { eligible: boolean; reason?: string } => {
  if (!dateHired) {
    return { eligible: false, reason: "Employment start date required" }
  }
  
  const monthsWorked = differenceInMonths(new Date(), dateHired)
  
  switch (leaveType) {
    case "maternity":
    case "paternity":
      if (monthsWorked < 4) {
        return { eligible: false, reason: "Must be employed for at least 4 months" }
      }
      break
    case "family_responsibility":
      if (monthsWorked < 1) {
        return { eligible: false, reason: "Must be employed for at least 1 month" }
      }
      break
  }
  
  return { eligible: true }
}

// Leave accrual rules
export const leaveAccrualRules = {
  annual: {
    accrualRate: 1, // 1 day per completed month
    maxBalance: 19, // Cap at 19 days
    carryover: true,
    cycle: "monthly"
  },
  sick: {
    accrualRate: 30, // 30 days per cycle
    maxBalance: 30,
    carryover: false,
    cycle: "36-months"
  },
  family_responsibility: {
    accrualRate: 3, // 3 days per cycle
    maxBalance: 3,
    carryover: false,
    cycle: "yearly"
  },
  maternity: {
    accrualRate: 120, // 4 months (120 days)
    maxBalance: 120,
    carryover: false,
    cycle: "per-event"
  },
  paternity: {
    accrualRate: 10, // 10 days
    maxBalance: 10,
    carryover: false,
    cycle: "per-event"
  },
  unpaid: {
    accrualRate: 0, // No accrual
    maxBalance: 999, // Effectively unlimited
    carryover: false,
    cycle: "manual"
  }
}

// Validation helper functions
export const validateLeaveRequest = (data: unknown): { success: boolean; errors?: any[] } => {
  try {
    leaveRequestSchema.parse(data)
    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    return { success: false, errors: [{ message: "Validation failed" }] }
  }
}

// Check for overlapping leave requests
export const checkOverlappingRequests = async (employeeId: string, startDate: Date, endDate: Date, excludeId?: string): Promise<boolean> => {
  // Mock implementation - replace with actual database query
  // This would check for existing approved/pending leave requests that overlap with the new dates
  return false // No overlaps found
}

// Get leave type display name
export const getLeaveTypeDisplayName = (type: string): string => {
  const displayNames: Record<string, string> = {
    "sick": "Sick Leave",
    "annual": "Annual Leave", 
    "unpaid": "Unpaid Leave",
    "maternity": "Maternity Leave",
    "paternity": "Paternity Leave",
    "family_responsibility": "Family Responsibility Leave",
    "other": "Other"
  }
  return displayNames[type] || type
}

// Get leave status display name and color
export const getLeaveStatusInfo = (status: string) => {
  const statusInfo: Record<string, { name: string; color: string; variant: "default" | "secondary" | "destructive" }> = {
    "pending": { name: "Pending", color: "text-yellow-600", variant: "secondary" },
    "approved": { name: "Approved", color: "text-green-600", variant: "default" },
    "rejected": { name: "Rejected", color: "text-red-600", variant: "destructive" }
  }
  return statusInfo[status] || { name: status, color: "text-gray-600", variant: "secondary" }
}
