// ============================================================================
// LEAVE ACCRUAL BACKFILL API ROUTE
// ============================================================================
// POST /api/leave/accruals/backfill
// Backfills historical leave accruals for an employee from their hire date
// to a specified end date (or today). Useful for employees with back-dated hire dates.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { leaveManagementService } from '@/lib/services'
import { z } from 'zod'

const BackfillAccrualsSchema = z.object({
  employee_id: z.string().uuid(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // Optional end date (YYYY-MM-DD)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validation = BackfillAccrualsSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 },
      )
    }

    const { employee_id, end_date } = validation.data

    // Backfill accruals
    const result = await leaveManagementService.backfillLeaveAccruals(employee_id, end_date)

    return NextResponse.json(
      {
        success: true,
        message: 'Leave accruals backfilled successfully',
        data: result,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Error backfilling leave accruals:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to backfill leave accruals',
      },
      { status: 500 },
    )
  }
}










