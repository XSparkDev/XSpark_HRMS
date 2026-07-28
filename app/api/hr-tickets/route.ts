import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// POST /api/hr-tickets
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Generate ticket number
    const ticketNumber = `case-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`

    // Calculate SLA priority
    const urgencyKeywords = ['urgent', 'asap', 'immediate', 'critical', 'emergency']
    const hasUrgency = urgencyKeywords.some((kw) => body.description?.toLowerCase().includes(kw)) || false

    let priority = 'normal'
    if (hasUrgency || body.category === 'workplace_issue') {
      priority = 'urgent'
    } else if (body.category === 'payroll') {
      priority = 'high'
    }

    // Assign estimated SLA time
    const slaMap: Record<string, string> = {
      urgent: '4 hours',
      high: '1 business day',
      normal: '2 business days',
      low: '5 business days'
    }
    const estimatedSLA = slaMap[priority]

    const { data: ticket, error } = await supabaseAdmin
      .from('hr_tickets')
      .insert({
        id: ticketNumber,
        employee_id: body.employee_id,
        name: body.name,
        department: body.department,
        category: body.category,
        subcategory: body.subcategory,
        subject: body.subject,
        description: body.description,
        attachments: body.attachments || [],
        contact_method: body.contact_method || 'email',
        confidential: body.confidential || false,
        status: 'open',
        priority,
        estimated_sla: estimatedSLA,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        employee_id: ticket.employee_id,
        status: ticket.status,
        created_at: ticket.created_at,
        estimated_sla: ticket.estimated_sla,
        category: ticket.category,
        subject: ticket.subject
      },
      message: 'Ticket created successfully. You will receive a confirmation email shortly.'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating ticket:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create ticket',
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 })
  }
}

// GET /api/hr-tickets (my tickets)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')

    if (!employeeId) {
      return NextResponse.json({ success: true, tickets: [] })
    }

    const { data: tickets, error } = await supabaseAdmin
      .from('hr_tickets')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      tickets: tickets ?? []
    })

  } catch (error) {
    console.error('Error fetching tickets:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch tickets'
    }, { status: 500 })
  }
}
