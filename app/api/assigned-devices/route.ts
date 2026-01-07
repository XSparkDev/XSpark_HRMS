import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { assignedDevicesService } from '@/lib/services'
import type { AssignmentFilters, CreateAssignmentInput } from '@/lib/services/assigned-devices-service'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

const listQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  deviceId: z.string().uuid().optional(),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  assignmentType: z.string().optional(),
  fromDate: z.string().regex(dateRegex).optional(),
  toDate: z.string().regex(dateRegex).optional(),
  includeDeleted: z.union([z.string(), z.boolean()]).optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  offset: z.coerce.number().min(0).optional(),
})

const createAssignmentSchema = z.object({
  device_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  assigned_by: z.string().uuid().optional(),
  assignment_type: z.string().optional(),
  status: z.string().optional(),
  expected_return_date: z.string().regex(dateRegex).optional(),
  assigned_condition: z.string().optional(),
  purpose: z.string().optional(),
  assignment_notes: z.string().optional(),
  approval_required: z.boolean().optional(),
})

const normalizeStatus = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, '_')

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const parsed = listQuerySchema.parse({
      employeeId: searchParams.get('employeeId') || undefined,
      deviceId: searchParams.get('deviceId') || undefined,
      status: searchParams.getAll('status').length > 1
        ? searchParams.getAll('status')
        : (searchParams.get('status') ? searchParams.get('status') : undefined),
      assignmentType: searchParams.get('assignmentType') || undefined,
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      includeDeleted: searchParams.get('includeDeleted') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    })

    const filters: AssignmentFilters = {
      employeeId: parsed.employeeId,
      deviceId: parsed.deviceId,
      assignmentType: parsed.assignmentType ? normalizeStatus(parsed.assignmentType) as any : undefined,
      fromDate: parsed.fromDate || undefined,
      toDate: parsed.toDate || undefined,
      includeDeleted: typeof parsed.includeDeleted === 'string'
        ? parsed.includeDeleted.toLowerCase() === 'true'
        : parsed.includeDeleted,
      limit: parsed.limit,
      offset: parsed.offset,
    }

    if (parsed.status) {
      if (Array.isArray(parsed.status)) {
        filters.status = parsed.status.map((value) => normalizeStatus(value)) as any
      } else {
        filters.status = normalizeStatus(parsed.status) as any
      }
    }

    const assignments = await assignedDevicesService.listAssignments(filters)

    return NextResponse.json({
      success: true,
      data: assignments,
      meta: {
        count: assignments.length,
        limit: filters.limit ?? null,
        offset: filters.offset ?? null,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid query parameters', details: error.errors }, { status: 400 })
    }

    console.error('Failed to list assigned devices:', error)
    return NextResponse.json({ success: false, error: 'Failed to list assigned devices' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json()
    const payload = createAssignmentSchema.parse(json)

    const assignment = await assignedDevicesService.createAssignment(payload as CreateAssignmentInput)

    return NextResponse.json({ success: true, data: assignment }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid assignment payload', details: error.errors }, { status: 400 })
    }

    console.error('Failed to create assigned device record:', error)
    return NextResponse.json({ success: false, error: 'Failed to create assigned device record' }, { status: 500 })
  }
}



















