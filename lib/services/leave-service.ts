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
  leave_type_id: string // UUID foreign key to leave_types
  cycle_start_date: string
  cycle_end_date: string
  total_accrued: number
  total_used: number
  total_pending: number
  carried_over: number
  available_balance: number // Computed: ((total_accrued + carried_over) - total_used) - total_pending
  created_at: string
  updated_at: string
  leave_types?: {
    key: string
  } | null
}

export interface LeaveRequest {
  id: string
  employee_id: string
  leave_type_id: string // UUID foreign key to leave_types
  start_date: string // DATE format (YYYY-MM-DD)
  end_date: string // DATE format (YYYY-MM-DD)
  total_days: number
  reason?: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  submitted_at: string
  submitted_by: string
  reviewed_at?: string
  reviewed_by?: string
  review_notes?: string
  document_url?: string
  document_required: boolean
  created_at: string
  updated_at: string
}

export interface CreateLeaveRequestData {
  employee_id: string
  leave_type: 'sick' | 'annual' | 'unpaid' | 'maternity' | 'paternity' | 'family_responsibility' | 'other' // Key from leave_types
  start_date: string // DATE format (YYYY-MM-DD)
  end_date: string // DATE format (YYYY-MM-DD)
  total_days: number // Calculated working days
  reason?: string
  document_url?: string
  document_required?: boolean
  submitted_by: string // UUID of employee submitting
}

