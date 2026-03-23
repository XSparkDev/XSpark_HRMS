import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'

const querySchema = z.object({
  status: z.string().optional(),
  limit: z
    .preprocess(
      (val) => {
        if (val === null || val === undefined || val === '') return undefined
        const num = typeof val === 'string' ? parseInt(val, 10) : val
        return Number.isNaN(num as number) ? undefined : num
      },
      z.number().min(1).max(200).optional(),
    ),
  offset: z
    .preprocess(
      (val) => {
        if (val === null || val === undefined || val === '') return undefined
        const num = typeof val === 'string' ? parseInt(val, 10) : val
        return Number.isNaN(num as number) ? undefined : num
      },
      z.number().min(0).optional(),
    ),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const raw = {
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    }

    const parsed = querySchema.parse(raw)

    // Use the regular Supabase client so requests run in the context
    // of the logged-in user (same as supervisor dashboard), which
    // already has the correct permissions for the `returns` table.
    let query = supabase
      .from('returns')
      .select(
        `
        id,
        employee_id,
        device_id,
        return_date,
        device_condition,
        status,
        created_at,
        updated_at,
        devices:device_id (
          asset_tag,
          model,
          brand,
          device_type
        ),
        employees:employee_id (
          name,
          employee_id
        )
      `,
        { count: 'exact' },
      )

    const status = parsed.status?.toLowerCase()

    if (status === 'pending') {
      // Pending return approvals
      query = query.in('status', ['Pending', 'Pending Approval', 'Awaiting Approval'])
    } else if (status) {
      // Any other explicit status string
      query = query.eq('status', parsed.status)
    }

    if (typeof parsed.limit === 'number' && typeof parsed.offset === 'number') {
      query = query.range(parsed.offset, parsed.offset + parsed.limit - 1)
    } else if (typeof parsed.limit === 'number') {
      query = query.limit(parsed.limit)
    }

    const { data, error, count } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('[returns] GET error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch returns' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      meta: {
        count: count ?? (data?.length ?? 0),
        limit: parsed.limit ?? null,
        offset: parsed.offset ?? null,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: error.errors },
        { status: 400 },
      )
    }

    console.error('[returns] GET unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch returns' },
      { status: 500 },
    )
  }
}

