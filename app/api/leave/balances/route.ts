// ============================================================================
// LEAVE BALANCES API ROUTE
// ============================================================================
// GET /api/leave/balances?employee_id=UUID
// Returns Supabase-backed leave balances for an employee.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { leaveManagementService } from '@/lib/services'
import { z } from 'zod'

const LeaveBalanceQuerySchema = z.object({
  employee_id: z.string().uuid(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const query = LeaveBalanceQuerySchema.parse({
      employee_id: searchParams.get('employee_id') || undefined,
    })

    const balances = await leaveManagementService.getLeaveBalances(query.employee_id)

    return NextResponse.json(
      {
        success: true,
        data: balances,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Error fetching leave balances:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: error.errors,
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch leave balances',
      },
      { status: 500 },
    )
  }
}





