import { z } from "zod"
import { differenceInCalendarDays } from "date-fns"

// ============================================================================
// CLEAN-SLATE LEAVE VALIDATION
// ============================================================================
// This file intentionally contains only minimal, generic rules so that
// new leave management logic can be designed from scratch.
// The previous detailed implementation is preserved in:
//   lib/validation/leave-legacy.ts
// ============================================================================

// Leave type enum (kept for UI compatibility)
export const leaveTypeEnum = z.enum([
  "sick",
  "annual", 
  "unpaid",
  "maternity",
  "paternity",
  "family_responsibility",
  "other",
])

// Leave status enum (kept for UI compatibility)
export const leaveStatusEnum = z.enum([
  "pending",
  "approved", 
  "rejected",
  "cancelled",
])

// Minimal leave request schema – structure only, no domain rules
export const leaveRequestSchema = z.object({
  employee_id: z.string(),
  full_name: z.string(),
  employee_number: z.string(),
  id_number: z.string().optional(),
  job_title: z.string().optional(),
  department: z.string().optional(),
  email: z.string().optional(),
  direct_superior: z.string().optional(),
  
  leave_type: leaveTypeEnum,
  leave_type_other: z.string().optional(),
  reason: z.string().optional(),
  
  leave_day_from: z.date().nullable().optional(),
  leave_day_to: z.date().nullable().optional(),
  
  total_days: z.number().optional(),
  leave_balance_before: z.number().optional(),
  leave_balance_after: z.number().optional(),
  
  supporting_document_url: z.string().optional(),
  employee_signature: z.string().optional(),
  employer_signature: z.string().optional(),

  status: leaveStatusEnum.default("pending"),
  rejection_reason: z.string().optional(),
  approver_comment: z.string().optional(),
  reviewed_by: z.string().optional(),
  reviewed_at: z.date().optional(),
  
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
})

export type LeaveRequestFormData = z.infer<typeof leaveRequestSchema>

// ---------------------------------------------------------------------------
// Minimal helper implementations (no business rules, just placeholders)
// ---------------------------------------------------------------------------

export const calculateLeaveBalance = (
  _employeeId: string,
  _leaveType: string,
  _dateHired?: Date,
): number => {
  // Placeholder: always zero until new logic is defined
  return 0
}

export const calculateAnnualLeaveBalance = (_dateHired?: Date): number => {
  return 0
}

export const calculateWorkingDays = (startDate: Date, endDate: Date): number => {
  if (!startDate || !endDate) return 0
  const diff = differenceInCalendarDays(endDate, startDate) + 1
  return diff > 0 ? diff : 0
}

export const checkLeaveEligibility = (
  _leaveType: string,
  _dateHired?: Date,
): { eligible: boolean; reason?: string } => {
  // Placeholder: always eligible for now
  return { eligible: true }
}

export const leaveAccrualRules = {
  // Intentionally minimal; fill in with new rules later
}

export const validateLeaveRequest = (
  data: unknown,
): { success: boolean; errors?: any[] } => {
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

export const checkOverlappingRequests = async (
  _employeeId: string,
  _startDate: Date,
  _endDate: Date,
  _excludeId?: string,
): Promise<boolean> => {
  // Placeholder: no overlap logic yet
  return false
}

export const getLeaveTypeDisplayName = (type: string): string => {
  const displayNames: Record<string, string> = {
    sick: "Sick Leave",
    annual: "Annual Leave",
    unpaid: "Unpaid Leave",
    maternity: "Maternity Leave",
    paternity: "Paternity Leave",
    family_responsibility: "Family Responsibility Leave",
    other: "Other",
  }
  return displayNames[type] || type
}

export const getLeaveStatusInfo = (
  status: string,
): { name: string; color: string; variant: "default" | "secondary" | "destructive" } => {
  const statusInfo: Record<string, { name: string; color: string; variant: "default" | "secondary" | "destructive" }> = {
    pending: { name: "Pending", color: "text-yellow-600", variant: "secondary" },
    approved: { name: "Approved", color: "text-green-600", variant: "default" },
    rejected: { name: "Rejected", color: "text-red-600", variant: "destructive" },
  }
  return statusInfo[status] || { name: status, color: "text-gray-600", variant: "secondary" }
}

