// ============================================================================
// LEAVE MANAGEMENT SERVICE - Repository Pattern Implementation
// ============================================================================
// This service handles all leave-related operations including balances,
// requests, approvals, and calculations
// ============================================================================

// ============================================================================
// CLEAN-SLATE LEAVE MANAGEMENT SERVICE
// ============================================================================
// This file now exposes minimal, no-op implementations so new leave logic
// can be designed without being constrained by the previous behaviour.
// The full previous implementation is preserved in:
//   lib/services/leave-service-legacy.ts
// ============================================================================

import { supabaseAdmin } from '@/lib/supabase-admin'

export interface LeaveBalance {
  id: string
  employee_id: string
  leave_type: 'sick' | 'annual' | 'unpaid' | 'maternity' | 'paternity' | 'family_responsibility' | 'other'
  total_entitled: number
  total_taken: number
  balance: number
  cycle_start_date: string
  cycle_end_date: string
  cap_warning_sent: boolean
  created_at: string
  updated_at: string
}

export interface LeaveRequest {
  id: string
  employee_id: string
  full_name: string
  employee_number: string
  id_number: string
  job_title: string
  direct_superior?: string
  leave_type: 'sick' | 'annual' | 'unpaid' | 'maternity' | 'paternity' | 'family_responsibility' | 'other'
  leave_type_other?: string
  leave_day_from: string
  leave_day_to: string
  total_days: number
  reason?: string
  supporting_document_url?: string
  leave_balance_before?: number
  leave_balance_after?: number
  employee_signature?: string
  employer_signature?: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason?: string
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
  updated_at: string
}

export interface CreateLeaveRequestData {
  employee_id: string
  full_name: string
  employee_number: string
  id_number: string
  job_title: string
  direct_superior?: string
  leave_type: 'sick' | 'annual' | 'unpaid' | 'maternity' | 'paternity' | 'family_responsibility' | 'other'
  leave_type_other?: string
  leave_day_from: string
  leave_day_to: string
  total_days: number
  reason?: string
  supporting_document_url?: string
  employee_signature?: string
}

export interface LeaveRequestFilters {
  employee_id?: string
  status?: 'pending' | 'approved' | 'rejected'
  leave_type?: string
  date_from?: string
  date_to?: string
  reviewed_by?: string
  limit?: number
  offset?: number
}

export class LeaveManagementService {
  // LEAVE BALANCE OPERATIONS --------------------------------------------------

  async getLeaveBalances(employeeId: string): Promise<LeaveBalance[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('leave_balances')
        .select('*')
        .eq('employee_id', employeeId)
        .order('leave_type')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching leave balances:', error)
      throw new Error('Failed to fetch leave balances')
    }
  }

  async getLeaveBalance(employeeId: string, leaveType: string): Promise<LeaveBalance | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('leave_balances')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('leave_type', leaveType)
        .maybeSingle()

      if (error) throw error
      return data ?? null
    } catch (error) {
      console.error('Error fetching leave balance:', error)
      return null
    }
  }

  async upsertLeaveBalance(balanceData: Partial<LeaveBalance>): Promise<LeaveBalance> {
    try {
      const { data, error } = await supabaseAdmin
        .from('leave_balances')
        .upsert(balanceData, { onConflict: 'employee_id,leave_type,cycle_start_date' })
        .select()
        .single()

      if (error) throw error
      return data as LeaveBalance
    } catch (error) {
      console.error('Error upserting leave balance:', error)
      throw new Error('Failed to upsert leave balance')
    }
  }

  /**
   * Initialize annual leave balance for a new employee based on hire date.
   *
   * First iteration rule:
   * - Create a 12‑month annual leave cycle starting from date_hired.
   * - Annual leave accrues monthly (1 day/month, max 12/year), so we start
   *   with 0 entitled days and let accrual logic increase it over time.
   */
  async initializeAnnualLeaveForNewEmployee(employeeId: string, dateHired: string): Promise<void> {
    try {
      const start = new Date(dateHired)
      if (Number.isNaN(start.getTime())) {
        throw new Error(`Invalid date_hired: ${dateHired}`)
      }

      const end = new Date(start)
      end.setFullYear(end.getFullYear() + 1)
      end.setDate(end.getDate() - 1)

      const cycleStart = start.toISOString().slice(0, 10)
      const cycleEnd = end.toISOString().slice(0, 10)

      await this.upsertLeaveBalance({
        employee_id: employeeId,
        leave_type: 'annual',
        total_entitled: 0,
        total_taken: 0,
        cycle_start_date: cycleStart,
        cycle_end_date: cycleEnd,
      } as Partial<LeaveBalance>)
    } catch (error) {
      console.error('Error initializing annual leave for new employee:', error)
      throw new Error('Failed to initialize annual leave for employee')
    }
  }

  // LEAVE REQUEST OPERATIONS --------------------------------------------------

  async getLeaveRequests(_filters?: LeaveRequestFilters): Promise<LeaveRequest[]> {
    return []
  }

  async getPendingLeaveRequests(): Promise<LeaveRequest[]> {
    return []
  }

  async getLeaveRequestById(_id: string): Promise<LeaveRequest | null> {
    return null
  }

  async createLeaveRequest(_requestData: CreateLeaveRequestData): Promise<LeaveRequest> {
    throw new Error('Leave request creation is not implemented yet')
  }

  async approveLeaveRequest(_id: string, _reviewedBy: string): Promise<LeaveRequest | null> {
    throw new Error('Leave approval is not implemented yet')
  }

  async rejectLeaveRequest(
    _id: string,
    _reviewedBy: string,
    _reason: string,
  ): Promise<LeaveRequest | null> {
    throw new Error('Leave rejection is not implemented yet')
  }

  // CALCULATION & REPORTING ---------------------------------------------------

  calculateWorkingDays(_startDate: string, _endDate: string): number {
    return 0
  }

  async getLeaveSummary(): Promise<any[]> {
    return []
  }

  async getLeaveRequestsByDateRange(
    _startDate: string,
    _endDate: string,
  ): Promise<LeaveRequest[]> {
    return []
  }

  async getLeaveStatistics(): Promise<{
    totalRequests: number
    pendingRequests: number
    approvedRequests: number
    rejectedRequests: number
    totalDaysTaken: number
  }> {
    return {
      totalRequests: 0,
      pendingRequests: 0,
      approvedRequests: 0,
      rejectedRequests: 0,
      totalDaysTaken: 0,
    }
  }
}

export const leaveManagementService = new LeaveManagementService()
export default leaveManagementService