export interface LeaveRequestFilters {
  employee_id?: string
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled'
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
        .select('*, leave_types(key)')
        .eq('employee_id', employeeId)
        .order('cycle_start_date', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching leave balances:', error)
      throw new Error('Failed to fetch leave balances')
    }
  }

  async getLeaveBalance(employeeId: string, leaveType: string): Promise<LeaveBalance | null> {
    try {
      // First get leave_type_id from leave_types table
      const { data: leaveTypeData, error: ltError } = await supabaseAdmin
        .from('leave_types')
        .select('id')
        .eq('key', leaveType)
        .single()

      if (ltError || !leaveTypeData) {
        return null
      }

      const { data, error } = await supabaseAdmin
        .from('leave_balances')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('leave_type_id', leaveTypeData.id)
        .order('cycle_start_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data ?? null
    } catch (error) {
      console.error('Error fetching leave balance:', error)
      return null
    }
  }

  /**
   * Get available balance for a specific employee and leave type
   * Returns the computed available_balance: ((total_accrued + carried_over) - total_used) - total_pending
   */
  async getAvailableBalance(employeeId: string, leaveType: string): Promise<number> {
    try {
      const balance = await this.getLeaveBalance(employeeId, leaveType)
      
      if (!balance) {
        return 0
      }

      // Calculate available balance: ((total_accrued + carried_over) - total_used) - total_pending
      const availableBalance = ((balance.total_accrued || 0) + (balance.carried_over || 0)) - 
                               (balance.total_used || 0) - 
                               (balance.total_pending || 0)

      return Math.max(0, availableBalance) // Ensure non-negative
    } catch (error) {
      console.error('Error fetching available balance:', error)
      return 0
    }
  }

  async upsertLeaveBalance(balanceData: Partial<LeaveBalance>): Promise<LeaveBalance> {
    try {
      const { data, error } = await supabaseAdmin
        .from('leave_balances')
        .upsert(balanceData, { onConflict: 'employee_id,leave_type_id,cycle_start_date' })
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
   * Initialize core leave balances for a new employee, based on hire date.
   *
   * This mirrors the test SQL in `database/leave-testing-queries.md` and the
   * configured `leave_types`:
   * - annual:   12‑month cycle, starts at 0 (monthly accrual 1 day/month, max 12/year).
   * - sick:     36‑month cycle, starts at 0.
   * - unpaid:   12‑month cycle, effectively unlimited (starts at 999).
   * - maternity, paternity, other: 12‑month cycles, all start at 0.
   */
  async initializeCoreLeaveBalancesForNewEmployee(
    employeeId: string,
    dateHired: string,
  ): Promise<void> {
    try {
      const start = new Date(dateHired)
      if (Number.isNaN(start.getTime())) {
        throw new Error(`Invalid date_hired: ${dateHired}`)
      }

      const ymd = (d: Date) => d.toISOString().slice(0, 10)

      // Resolve leave_type_ids and cycle hints from leave_types table
      const { data: leaveTypes, error: ltError } = await supabaseAdmin
        .from('leave_types')
        .select('id,key,cycle_months')
        .in('key', ['annual', 'sick', 'unpaid', 'maternity', 'paternity', 'other'])

      if (ltError) throw ltError
      if (!leaveTypes || leaveTypes.length === 0) {
        throw new Error('No leave_types found for core leave keys')
      }

      const findType = (key: string) =>
        leaveTypes.find((lt: any) => lt.key === key) as { id: string; key: string; cycle_months?: number } | undefined

      const configs = [
        { key: 'annual', totalAccrued: 0 },
        { key: 'sick', totalAccrued: 0 },
        { key: 'unpaid', totalAccrued: 999 },
        { key: 'maternity', totalAccrued: 0 },
        { key: 'paternity', totalAccrued: 0 },
        { key: 'other', totalAccrued: 0 },
      ] as const

      const rows = configs
        .map((cfg) => {
          const type = findType(cfg.key)
          if (!type?.id) {
            console.warn(`initializeCoreLeaveBalancesForNewEmployee: missing leave_type ${cfg.key}`)
            return null
          }

          // Default to 12 months if cycle_months is null/undefined
          const months = (type as any).cycle_months ?? (cfg.key === 'sick' ? 36 : 12)

          const cycleStart = new Date(start)
          const cycleEnd = new Date(cycleStart)
          cycleEnd.setMonth(cycleEnd.getMonth() + months)
          cycleEnd.setDate(cycleEnd.getDate() - 1)

          return {
        employee_id: employeeId,
            leave_type_id: type.id,
            cycle_start_date: ymd(cycleStart),
            cycle_end_date: ymd(cycleEnd),
            total_accrued: cfg.totalAccrued,
            total_used: 0.0,
            total_pending: 0.0,
            carried_over: 0.0,
          }
        })
        .filter(Boolean) as any[]

      const { error: insertError } = await supabaseAdmin
        .from('leave_balances')
        .insert(rows)

      if (insertError) throw insertError
    } catch (error) {
      console.error('Error initializing core leave balances for new employee:', error)
      throw new Error('Failed to initialize leave balances for employee')
    }
  }

  // LEAVE ACCRUAL OPERATIONS --------------------------------------------------

  /**
   * Accrue annual leave for an employee (monthly accrual: 1 day/month).
   * 
   * This mirrors the SQL in `database/leave-testing-queries.md` (lines 179-204):
   * - Inserts a record into `leave_accrual_history`
   * - Updates `leave_balances.total_accrued` by the accrual amount
   */
  async accrueAnnualLeave(
    employeeId: string,
    accrualDate: string, // ISO date string (YYYY-MM-DD)
    amount: number = 1.0,
    notes?: string,
  ): Promise<void> {
    try {
      // Find the annual leave balance for this employee
      const { data: leaveType, error: ltError } = await supabaseAdmin
        .from('leave_types')
        .select('id')
        .eq('key', 'annual')
        .single()

      if (ltError || !leaveType) {
        throw new Error('Annual leave type not found')
      }

      const { data: balance, error: balError } = await supabaseAdmin
        .from('leave_balances')
        .select('id,total_accrued')
        .eq('employee_id', employeeId)
        .eq('leave_type_id', leaveType.id)
        .order('cycle_start_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (balError) throw balError
      if (!balance) {
        throw new Error(`No annual leave balance found for employee ${employeeId}`)
      }

      // Check if accrual already exists for this month to prevent duplicates
      const hasAccrued = await this.hasAccruedAnnualLeaveThisMonth(
        employeeId,
        leaveType.id,
        accrualDate,
      )

      if (hasAccrued) {
        // Already accrued for this month, skip silently
        return
      }

      // Annual leave capped at 20 days max
      const currentTotalAccrued = balance.total_accrued || 0
      const nextTotalAccrued = currentTotalAccrued + amount
      const cappedTotalAccrued = Math.min(nextTotalAccrued, 20)
      const creditedAmount = Math.max(0, cappedTotalAccrued - currentTotalAccrued)

      // If we're already at the cap, do not insert history or update balance.
      if (creditedAmount <= 0) {
        return
      }

      // Insert accrual history record
      const { error: histError } = await supabaseAdmin
        .from('leave_accrual_history')
        .insert({
          employee_id: employeeId,
          leave_type_id: leaveType.id,
          balance_id: balance.id,
          accrual_date: accrualDate,
          amount: creditedAmount,
          accrual_reason: 'monthly',
          notes: notes || `Monthly accrual for ${new Date(accrualDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        })

      if (histError) throw histError

      // Update balance total_accrued
      const { error: updateError } = await supabaseAdmin
        .from('leave_balances')
        .update({ total_accrued: cappedTotalAccrued })
        .eq('id', balance.id)

      if (updateError) throw updateError
    } catch (error) {
      console.error('Error accruing annual leave:', error)
      throw new Error('Failed to accrue annual leave')
    }
  }

  /**
   * Check if employee has already accrued sick leave for this month
   */
  private async hasAccruedSickLeaveThisMonth(
    employeeId: string,
    leaveTypeId: string,
    accrualDate: string,
  ): Promise<boolean> {
    const accrualMonth = accrualDate.slice(0, 7) // YYYY-MM
    const { data, error } = await supabaseAdmin
      .from('leave_accrual_history')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('leave_type_id', leaveTypeId)
      .eq('accrual_reason', 'monthly')
      .gte('accrual_date', `${accrualMonth}-01`)
      .lt('accrual_date', `${accrualMonth}-32`)
      .limit(1)

    if (error) {
      console.error('Error checking accrual history:', error)
      return false // If we can't check, allow accrual (safer to allow than block)
    }

    return (data?.length || 0) > 0
  }

  /**
   * Check if employee has already accrued annual leave for a specific month
   */
  private async hasAccruedAnnualLeaveThisMonth(
    employeeId: string,
    leaveTypeId: string,
    accrualDate: string,
  ): Promise<boolean> {
    const accrualMonth = accrualDate.slice(0, 7) // YYYY-MM
    const { data, error } = await supabaseAdmin
      .from('leave_accrual_history')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('leave_type_id', leaveTypeId)
      .eq('accrual_reason', 'monthly')
      .gte('accrual_date', `${accrualMonth}-01`)
      .lt('accrual_date', `${accrualMonth}-32`)
      .limit(1)

    if (error) {
      console.error('Error checking annual leave accrual history:', error)
      return false
    }

    return (data?.length || 0) > 0
  }

  /**
   * Phase 1: Accrue sick leave for employee in first 6 months (1 day per month, max 6 days)
   */
  private async accrueSickLeavePreEligibility(
    employeeId: string,
    accrualDate: string,
    leaveType: any,
    balance: any,
  ): Promise<void> {
    // Check if already accrued this month
    const alreadyAccrued = await this.hasAccruedSickLeaveThisMonth(employeeId, leaveType.id, accrualDate)
    if (alreadyAccrued) {
      return // Already accrued for this month, skip
    }

    // Calculate current accrued amount (should be months of service, max 6)
    const currentAccrued = balance.total_accrued || 0
    if (currentAccrued >= 6) {
      return // Maximum pre-eligibility accrual (6 days) reached
    }

    const amount = 1.0 // 1 day per month
    const newTotalAccrued = Math.min(currentAccrued + amount, 6) // Cap at 6 days

    // Insert accrual history record
    const { error: histError } = await supabaseAdmin
      .from('leave_accrual_history')
      .insert({
        employee_id: employeeId,
        leave_type_id: leaveType.id,
        balance_id: balance.id,
        accrual_date: accrualDate,
        amount,
        accrual_reason: 'monthly',
        notes: `Pre-eligibility sick leave accrual (month ${Math.floor(newTotalAccrued)})`,
      })

    if (histError) throw histError

    // Update balance
    const { error: updateError } = await supabaseAdmin
      .from('leave_balances')
      .update({ total_accrued: newTotalAccrued })
      .eq('id', balance.id)

    if (updateError) throw updateError
  }

  /**
   * Phase 2: Activate 30-day sick leave cycle when employee reaches 6 months
   */
  private async activateSickLeaveCycle(
    employeeId: string,
    accrualDate: string,
    dateHired: string,
    leaveType: any,
    balance: any,
  ): Promise<void> {
    // Calculate 6-month eligibility date
    const hired = new Date(dateHired)
    const sixMonthDate = new Date(hired)
    sixMonthDate.setMonth(sixMonthDate.getMonth() + 6)

    // Check if we're at or past 6 months
    const accrual = new Date(accrualDate)
    if (accrual < sixMonthDate) {
      throw new Error('Employee not yet eligible (must be 6+ months)')
    }

    // Get days used during first 6 months (already tracked in total_used)
    const daysUsedInFirst6Months = balance.total_used || 0

    // Grant 30 days, but deduct any days already used
    const totalAccrued = 30
    // total_used already contains days used in first 6 months, so balance = 30 - total_used

    // Calculate cycle dates (36 months from when they hit 6 months)
    const cycleStartDate = sixMonthDate.toISOString().slice(0, 10)
    const cycleEndDate = new Date(sixMonthDate)
    cycleEndDate.setMonth(cycleEndDate.getMonth() + 36)
    cycleEndDate.setDate(cycleEndDate.getDate() - 1) // Last day of 36th month

    // Update balance: set total_accrued to 30, keep existing total_used
    const { error: updateError } = await supabaseAdmin
      .from('leave_balances')
      .update({
        total_accrued: totalAccrued,
        cycle_start_date: cycleStartDate,
        cycle_end_date: cycleEndDate.toISOString().slice(0, 10),
      })
      .eq('id', balance.id)

    if (updateError) throw updateError

    // Insert accrual history for the 30-day grant
    const grantAmount = totalAccrued - (balance.total_accrued || 0) // Net amount granted
    const { error: histError } = await supabaseAdmin
      .from('leave_accrual_history')
      .insert({
        employee_id: employeeId,
        leave_type_id: leaveType.id,
        balance_id: balance.id,
        accrual_date: accrualDate,
        amount: grantAmount,
        accrual_reason: 'instant', // Using 'instant' instead of 'eligibility_grant' to match DB constraint
        notes: `30-day sick leave grant activated at 6 months. Days used in first 6 months: ${daysUsedInFirst6Months}. Available balance: ${totalAccrued - daysUsedInFirst6Months}`,
      })

    if (histError) throw histError
  }

  /**
   * Phase 4: Reset sick leave cycle after 36 months
   * 
   * When the 36-month cycle ends:
   * - Old unused balance is lost (no carryover) - SA labor law requirement
   * - Grant fresh 30 days
   * - Start new 36-month cycle
   * - Reset all counters (total_used, total_pending)
   * 
   * This can happen multiple times over an employee's tenure (every 36 months).
   */
  private async resetSickLeaveCycle(
    employeeId: string,
    accrualDate: string,
    leaveType: any,
    balance: any,
  ): Promise<void> {
    // Calculate days lost (unused balance from previous cycle)
    const previousAccrued = balance.total_accrued || 0
    const previousUsed = balance.total_used || 0
    const previousPending = balance.total_pending || 0
    const previousBalance = previousAccrued - previousUsed
    const daysLost = previousBalance > 0 ? previousBalance : 0

    // Grant fresh 30 days (no carryover from previous cycle - SA labor law)
    const totalAccrued = 30
    const totalUsed = 0 // Reset used days for new cycle
    const totalPending = 0 // Reset pending requests for new cycle

    // Calculate new cycle dates (36 months from reset date)
    const cycleStartDate = accrualDate
    const cycleEndDate = new Date(accrualDate)
    cycleEndDate.setMonth(cycleEndDate.getMonth() + 36)
    cycleEndDate.setDate(cycleEndDate.getDate() - 1) // Last day of 36th month

    // Update balance: reset to 30 days, new cycle dates, reset all counters
    const { error: updateError } = await supabaseAdmin
      .from('leave_balances')
      .update({
        total_accrued: totalAccrued,
        total_used: totalUsed,
        total_pending: totalPending,
        cycle_start_date: cycleStartDate,
        cycle_end_date: cycleEndDate.toISOString().slice(0, 10),
      })
      .eq('id', balance.id)

    if (updateError) throw updateError

    // Insert accrual history for the cycle reset
    const { error: histError } = await supabaseAdmin
      .from('leave_accrual_history')
      .insert({
        employee_id: employeeId,
        leave_type_id: leaveType.id,
        balance_id: balance.id,
        accrual_date: accrualDate,
        amount: totalAccrued,
        accrual_reason: 'special', // Using 'special' instead of 'cycle_reset' to match DB constraint
        notes: `36-month cycle reset (Phase 4). Previous cycle: ${previousAccrued} accrued, ${previousUsed} used, ${previousPending} pending. Unused balance (${daysLost} days) lost (no carryover per SA labor law). New 30-day grant activated. Cycle: ${cycleStartDate} to ${cycleEndDate.toISOString().slice(0, 10)}.`,
      })

    if (histError) throw histError
  }

  /**
   * Accrue sick leave for an employee (SA-compliant: Phase 1, 2, 3, & 4)
   * 
   * Phase 1 (0-6 months): 1 day per month (max 6 days)
   * Phase 2 (at 6 months): Grant 30 days, deduct any days used in first 6 months
   * Phase 3 (6-42 months): Active cycle, no accrual (already have 30 days)
   * Phase 4 (after 36 months): Reset cycle, grant fresh 30 days (no carryover)
   * 
   * This implements South African Basic Conditions of Employment Act (BCEA) Section 22.
   */
  async accrueSickLeave(
    employeeId: string,
    accrualDate: string, // ISO date string (YYYY-MM-DD)
    dateHired: string, // ISO date string (YYYY-MM-DD) - employee hire date
    notes?: string,
  ): Promise<void> {
    try {
      // Find the sick leave balance for this employee
      const { data: leaveType, error: ltError } = await supabaseAdmin
        .from('leave_types')
        .select('id')
        .eq('key', 'sick')
        .single()

      if (ltError || !leaveType) {
        throw new Error('Sick leave type not found')
      }

      const { data: balance, error: balError } = await supabaseAdmin
        .from('leave_balances')
        .select('id,total_accrued,total_used,cycle_start_date,cycle_end_date')
        .eq('employee_id', employeeId)
        .eq('leave_type_id', leaveType.id)
        .order('cycle_start_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (balError) throw balError
      if (!balance) {
        throw new Error(`No sick leave balance found for employee ${employeeId}`)
      }

      // Calculate months of service
      const hired = new Date(dateHired)
      const accrual = new Date(accrualDate)
      const monthsDiff = (accrual.getFullYear() - hired.getFullYear()) * 12 + 
                         (accrual.getMonth() - hired.getMonth())

      // Check if cycle has been activated (cycle_start_date is set and not null)
      const cycleActivated = balance.cycle_start_date !== null && balance.cycle_start_date !== undefined

      // Phase 1: Pre-eligibility (0-6 months)
      if (monthsDiff < 6) {
        await this.accrueSickLeavePreEligibility(employeeId, accrualDate, leaveType, balance)
        return
      }

      // Phase 2: At 6 months - activate cycle if not already activated
      // OR if cycle_start_date is set but total_accrued is 0 (incomplete activation)
      // Note: total_accrued might be a string from DB, so convert to number
      const totalAccruedNum = parseFloat(balance.total_accrued || '0')
      if (monthsDiff >= 6 && (!cycleActivated || (cycleActivated && totalAccruedNum < 30))) {
        await this.activateSickLeaveCycle(employeeId, accrualDate, dateHired, leaveType, balance)
        return
      }

      // Phase 3: Active cycle period (6-42 months)
      // Check if cycle has ended and needs reset (Phase 4)
      if (cycleActivated && balance.cycle_end_date) {
        const cycleEnd = new Date(balance.cycle_end_date)
        cycleEnd.setHours(23, 59, 59, 999) // End of the day
        const today = new Date(accrualDate)
        today.setHours(0, 0, 0, 0) // Start of the day
        
        // Phase 4: Cycle has ended (on or after cycle_end_date), reset and grant new 30 days
        if (today >= cycleEnd) {
          await this.resetSickLeaveCycle(employeeId, accrualDate, leaveType, balance)
          return
        }
        
        // Phase 3: Cycle is active, no accrual needed (already have 30 days)
        // This is expected behavior, so we don't throw an error
        return
      }

      // Fallback: Cycle activated but no end date (shouldn't happen, but handle gracefully)
      // This is expected behavior, so we don't throw an error
    } catch (error) {
      console.error('Error accruing sick leave:', error)
      throw new Error('Failed to accrue sick leave')
    }
  }

  /**
   * Accrue family responsibility leave for an employee (instant accrual: 3 days when eligible).
   * 
   * This mirrors the SQL in `database/leave-testing-queries.md` (lines 236-274):
   * - Creates a new balance record with total_accrued = 3.00 (if not exists)
   * - Inserts a record into `leave_accrual_history` with accrual_reason = 'instant'
   */
  async accrueFamilyResponsibilityLeave(
    employeeId: string,
    accrualDate: string, // ISO date string (YYYY-MM-DD)
    notes?: string,
  ): Promise<void> {
    try {
      const amount = 3.0 // Instant accrual of 3 days

      // Find the family responsibility leave type
      const { data: leaveType, error: ltError } = await supabaseAdmin
        .from('leave_types')
        .select('id,cycle_months')
        .eq('key', 'family_responsibility')
        .single()

      if (ltError || !leaveType) {
        throw new Error('Family responsibility leave type not found')
      }

      // Check if balance already exists
      const { data: existingBalance, error: checkError } = await supabaseAdmin
        .from('leave_balances')
        .select('id,total_accrued')
        .eq('employee_id', employeeId)
        .eq('leave_type_id', leaveType.id)
        .maybeSingle()

      if (checkError) throw checkError

      let balanceId: string

      if (existingBalance) {
        balanceId = existingBalance.id
        // Update existing balance
        const newTotalAccrued = (existingBalance.total_accrued || 0) + amount
        const { error: updateError } = await supabaseAdmin
          .from('leave_balances')
          .update({ total_accrued: newTotalAccrued })
          .eq('id', balanceId)

        if (updateError) throw updateError
      } else {
        // Create new balance record (12-month cycle from accrual date)
        const start = new Date(accrualDate)
        const end = new Date(start)
        end.setFullYear(end.getFullYear() + 1)
        end.setDate(end.getDate() - 1)

        const { data: newBalance, error: createError } = await supabaseAdmin
          .from('leave_balances')
          .insert({
            employee_id: employeeId,
            leave_type_id: leaveType.id,
            cycle_start_date: start.toISOString().slice(0, 10),
            cycle_end_date: end.toISOString().slice(0, 10),
            total_accrued: amount,
            total_used: 0.0,
            total_pending: 0.0,
            carried_over: 0.0,
          })
          .select('id')
        .single()

        if (createError) throw createError
        balanceId = newBalance.id
      }

      // Insert accrual history record
      const { error: histError } = await supabaseAdmin
        .from('leave_accrual_history')
        .insert({
          employee_id: employeeId,
          leave_type_id: leaveType.id,
          balance_id: balanceId,
          accrual_date: accrualDate,
          amount,
          accrual_reason: 'instant',
          notes: notes || 'Eligibility reached: 4 months of service',
        })

      if (histError) throw histError
    } catch (error) {
      console.error('Error accruing family responsibility leave:', error)
      throw new Error('Failed to accrue family responsibility leave')
    }
  }

  /**
   * Backfill historical leave accruals for an employee
   * 
   * This method calculates and applies all missing accruals from the employee's
   * hire date to the specified end date (or today). It processes months sequentially
   * to maintain correct state for sick leave phase transitions.
   * 
   * @param employeeId - Employee UUID
   * @param endDate - Optional end date (YYYY-MM-DD), defaults to today
   * @returns Summary of accruals applied
   */
  async backfillLeaveAccruals(
    employeeId: string,
    endDate?: string,
  ): Promise<{
    employeeId: string
    dateHired: string
    startDate: string
    endDate: string
    monthsProcessed: number
    accrualsApplied: {
      annual: { months: number; totalDays: number }
      sick: { months: number; totalDays: number; phases: string[] }
      familyResponsibility: { applied: boolean; days: number }
    }
    errors: Array<{ month: string; error: string }>
  }> {
    try {
      // Get employee data to retrieve date_hired
      const { data: employee, error: empError } = await supabaseAdmin
        .from('employees')
        .select('id, date_hired')
        .eq('id', employeeId)
        .single()

      if (empError || !employee) {
        throw new Error(`Employee not found: ${employeeId}`)
      }

      if (!employee.date_hired) {
        throw new Error(`Employee ${employeeId} has no date_hired set`)
      }

      const dateHired = new Date(employee.date_hired)
      const end = endDate ? new Date(endDate) : new Date()
      end.setHours(23, 59, 59, 999) // End of day

      if (dateHired > end) {
        throw new Error('Hire date cannot be after end date')
      }

      // Get leave type IDs
      const { data: leaveTypes, error: ltError } = await supabaseAdmin
        .from('leave_types')
        .select('id, key')
        .in('key', ['annual', 'sick', 'family_responsibility'])

      if (ltError || !leaveTypes) {
        throw new Error('Failed to fetch leave types')
      }

      const annualLeaveType = leaveTypes.find((lt: any) => lt.key === 'annual')
      const sickLeaveType = leaveTypes.find((lt: any) => lt.key === 'sick')
      const familyLeaveType = leaveTypes.find((lt: any) => lt.key === 'family_responsibility')

      if (!annualLeaveType || !sickLeaveType) {
        throw new Error('Required leave types (annual, sick) not found')
      }

      // Calculate all months to process
      const monthsToProcess: string[] = []
      let current = new Date(dateHired)
      current.setDate(1) // Start of month

      while (current <= end) {
        // Use the 1st of each month for accrual date
        monthsToProcess.push(current.toISOString().slice(0, 10))
        current.setMonth(current.getMonth() + 1)
      }

      const results = {
        employeeId,
        dateHired: employee.date_hired,
        startDate: monthsToProcess[0] || employee.date_hired,
        endDate: endDate || new Date().toISOString().slice(0, 10),
        monthsProcessed: monthsToProcess.length,
        accrualsApplied: {
          annual: { months: 0, totalDays: 0 },
          sick: { months: 0, totalDays: 0, phases: [] as string[] },
          familyResponsibility: { applied: false, days: 0 },
        },
        errors: [] as Array<{ month: string; error: string }>,
      }

      // Process each month sequentially
      for (const monthDate of monthsToProcess) {
        const monthDateObj = new Date(monthDate)
        const monthStr = monthDateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        // Calculate months of service for this month (used for sick leave and family responsibility)
        const monthsDiff = (monthDateObj.getFullYear() - dateHired.getFullYear()) * 12 +
                           (monthDateObj.getMonth() - dateHired.getMonth())

        try {
          // Annual leave accrual
          const hasAnnualAccrued = await this.hasAccruedAnnualLeaveThisMonth(
            employeeId,
            annualLeaveType.id,
            monthDate,
          )

          if (!hasAnnualAccrued) {
            try {
              await this.accrueAnnualLeave(employeeId, monthDate, 1.0)
              results.accrualsApplied.annual.months++
              results.accrualsApplied.annual.totalDays += 1.0
            } catch (annualError) {
              results.errors.push({
                month: monthStr,
                error: `Annual leave: ${annualError instanceof Error ? annualError.message : 'Unknown error'}`,
              })
            }
          }

          // Sick leave accrual (handles phases automatically)
          // Check for monthly accruals (Phase 1), but allow Phase 2/4 to process
          // since they're one-time events handled by accrueSickLeave
          const hasMonthlySickAccrued = await this.hasAccruedSickLeaveThisMonth(
            employeeId,
            sickLeaveType.id,
            monthDate,
          )

          // Get balance before accrual to track changes
          const { data: balanceBefore } = await supabaseAdmin
            .from('leave_balances')
            .select('total_accrued, cycle_start_date, cycle_end_date')
            .eq('employee_id', employeeId)
            .eq('leave_type_id', sickLeaveType.id)
            .order('cycle_start_date', { ascending: false })
            .limit(1)
            .maybeSingle()

          const beforeAccrual = balanceBefore?.total_accrued || 0
          const cycleActivatedBefore = balanceBefore?.cycle_start_date !== null && balanceBefore?.cycle_start_date !== undefined

          // Only skip if it's Phase 1 (monthly accrual) and already accrued
          // Phase 2 (6 months) and Phase 4 (cycle reset) should still process
          const shouldSkip = hasMonthlySickAccrued && monthsDiff < 6

          if (!shouldSkip) {
            try {
              await this.accrueSickLeave(employeeId, monthDate, employee.date_hired)

              // Check what phase was applied by comparing before/after
              const { data: balanceAfter } = await supabaseAdmin
                .from('leave_balances')
                .select('total_accrued, cycle_start_date, cycle_end_date')
                .eq('employee_id', employeeId)
                .eq('leave_type_id', sickLeaveType.id)
                .order('cycle_start_date', { ascending: false })
                .limit(1)
                .maybeSingle()

              const afterAccrual = balanceAfter?.total_accrued || 0
              const amountAccrued = afterAccrual - beforeAccrual
              const cycleActivatedAfter = balanceAfter?.cycle_start_date !== null && balanceAfter?.cycle_start_date !== undefined

              if (amountAccrued > 0 || (!cycleActivatedBefore && cycleActivatedAfter)) {
                results.accrualsApplied.sick.months++
                results.accrualsApplied.sick.totalDays += amountAccrued

                // Determine phase based on months and state changes
                if (monthsDiff < 6) {
                  results.accrualsApplied.sick.phases.push(`Phase 1 (${monthStr})`)
                } else if (monthsDiff >= 6 && !cycleActivatedBefore && cycleActivatedAfter) {
                  results.accrualsApplied.sick.phases.push(`Phase 2 - 30-day grant (${monthStr})`)
                } else if (cycleActivatedBefore && balanceAfter?.cycle_end_date) {
                  // Check if cycle was reset (new cycle_start_date or cycle_end_date changed)
                  const cycleEnd = new Date(balanceAfter.cycle_end_date)
                  const cycleStart = balanceAfter.cycle_start_date ? new Date(balanceAfter.cycle_start_date) : null
                  const monthStart = new Date(monthDate)
                  monthStart.setDate(1)

                  // If cycle start matches this month and we're past a previous cycle end, it's a reset
                  if (cycleStart && cycleStart.getTime() === monthStart.getTime() && amountAccrued >= 30) {
                    results.accrualsApplied.sick.phases.push(`Phase 4 - Cycle reset (${monthStr})`)
                  }
                }
              }
            } catch (sickError) {
              // If error is "already accrued" or similar, skip it
              const errorMsg = sickError instanceof Error ? sickError.message : 'Unknown error'
              if (!errorMsg.includes('already') && !errorMsg.includes('not yet eligible')) {
                results.errors.push({
                  month: monthStr,
                  error: `Sick leave: ${errorMsg}`,
                })
              }
            }
          }

          // Family responsibility leave (only once, at 4 months)
          if (familyLeaveType) {
            // Use monthsDiff calculated above

            if (monthsDiff >= 4 && !results.accrualsApplied.familyResponsibility.applied) {
              // Check if already accrued
              const { data: existingBalance } = await supabaseAdmin
                .from('leave_balances')
                .select('id')
                .eq('employee_id', employeeId)
                .eq('leave_type_id', familyLeaveType.id)
                .maybeSingle()

              if (!existingBalance) {
                try {
                  await this.accrueFamilyResponsibilityLeave(employeeId, monthDate)
                  results.accrualsApplied.familyResponsibility.applied = true
                  results.accrualsApplied.familyResponsibility.days = 3.0
                } catch (familyError) {
                  results.errors.push({
                    month: monthStr,
                    error: `Family responsibility: ${familyError instanceof Error ? familyError.message : 'Unknown error'}`,
                  })
                }
              } else {
                results.accrualsApplied.familyResponsibility.applied = true
              }
            }
          }
        } catch (monthError) {
          results.errors.push({
            month: monthStr,
            error: monthError instanceof Error ? monthError.message : 'Unknown error',
          })
        }
      }

      return results
    } catch (error) {
      console.error('Error backfilling leave accruals:', error)
      throw error instanceof Error ? error : new Error('Failed to backfill leave accruals')
    }
  }

  // LEAVE REQUEST OPERATIONS --------------------------------------------------

  async getLeaveRequests(filters?: LeaveRequestFilters): Promise<LeaveRequest[]> {
    try {
      // Build query with joins to get employee and leave type details
      // Use column name syntax to specify which foreign key to use
      let query = supabaseAdmin
        .from('leave_requests')
        .select(`
          *,
          employees!employee_id(
            id,
            first_name,
            middle_name,
            last_name,
            employee_id
          ),
          leave_types(
            id,
            key,
            display_name
          )
        `)
        .order('created_at', { ascending: false })

      if (filters?.employee_id) {
        query = query.eq('employee_id', filters.employee_id)
      }

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      if (filters?.date_from) {
        query = query.gte('start_date', filters.date_from)
      }

      if (filters?.date_to) {
        query = query.lte('end_date', filters.date_to)
      }

      if (filters?.reviewed_by) {
        query = query.eq('reviewed_by', filters.reviewed_by)
      }

      if (filters?.limit) {
        query = query.limit(filters.limit)
      }

      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
      }

      const { data, error } = await query

      if (error) throw error
      return (data || []) as any[] // Return with enriched data
    } catch (error) {
      console.error('Error fetching leave requests:', error)
      throw new Error('Failed to fetch leave requests')
    }
  }

  async getPendingLeaveRequests(): Promise<LeaveRequest[]> {
    return this.getLeaveRequests({ status: 'pending' })
  }

  async getLeaveRequestById(id: string): Promise<LeaveRequest | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('leave_requests')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw error
      }
      return data
    } catch (error) {
      console.error('Error fetching leave request by ID:', error)
      return null
    }
  }

  /**
   * Create a new leave request
   * 
   * This mirrors the SQL in `database/leave-testing-queries.md` (lines 281-327):
   * - Inserts into `leave_requests`
   * - Creates entries in `leave_calendar` (one per day)
   * - Updates `leave_balances.total_pending += total_days`
   */
  async createLeaveRequest(requestData: CreateLeaveRequestData): Promise<LeaveRequest> {
    try {
      // Get leave_type_id from leave_types table
      const { data: leaveType, error: ltError } = await supabaseAdmin
        .from('leave_types')
        .select('id')
        .eq('key', requestData.leave_type)
        .single()

      if (ltError || !leaveType) {
        throw new Error(`Leave type '${requestData.leave_type}' not found`)
      }

      // Get current balance to check availability
      const balance = await this.getLeaveBalance(requestData.employee_id, requestData.leave_type)
      
      if (!balance) {
        throw new Error(`No leave balance found for employee and leave type '${requestData.leave_type}'`)
      }

      // Calculate available balance: ((total_accrued + carried_over) - total_used) - total_pending
      const availableBalance = ((balance.total_accrued || 0) + (balance.carried_over || 0)) - 
                               (balance.total_used || 0) - 
                               (balance.total_pending || 0)

      if (availableBalance < requestData.total_days) {
        throw new Error(
          `Insufficient leave balance. Available: ${availableBalance.toFixed(2)} days, Requested: ${requestData.total_days} days`
        )
      }

      // Insert leave request
      const { data: leaveRequest, error: requestError } = await supabaseAdmin
        .from('leave_requests')
        .insert({
          employee_id: requestData.employee_id,
          leave_type_id: leaveType.id,
          start_date: requestData.start_date,
          end_date: requestData.end_date,
          total_days: requestData.total_days,
          reason: requestData.reason,
          document_url: requestData.document_url,
          document_required: requestData.document_required || false,
          status: 'pending',
          submitted_by: requestData.submitted_by,
        })
        .select()
        .single()

      if (requestError) throw requestError

      // Create leave_calendar entries (one per working day)
      // Note: We exclude weekends here. Public holidays are already accounted for
      // in total_days calculation via calculate_working_days() function.
      // For calendar entries, we use a simple weekend filter for efficiency.
      const start = new Date(requestData.start_date)
      const end = new Date(requestData.end_date)
      const calendarEntries = []

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay()
        // Only include weekdays (Monday=1 to Friday=5)
        // Public holidays are handled by the total_days calculation
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          calendarEntries.push({
            leave_request_id: leaveRequest.id,
            employee_id: requestData.employee_id,
            leave_date: d.toISOString().slice(0, 10),
            is_half_day: false,
          })
        }
      }

      if (calendarEntries.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('leave_calendar')
          .insert(calendarEntries)

        if (insertError) throw insertError
      }

      // Update leave_balances: add to total_pending
      const { error: balanceError } = await supabaseAdmin
        .from('leave_balances')
        .update({
          total_pending: (balance.total_pending || 0) + requestData.total_days,
        })
        .eq('id', balance.id)

      if (balanceError) throw balanceError

      return leaveRequest
    } catch (error) {
      console.error('Error creating leave request:', error)
      throw error instanceof Error ? error : new Error('Failed to create leave request')
    }
  }

  /**
   * Approve a leave request
   * 
   * This mirrors the SQL in `database/leave-testing-queries.md` (lines 332-348):
   * - Updates `leave_requests.status = 'approved'`
   * - Moves from `total_pending` to `total_used` in `leave_balances`
   */
  async approveLeaveRequest(id: string, reviewedBy: string, reviewNotes?: string): Promise<LeaveRequest | null> {
    try {
      // Get the leave request first
      const leaveRequest = await this.getLeaveRequestById(id)
      if (!leaveRequest) {
        throw new Error('Leave request not found')
      }

      if (leaveRequest.status !== 'pending') {
        throw new Error(`Cannot approve leave request with status '${leaveRequest.status}'`)
      }

      // Get the leave balance
      const { data: leaveType, error: ltError } = await supabaseAdmin
        .from('leave_types')
        .select('key')
        .eq('id', leaveRequest.leave_type_id)
        .single()

      if (ltError || !leaveType) {
        throw new Error('Leave type not found')
      }

      const balance = await this.getLeaveBalance(leaveRequest.employee_id, leaveType.key)
      // In some legacy data, leave balances might not exist yet. We still want
      // to allow rejection to go through, so treat missing balance as a warning
      // instead of a hard error.

      // Update leave request status
      const { data: updatedRequest, error: updateError } = await supabaseAdmin
        .from('leave_requests')
        .update({
          status: 'approved',
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes,
        })
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      // Update leave balance: move from pending to used
      if (!balance) {
        console.warn(`No leave balance found for employee ${leaveRequest.employee_id} and type ${leaveType.key}. Cannot update balance.`)
      } else {
        const { error: balanceError } = await supabaseAdmin
          .from('leave_balances')
          .update({
            total_pending: Math.max(0, (balance.total_pending || 0) - leaveRequest.total_days),
            total_used: (balance.total_used || 0) + leaveRequest.total_days,
          })
          .eq('id', balance.id)

        if (balanceError) throw balanceError
      }

      return updatedRequest
    } catch (error) {
      console.error('Error approving leave request:', error)
      throw error instanceof Error ? error : new Error('Failed to approve leave request')
    }
  }

  /**
   * Reject a leave request
   * 
   * This mirrors the SQL in `database/leave-testing-queries.md` (lines 350-378):
   * - Updates `leave_requests.status = 'rejected'`
   * - Releases `total_pending` (removes from pending)
   * - Deletes `leave_calendar` entries
   */
  async rejectLeaveRequest(
    id: string,
    reviewedBy: string,
    reason: string,
  ): Promise<LeaveRequest | null> {
    try {
      // Get the leave request first to get employee_id, leave_type_id, and total_days
      const leaveRequest = await this.getLeaveRequestById(id)
      if (!leaveRequest) {
        throw new Error('Leave request not found')
      }

      if (leaveRequest.status !== 'pending') {
        throw new Error(`Cannot reject leave request with status '${leaveRequest.status}'`)
      }

      // Get the leave type key to find the balance
      const { data: leaveType, error: ltError } = await supabaseAdmin
        .from('leave_types')
        .select('key')
        .eq('id', leaveRequest.leave_type_id)
        .single()

      if (ltError || !leaveType) {
        throw new Error('Leave type not found')
      }

      // Get the leave balance
      const balance = await this.getLeaveBalance(leaveRequest.employee_id, leaveType.key)
      // In some legacy data, leave balances might not exist yet. We still want
      // to allow rejection to go through, so treat missing balance as a warning
      // instead of a hard error.

      // Update leave request status
      const { data: updatedRequest, error: updateError } = await supabaseAdmin
        .from('leave_requests')
        .update({
          status: 'rejected',
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString(),
          review_notes: reason,
        })
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      // Update leave balance: release from pending (subtract from total_pending)
      if (balance) {
        const { error: balanceError } = await supabaseAdmin
          .from('leave_balances')
          .update({
            total_pending: Math.max(0, (balance.total_pending || 0) - leaveRequest.total_days),
          })
          .eq('id', balance.id)

        if (balanceError) {
          console.warn('Error updating leave balance on rejection:', balanceError)
          // Non-fatal: log warning but don't fail the rejection
        }
      } else {
        console.warn(`No leave balance found for employee ${leaveRequest.employee_id} and leave type ${leaveType.key}. Proceeding with rejection.`)
      }

      // Best-effort calendar cleanup
      try {
        const { error: calendarError } = await supabaseAdmin
          .from('leave_calendar')
          .delete()
          .eq('leave_request_id', id)

        if (calendarError) {
          console.warn('Error deleting leave_calendar entries:', calendarError)
        }
      } catch (calendarErr) {
        console.warn('Error during leave_calendar cleanup:', calendarErr)
      }

      return updatedRequest
    } catch (error) {
      console.error('Error rejecting leave request:', error)
      throw error instanceof Error ? error : new Error('Failed to reject leave request')
    }
  }

  // CALCULATION & REPORTING ---------------------------------------------------

  /**
   * Calculate working days between two dates using database function
   * This calls the PostgreSQL calculate_working_days() function which
   * excludes weekends and public holidays (SA-specific)
   */
  async calculateWorkingDays(startDate: string, endDate: string): Promise<number> {
    try {
      const { data, error } = await supabaseAdmin.rpc('calculate_working_days', {
        start_date: startDate,
        end_date: endDate,
        country: 'ZA', // South Africa
      })

      if (error) throw error
      return data || 0
    } catch (error) {
      console.error('Error calculating working days:', error)
      // Fallback to simple calculation (exclude weekends only)
    const start = new Date(startDate)
    const end = new Date(endDate)
    let count = 0

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay()
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        count++
      }
    }

    return count
  }
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

