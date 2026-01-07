import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * GET /api/audit-logs
 *
 * Returns audit log entries from the `audit_logs` table for use in the
 * Activity / Audit Log view.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select(
        `
        id,
        employee_name,
        employee_number,
        action,
        action_type,
        severity,
        target_table,
        target_record_id,
        description,
        created_at
      `
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[audit-logs] query error:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to load audit logs',
          details: error.message,
        },
        { status: 500 },
      )
    }

    const logs = data || []

    const activities = logs.map((log: any) => {
      const actor = log.employee_name || log.employee_number || 'System'
      const target =
        log.target_table && log.target_record_id
          ? `${log.target_table} · ${log.target_record_id}`
          : log.target_table || ''

      const baseTitle =
        log.action_type ||
        (typeof log.action === 'string'
          ? log.action.replace(/_/g, ' ').toLowerCase()
          : 'Activity')

      const title =
        baseTitle.charAt(0).toUpperCase() + baseTitle.slice(1)

      const pieces = []
      if (actor) pieces.push(actor)
      if (target) pieces.push(target)

      const fallbackDescription = pieces.length
        ? pieces.join(' • ')
        : undefined

      return {
        id: String(log.id),
        employee_name: log.employee_name,
        employee_number: log.employee_number,
        action: log.action,
        action_type: log.action_type,
        severity: log.severity || 'low',
        target_table: log.target_table,
        target_record_id: log.target_record_id,
        created_at: log.created_at,
        title,
        description: log.description || fallbackDescription || 'Audit log entry',
      }
    })

    return NextResponse.json({
      success: true,
      data: activities,
      meta: {
        total: activities.length,
        limit,
        offset,
      },
    })
  } catch (error) {
    console.error('[audit-logs] GET failed', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch audit logs',
      },
      { status: 500 },
    )
  }
}


