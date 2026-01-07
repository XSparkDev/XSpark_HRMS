import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { borrowService } from '@/lib/services'

const paramsSchema = z.object({
  identifier: z.string().min(1, 'identifier is required'),
})

export async function GET(_request: NextRequest, context: { params: { identifier: string } | Promise<{ identifier: string }> }) {
  try {
    const params = await context.params
    const { identifier } = paramsSchema.parse(params)
    
    // Use borrow service to get borrows by borrower
    // The service now handles errors gracefully and returns empty array
    const records = await borrowService.getBorrowsByBorrower(identifier)

    return NextResponse.json({
      success: true,
      data: records || [], // Ensure we always return an array
      meta: {
        borrowedBy: identifier,
        count: Array.isArray(records) ? records.length : 0,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid borrower identifier', details: error.errors },
        { status: 400 },
      )
    }

    // If borrower not found or any other error, return empty array instead of error
    console.warn('[borrows] GET /borrower/[identifier] - returning empty array due to error:', error)
      return NextResponse.json({
        success: true,
        data: [],
        meta: {
        borrowedBy: null,
          count: 0,
        },
      })
  }
}


