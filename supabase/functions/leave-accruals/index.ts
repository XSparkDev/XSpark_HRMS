// ============================================================================
// LEAVE ACCRUALS EDGE FUNCTION
// ============================================================================
// This Edge Function handles scheduled leave accruals:
// - Monthly accruals: Annual leave (1 day/month), Sick leave (1 day per 26 working days)
// - Eligibility-based accruals: Family Responsibility (3 days after 3 months)
// ============================================================================
// 
// NOTE: This file runs in Deno runtime, not Node.js. TypeScript errors about
// Deno imports and globals are expected in IDE but will work correctly when deployed.
// 
// Trigger Options:
// 1. Cron schedule (recommended): Set up in Supabase Dashboard -> Edge Functions -> Cron
//    Example: "0 0 1 * *" (1st of every month at midnight)
// 2. Manual invocation: POST to function URL
// 3. Database trigger: Can be called from pg_cron or other database events
// ============================================================================

/// <reference path="./types.d.ts" />

// @ts-ignore - Deno std library imports are valid in Deno runtime
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - ESM imports are valid in Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AccrualResult {
  employeeId: string
  employeeNumber?: string
  accruals: {
    type: string
    amount: number
    success: boolean
    error?: string
  }[]
}

/**
 * Calculate working days in a month (excluding weekends)
 * For sick leave accrual: 1 day per 26 working days
 */
function calculateWorkingDaysInMonth(year: number, month: number): number {
  const startDate = new Date(year, month, 1)
  const endDate = new Date(year, month + 1, 0)
  let workingDays = 0

  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay()
    // Count Monday (1) through Friday (5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      workingDays++
    }
  }

  return workingDays
}

/**
 * Check if employee is eligible for family responsibility leave (3 months of service)
 */
function isEligibleForFamilyResponsibility(dateHired: string, checkDate: Date): boolean {
  const hired = new Date(dateHired)
  const monthsDiff = (checkDate.getFullYear() - hired.getFullYear()) * 12 + 
                     (checkDate.getMonth() - hired.getMonth())
  return monthsDiff >= 3
}

  
/**
 * Accrue annual leave for an employee (1 day/month)
 */
