import { supabase } from '@/lib/supabase'

// Database types matching our schema
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
  // ============================================================================
  // LEAVE BALANCE OPERATIONS
  // ============================================================================

  /**
   * Get leave balances for an employee
   */
  async getLeaveBalances(employeeId: string): Promise<LeaveBalance[]> {
    try {
      const { data, error } = await supabase
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

  /**
   * Get leave balance for specific type and employee
   */
  async getLeaveBalance(employeeId: string, leaveType: string): Promise<LeaveBalance | null> {
    try {
      const { data, error } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('leave_type', leaveType)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching leave balance:', error)
      return null
    }
  }

  /**
   * Create or update leave balance
   */
  async upsertLeaveBalance(balanceData: Partial<LeaveBalance>): Promise<LeaveBalance> {
    try {
      const { data, error } = await supabase
        .from('leave_balances')
        .upsert(balanceData)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error upserting leave balance:', error)
      throw new Error('Failed to update leave balance')
    }
  }

  /**
   * Initialize leave balances for new employee
   */
  async initializeLeaveBalances(employeeId: string, cycleStart: string, cycleEnd: string): Promise<void> {
    try {
      const leaveTypes = ['annual', 'sick', 'maternity', 'paternity', 'family_responsibility']
      
      const balanceData = leaveTypes.map(leaveType => ({
        employee_id: employeeId,
        leave_type: leaveType,
        total_entitled: this.getDefaultEntitlement(leaveType),
        total_taken: 0,
        cycle_start_date: cycleStart,
        cycle_end_date: cycleEnd
      }))

      const { error } = await supabase
        .from('leave_balances')
        .insert(balanceData)

      if (error) throw error
    } catch (error) {
      console.error('Error initializing leave balances:', error)
      throw new Error('Failed to initialize leave balances')
    }
  }

  // ============================================================================
  // LEAVE REQUEST OPERATIONS
  // ============================================================================

  /**
   * Get all leave requests with optional filtering
   */
  async getLeaveRequests(filters?: LeaveRequestFilters): Promise<LeaveRequest[]> {
    try {
      let query = supabase
        .from('leave_requests')
        .select('*')

      // Apply filters
      if (filters?.employee_id) {
        query = query.eq('employee_id', filters.employee_id)
      }

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      if (filters?.leave_type) {
        query = query.eq('leave_type', filters.leave_type)
      }

      if (filters?.date_from) {
        query = query.gte('leave_day_from', filters.date_from)
      }

      if (filters?.date_to) {
        query = query.lte('leave_day_to', filters.date_to)
      }

      if (filters?.limit) {
        query = query.limit(filters.limit)
      }

      if (filters?.offset) {
        query = query.range(filters.offset, (filters.offset || 0) + (filters.limit || 50) - 1)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching leave requests:', error)
      throw new Error('Failed to fetch leave requests')
    }
  }

  /**
   * Get pending leave requests
   */
  async getPendingLeaveRequests(): Promise<LeaveRequest[]> {
    try {
      const { data, error } = await supabase
        .from('pending_leave_requests')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching pending leave requests:', error)
      throw new Error('Failed to fetch pending leave requests')
    }
  }

  /**
   * Get leave request by ID
   */
  async getLeaveRequestById(id: string): Promise<LeaveRequest | null> {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching leave request by ID:', error)
      return null
    }
  }

  /**
   * Create a new leave request
   */
  async createLeaveRequest(requestData: CreateLeaveRequestData): Promise<LeaveRequest> {
    try {
      // Check if employee has sufficient leave balance
      const balance = await this.getLeaveBalance(requestData.employee_id, requestData.leave_type)
      
      if (balance && balance.balance < requestData.total_days) {
        throw new Error(`Insufficient leave balance. Available: ${balance.balance} days, Requested: ${requestData.total_days} days`)
      }

      // Set leave balance before request
      const leaveBalanceBefore = balance?.balance || 0

      const { data, error } = await supabase
        .from('leave_requests')
        .insert([{
          ...requestData,
          leave_balance_before: leaveBalanceBefore
        }])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating leave request:', error)
      throw error
    }
  }

  /**
   * Approve leave request
   */
  async approveLeaveRequest(id: string, reviewedBy: string): Promise<LeaveRequest | null> {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .update({
          status: 'approved',
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error approving leave request:', error)
      throw new Error('Failed to approve leave request')
    }
  }

  /**
   * Reject leave request
   */
  async rejectLeaveRequest(id: string, reviewedBy: string, reason: string): Promise<LeaveRequest | null> {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error rejecting leave request:', error)
      throw new Error('Failed to reject leave request')
    }
  }

  // ============================================================================
  // CALCULATION OPERATIONS
  // ============================================================================

  /**
   * Calculate working days between two dates (excluding weekends)
   */
  calculateWorkingDays(startDate: string, endDate: string): number {
    const start = new Date(startDate)
    const end = new Date(endDate)
    let count = 0

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
        count++
      }
    }

    return count
  }

  /**
   * Get default leave entitlement by type
   */
  private getDefaultEntitlement(leaveType: string): number {
    const entitlements: Record<string, number> = {
      'annual': 21, // 21 days annual leave
      'sick': 30,   // 30 days sick leave
      'maternity': 120, // 4 months maternity leave
      'paternity': 10,  // 10 days paternity leave
      'family_responsibility': 3, // 3 days family responsibility leave
      'unpaid': 0,  // Unlimited unpaid leave
      'other': 0    // No default entitlement
    }

    return entitlements[leaveType] || 0
  }

  // ============================================================================
  // REPORTING OPERATIONS
  // ============================================================================

  /**
   * Get leave summary for all employees
   */
  async getLeaveSummary(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('employee_leave_summary')
        .select('*')
        .order('employee_number')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching leave summary:', error)
      throw new Error('Failed to fetch leave summary')
    }
  }

  /**
   * Get leave requests by date range
   */
  async getLeaveRequestsByDateRange(startDate: string, endDate: string): Promise<LeaveRequest[]> {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .gte('leave_day_from', startDate)
        .lte('leave_day_to', endDate)
        .order('leave_day_from')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching leave requests by date range:', error)
      throw new Error('Failed to fetch leave requests by date range')
    }
  }

  /**
   * Get leave statistics
   */
  async getLeaveStatistics(): Promise<{
    totalRequests: number
    pendingRequests: number
    approvedRequests: number
    rejectedRequests: number
    totalDaysTaken: number
  }> {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('status, total_days')

      if (error) throw error

      const stats = data.reduce((acc: any, request: { status: string; total_days: number }) => {
        acc.totalRequests++
        acc[`${request.status}Requests`]++
        acc.totalDaysTaken += request.total_days
        return acc
      }, {
        totalRequests: 0,
        pendingRequests: 0,
        approvedRequests: 0,
        rejectedRequests: 0,
        totalDaysTaken: 0
      })

      return stats
    } catch (error) {
      console.error('Error fetching leave statistics:', error)
      throw new Error('Failed to fetch leave statistics')
    }
  }
}

// Export singleton instance
export const leaveManagementService = new LeaveManagementService()
export default leaveManagementService


