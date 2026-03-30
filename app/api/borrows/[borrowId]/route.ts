// ============================================================================
// PATCH /api/borrows/[borrowId] - Update borrow (approve/reject/return)
// ============================================================================
// Handles: PATCH /api/borrows/{borrowId}?action=approve
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { borrowService } from '@/lib/services'
import { getCurrentUser } from '@/lib/auth'

const updateSchema = z.object({
  action: z.enum(['approve', 'reject', 'return']).optional(),
  supervisorId: z.string().optional(),
  reason: z.string().optional(),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ borrowId: string }> }
) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  try {
    const params = await context.params
    let { borrowId } = params
    const { searchParams } = new URL(request.url)
    const actionFromQuery = searchParams.get('action')

    // Clean up borrowId - remove "id=" prefix if present
    if (borrowId) {
      borrowId = borrowId.replace(/^id=/, '').trim()
    }

    if (!borrowId) {
      return NextResponse.json(
        { success: false, error: 'Borrow ID is required' },
        { status: 400, headers },
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(borrowId)) {
      return NextResponse.json(
        { success: false, error: `Invalid borrow ID format: ${borrowId}. Expected UUID format.` },
        { status: 400, headers },
      )
    }

    // Get action from query params or body
    let action: string | null = actionFromQuery
    let supervisorId: string | undefined
    let reason: string | undefined

    // Try to parse body (only once)
    let body: any = {}
    try {
      const bodyText = await request.text()
      if (bodyText) {
        body = JSON.parse(bodyText)
      }
    } catch {
      // Body is optional, continue with empty object
    }

    // If action not in query params, get it from body
    if (!action) {
      try {
        const parsed = updateSchema.parse(body)
        action = parsed.action || null
        supervisorId = parsed.supervisorId
        reason = parsed.reason
      } catch (bodyError) {
        // If body parsing fails and no action in query, return error
        return NextResponse.json(
          { success: false, error: 'Action is required (in query params ?action=approve or in request body)' },
          { status: 400, headers },
        )
      }
    } else {
      // Action from query params, get supervisorId and reason from body
      supervisorId = body.supervisorId
      reason = body.reason
    }

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action is required (approve, reject, or return)' },
        { status: 400, headers },
      )
    }

    // Get supervisor ID from body, query params, or current user
    let finalSupervisorId = supervisorId
    if (!finalSupervisorId && (action === 'approve' || action === 'reject')) {
      const user = getCurrentUser()
      finalSupervisorId = user?.id || user?.employeeId || searchParams.get('supervisorId') || undefined
    }

    let result: any = null

    switch (action) {
      case 'approve':
        if (!finalSupervisorId) {
          return NextResponse.json(
            { success: false, error: 'Supervisor ID is required for approval' },
            { status: 400, headers },
          )
        }
        result = await borrowService.approveBorrow(borrowId, finalSupervisorId)
        break

      case 'reject':
        if (!finalSupervisorId) {
          return NextResponse.json(
            { success: false, error: 'Supervisor ID is required for rejection' },
            { status: 400, headers },
          )
        }
        result = await borrowService.rejectBorrow(borrowId, finalSupervisorId, reason)
        break

      case 'return':
        result = await borrowService.returnDevice(borrowId)
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Must be: approve, reject, or return' },
          { status: 400, headers },
        )
    }

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: `Borrow ${action}d successfully`,
      },
      { status: 200, headers },
    )
  } catch (error) {
    console.error('[borrows/[borrowId]] PATCH error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid update payload',
          details: error.errors,
        },
        {
          status: 400,
          headers,
        },
      )
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to update borrow'
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      {
        status: 500,
        headers,
      },
    )
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}