async function accrueAnnualLeave(
  supabase: any,
  employeeId: string,
  accrualDate: string,
): Promise<{ success: boolean; amount: number; error?: string }> {
  try {
    // Find annual leave type
    const { data: leaveType, error: ltError } = await supabase
      .from('leave_types')
      .select('id')
      .eq('key', 'annual')
      .single()

    if (ltError || !leaveType) {
      return { success: false, amount: 0, error: 'Annual leave type not found' }
    }

    // Find the current balance
    const { data: balance, error: balError } = await supabase
      .from('leave_balances')
      .select('id,total_accrued')
      .eq('employee_id', employeeId)
      .eq('leave_type_id', leaveType.id)
      .order('cycle_start_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (balError) {
      return { success: false, amount: 0, error: `Balance lookup error: ${balError.message}` }
    }

    if (!balance) {
      return { success: false, amount: 0, error: 'No annual leave balance found' }
    }

    // Annual leave capped at 20 days max
    const amount = 1.0
    const currentTotalAccrued = balance.total_accrued || 0
    const nextTotalAccrued = currentTotalAccrued + amount
    const cappedTotalAccrued = Math.min(nextTotalAccrued, 20)
    const creditedAmount = Math.max(0, cappedTotalAccrued - currentTotalAccrued)

    // If we're already at the cap, do not insert history or update balance.
    if (creditedAmount <= 0) {
      return { success: true, amount: 0 }
    }

    // Insert accrual history
    const { error: histError } = await supabase
      .from('leave_accrual_history')
      .insert({
        employee_id: employeeId,
        leave_type_id: leaveType.id,
        balance_id: balance.id,
        accrual_date: accrualDate,
        amount: creditedAmount,
        accrual_reason: 'monthly',
        notes: `Monthly accrual for ${new Date(accrualDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      })

    if (histError) {
      return { success: false, amount: 0, error: `History insert error: ${histError.message}` }
    }

    // Update balance
    const { error: updateError } = await supabase
      .from('leave_balances')
      .update({ total_accrued: cappedTotalAccrued })
      .eq('id', balance.id)

    if (updateError) {
      return { success: false, amount: 0, error: `Balance update error: ${updateError.message}` }
    }

    return { success: true, amount: creditedAmount }
  } catch (error: any) {
    return { success: false, amount: 0, error: error.message || 'Unknown error' }
  }
}

/**
 * Check if employee has already accrued sick leave for this month
 */
async function hasAccruedThisMonth(
  supabase: any,
  employeeId: string,
  leaveTypeId: string,
  accrualDate: string,
): Promise<boolean> {
  const accrualMonth = accrualDate.slice(0, 7) // YYYY-MM
  const { data, error } = await supabase
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
 * Phase 1: Accrue sick leave for employee in first 6 months (1 day per month, max 6 days)
 */
async function accrueSickLeavePreEligibility(
  supabase: any,
  employeeId: string,
  accrualDate: string,
  leaveType: any,
  balance: any,
): Promise<{ success: boolean; amount: number; error?: string }> {
  try {
    // Check if already accrued this month
    const alreadyAccrued = await hasAccruedThisMonth(supabase, employeeId, leaveType.id, accrualDate)
    if (alreadyAccrued) {
      return { success: true, amount: 0, error: 'Already accrued for this month' }
    }

    // Calculate current accrued amount (should be months of service, max 6)
    const currentAccrued = balance.total_accrued || 0
    if (currentAccrued >= 6) {
      return { success: true, amount: 0, error: 'Maximum pre-eligibility accrual (6 days) reached' }
    }

    const amount = 1.0 // 1 day per month
    const newTotalAccrued = Math.min(currentAccrued + amount, 6) // Cap at 6 days

    // Insert accrual history
    const { error: histError } = await supabase
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

    if (histError) {
      return { success: false, amount: 0, error: `History insert error: ${histError.message}` }
    }

    // Update balance
    const { error: updateError } = await supabase
      .from('leave_balances')
      .update({ total_accrued: newTotalAccrued })
      .eq('id', balance.id)

    if (updateError) {
      return { success: false, amount: 0, error: `Balance update error: ${updateError.message}` }
    }

    return { success: true, amount }
  } catch (error: any) {
    return { success: false, amount: 0, error: error.message || 'Unknown error' }
  }
}

/**
 * Phase 2: Activate 30-day sick leave cycle when employee reaches 6 months
 */
async function activateSickLeaveCycle(
  supabase: any,
  employeeId: string,
  accrualDate: string,
  dateHired: string,
  leaveType: any,
  balance: any,
): Promise<{ success: boolean; amount: number; error?: string }> {
  try {
    // Calculate 6-month eligibility date
    const hired = new Date(dateHired)
    const sixMonthDate = new Date(hired)
    sixMonthDate.setMonth(sixMonthDate.getMonth() + 6)

    // Check if we're at or past 6 months
    const accrual = new Date(accrualDate)
    if (accrual < sixMonthDate) {
      return { success: false, amount: 0, error: 'Employee not yet eligible (must be 6+ months)' }
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
    const { error: updateError } = await supabase
      .from('leave_balances')
      .update({
        total_accrued: totalAccrued,
        cycle_start_date: cycleStartDate,
        cycle_end_date: cycleEndDate.toISOString().slice(0, 10),
      })
      .eq('id', balance.id)

    if (updateError) {
      return { success: false, amount: 0, error: `Balance update error: ${updateError.message}` }
    }

    // Insert accrual history for the 30-day grant
    const grantAmount = totalAccrued - (balance.total_accrued || 0) // Net amount granted
    const { error: histError } = await supabase
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

    if (histError) {
      return { success: false, amount: 0, error: `History insert error: ${histError.message}` }
    }

    return { success: true, amount: grantAmount }
  } catch (error: any) {
    return { success: false, amount: 0, error: error.message || 'Unknown error' }
  }
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
async function resetSickLeaveCycle(
  supabase: any,
  employeeId: string,
  accrualDate: string,
  leaveType: any,
  balance: any,
): Promise<{ success: boolean; amount: number; error?: string }> {
  try {
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
    const { error: updateError } = await supabase
      .from('leave_balances')
      .update({
        total_accrued: totalAccrued,
        total_used: totalUsed,
        total_pending: totalPending,
        cycle_start_date: cycleStartDate,
        cycle_end_date: cycleEndDate.toISOString().slice(0, 10),
      })
      .eq('id', balance.id)

    if (updateError) {
      return { success: false, amount: 0, error: `Balance update error: ${updateError.message}` }
    }

    // Insert accrual history for the cycle reset
    const { error: histError } = await supabase
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

    if (histError) {
      return { success: false, amount: 0, error: `History insert error: ${histError.message}` }
    }

    return { success: true, amount: totalAccrued }
  } catch (error: any) {
    return { success: false, amount: 0, error: error.message || 'Unknown error' }
  }
}

/**
 * Accrue sick leave for an employee (SA-compliant: Phase 1, 2, 3, & 4)
 * 
 * Phase 1 (0-6 months): 1 day per month (max 6 days)
 * Phase 2 (at 6 months): Grant 30 days, deduct any days used in first 6 months
 * Phase 3 (6-42 months): Active cycle, no accrual (already have 30 days)
 * Phase 4 (after 36 months): Reset cycle, grant fresh 30 days (no carryover)
 */
async function accrueSickLeave(
  supabase: any,
  employeeId: string,
  accrualDate: string,
  dateHired: string,
): Promise<{ success: boolean; amount: number; error?: string }> {
  try {
    // Find sick leave type
    const { data: leaveType, error: ltError } = await supabase
      .from('leave_types')
      .select('id')
      .eq('key', 'sick')
      .single()

    if (ltError || !leaveType) {
      return { success: false, amount: 0, error: 'Sick leave type not found' }
    }

    // Find the current balance
    const { data: balance, error: balError } = await supabase
      .from('leave_balances')
      .select('id,total_accrued,total_used,cycle_start_date,cycle_end_date')
      .eq('employee_id', employeeId)
      .eq('leave_type_id', leaveType.id)
      .order('cycle_start_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (balError) {
      return { success: false, amount: 0, error: `Balance lookup error: ${balError.message}` }
    }

    if (!balance) {
      return { success: false, amount: 0, error: 'No sick leave balance found' }
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
      return await accrueSickLeavePreEligibility(supabase, employeeId, accrualDate, leaveType, balance)
    }

    // Phase 2: At 6 months - activate cycle if not already activated
    // OR if cycle_start_date is set but total_accrued is 0 (incomplete activation)
    // Note: total_accrued might be a string from DB, so convert to number
    const totalAccruedNum = parseFloat(balance.total_accrued || '0')
    if (monthsDiff >= 6 && (!cycleActivated || (cycleActivated && totalAccruedNum < 30))) {
      return await activateSickLeaveCycle(supabase, employeeId, accrualDate, dateHired, leaveType, balance)
    }

    // Phase 3: Active cycle period (6 months to 42 months)
    // Check if cycle has ended and needs reset (Phase 4)
    if (cycleActivated && balance.cycle_end_date) {
      const cycleEnd = new Date(balance.cycle_end_date)
      cycleEnd.setHours(23, 59, 59, 999) // End of the day
      const today = new Date(accrualDate)
      today.setHours(0, 0, 0, 0) // Start of the day
      
      // Phase 4: Cycle has ended (on or after cycle_end_date), reset and grant new 30 days
      if (today >= cycleEnd) {
        return await resetSickLeaveCycle(supabase, employeeId, accrualDate, leaveType, balance)
      }
      
      // Phase 3: Cycle is active, no accrual needed (already have 30 days)
      return { success: true, amount: 0, error: 'Cycle active (Phase 3), no accrual needed' }
    }

    // Fallback: Cycle activated but no end date (shouldn't happen, but handle gracefully)
    return { success: true, amount: 0, error: 'Cycle activated but end date missing' }
  } catch (error: any) {
    return { success: false, amount: 0, error: error.message || 'Unknown error' }
  }
}

/**
 * Accrue family responsibility leave (3 days when eligible - 4 months of service)
 */
async function accrueFamilyResponsibilityLeave(
  supabase: any,
  employeeId: string,
  accrualDate: string,
): Promise<{ success: boolean; amount: number; error?: string }> {
  try {
    const amount = 3.0

    // Find family responsibility leave type
    const { data: leaveType, error: ltError } = await supabase
      .from('leave_types')
      .select('id,cycle_months')
      .eq('key', 'family_responsibility')
      .single()

    if (ltError || !leaveType) {
      return { success: false, amount: 0, error: 'Family responsibility leave type not found' }
    }

    // Check if balance already exists
    const { data: existingBalance, error: checkError } = await supabase
      .from('leave_balances')
      .select('id,total_accrued')
      .eq('employee_id', employeeId)
      .eq('leave_type_id', leaveType.id)
      .maybeSingle()

    if (checkError) {
      return { success: false, amount: 0, error: `Balance check error: ${checkError.message}` }
    }

    let balanceId: string

    if (existingBalance) {
      // Already accrued, skip
      return { success: false, amount: 0, error: 'Family responsibility leave already accrued' }
    }

    // Create new balance record (12-month cycle from accrual date)
    const start = new Date(accrualDate)
    const end = new Date(start)
    end.setFullYear(end.getFullYear() + 1)
    end.setDate(end.getDate() - 1)

    const { data: newBalance, error: createError } = await supabase
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

    if (createError) {
      return { success: false, amount: 0, error: `Balance creation error: ${createError.message}` }
    }

    balanceId = newBalance.id

    // Insert accrual history
    const { error: histError } = await supabase
      .from('leave_accrual_history')
      .insert({
        employee_id: employeeId,
        leave_type_id: leaveType.id,
        balance_id: balanceId,
        accrual_date: accrualDate,
        amount,
        accrual_reason: 'instant',
        notes: 'Eligibility reached: 4 months of service',
      })

    if (histError) {
      return { success: false, amount: 0, error: `History insert error: ${histError.message}` }
    }

    return { success: true, amount }
  } catch (error: any) {
    return { success: false, amount: 0, error: error.message || 'Unknown error' }
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body (optional parameters)
    const body = await req.json().catch(() => ({}))
    const {
      accrualDate, // Optional: defaults to today (YYYY-MM-DD)
      employeeId,  // Optional: process specific employee, otherwise all active employees
      accrualType, // Optional: 'monthly' | 'eligibility' | 'all' (default: 'all')
    } = body

    const today = new Date()
    const processDate = accrualDate || today.toISOString().slice(0, 10)

    // Get all active employees (or specific employee if provided)
    const employeeQuery = supabase
      .from('employees')
      .select('id,employee_id,date_hired')
      .eq('employment_status', 'active')

    if (employeeId) {
      employeeQuery.eq('id', employeeId)
    }

    const { data: employees, error: empError } = await employeeQuery

    if (empError) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch employees: ${empError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!employees || employees.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active employees found', results: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Process accruals for each employee
    const results: AccrualResult[] = []

    for (const employee of employees) {
      const accruals: AccrualResult['accruals'] = []

      // Monthly accruals (annual and sick leave)
      if (!accrualType || accrualType === 'monthly' || accrualType === 'all') {
        // Annual leave
        const annualResult = await accrueAnnualLeave(supabase, employee.id, processDate)
        accruals.push({
          type: 'annual',
          amount: annualResult.amount,
          success: annualResult.success,
          error: annualResult.error,
        })

        // Sick leave (SA-compliant: requires dateHired)
        if (employee.date_hired) {
          const sickResult = await accrueSickLeave(supabase, employee.id, processDate, employee.date_hired)
          accruals.push({
            type: 'sick',
            amount: sickResult.amount,
            success: sickResult.success,
            error: sickResult.error,
          })
        } else {
          accruals.push({
            type: 'sick',
            amount: 0,
            success: false,
            error: 'Employee date_hired not found',
          })
        }
      }

      // Eligibility-based accruals (family responsibility)
      if (!accrualType || accrualType === 'eligibility' || accrualType === 'all') {
        if (employee.date_hired && isEligibleForFamilyResponsibility(employee.date_hired, today)) {
          const familyResult = await accrueFamilyResponsibilityLeave(supabase, employee.id, processDate)
          accruals.push({
            type: 'family_responsibility',
            amount: familyResult.amount,
            success: familyResult.success,
            error: familyResult.error,
          })
        }
      }

      results.push({
        employeeId: employee.id,
        employeeNumber: employee.employee_id,
        accruals,
      })
    }

    // Calculate summary
    const summary = {
      totalEmployees: employees.length,
      totalAccruals: results.reduce((sum, r) => sum + r.accruals.length, 0),
      successfulAccruals: results.reduce(
        (sum, r) => sum + r.accruals.filter((a) => a.success).length,
        0,
      ),
      failedAccruals: results.reduce(
        (sum, r) => sum + r.accruals.filter((a) => !a.success).length,
        0,
      ),
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Leave accruals processed',
        date: processDate,
        summary,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error: any) {
    console.error('Error in leave-accruals function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

