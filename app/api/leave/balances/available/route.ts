// ============================================================================
// LEAVE AVAILABLE BALANCE API ROUTE
// ============================================================================
// GET /api/leave/balances/available?employee_id=UUID&leave_type=string
// Returns the available balance for a specific employee and leave type.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { leaveManagementService } from '@/lib/services'
import { z } from 'zod'

const AvailableBalanceQuerySchema = z.object({
  employee_id: z.string().uuid(),
  leave_type: z.string().min(1),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const query = AvailableBalanceQuerySchema.parse({
      employee_id: searchParams.get('employee_id') || undefined,
      leave_type: searchParams.get('leave_type') || undefined,
    })

    const availableBalance = await leaveManagementService.getAvailableBalance(
      query.employee_id,
      query.leave_type
    )

    return NextResponse.json(
      {
        success: true,
        data: {
          employee_id: query.employee_id,
          leave_type: query.leave_type,
          available_balance: availableBalance,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Error fetching available balance:', error)

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
        error: 'Failed to fetch available balance',
      },
      { status: 500 },
    )
  }
}











