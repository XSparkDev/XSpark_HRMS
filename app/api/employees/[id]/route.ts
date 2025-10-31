// ============================================================================
// INDIVIDUAL EMPLOYEE API ROUTE - Controller Implementation
// ============================================================================
// This handles operations on individual employees (GET, PUT, DELETE)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { employeeService } from '@/lib/services'
import { z } from 'zod'

// Validation schemas
const EmployeeIdSchema = z.string().uuid()

const UpdateEmployeeSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  middle_name: z.string().max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  preferred_name: z.string().max(100).optional(),
  id_number: z.string().length(13).optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sex: z.enum(['male', 'female']).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  pronouns: z.string().max(50).optional(),
  job_title_id: z.string().uuid().optional(),
  role_id: z.string().uuid().optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  alternative_phone: z.string().max(20).optional(),
  address: z.string().optional(),
  tax_number: z.string().max(50).optional(),
  nationality: z.string().max(100).optional(),
  passport_number: z.string().max(50).optional(),
  passport_document_url: z.string().url().optional(),
  work_permit_url: z.string().url().optional(),
  employment_status: z.enum(['active', 'suspended', 'terminated', 'probation', 'absconded', 'archived']).optional(),
  date_hired: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_terminated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  termination_reason: z.string().optional(),
  profile_picture_url: z.string().url().optional(),
  documents: z.array(z.any()).optional()
})

const ArchiveEmployeeSchema = z.object({
  reason: z.string().optional()
})

// ============================================================================
// GET /api/employees/[id] - Get employee by ID
// ============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate employee ID
    const employeeId = EmployeeIdSchema.parse(params.id)

    // Get employee from service
    const employee = await employeeService.getById(employeeId)

    if (!employee) {
      return NextResponse.json({
        success: false,
        error: 'Employee not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: employee
    })
  } catch (error) {
    console.error('Error fetching employee:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid employee ID',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch employee'
    }, { status: 500 })
  }
}

// ============================================================================
// PUT /api/employees/[id] - Update employee
// ============================================================================
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Validate employee ID (await params per Next.js guidance)
    const { id } = await context.params
    const employeeId = EmployeeIdSchema.parse(id)
    
    const body = await request.json()
    
    // Validate request body
    const updateData = UpdateEmployeeSchema.parse(body)

    // Update employee via service
    const employee = await employeeService.update(employeeId, updateData)

    if (!employee) {
      return NextResponse.json({
        success: false,
        error: 'Employee not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: employee,
      message: 'Employee updated successfully'
    })
  } catch (error) {
    console.error('Error updating employee:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid employee data',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to update employee'
    }, { status: 500 })
  }
}

// ============================================================================
// DELETE /api/employees/[id] - Archive employee (soft delete)
// ============================================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate employee ID
    const employeeId = EmployeeIdSchema.parse(params.id)
    
    // Get archive reason from request body (optional)
    let archiveReason: string | undefined
    try {
      const body = await request.json()
      const archiveData = ArchiveEmployeeSchema.parse(body)
      archiveReason = archiveData.reason
    } catch {
      // No body or invalid body - that's okay, reason is optional
    }

    // Archive employee via service
    const success = await employeeService.archive(employeeId, archiveReason)

    if (!success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to archive employee'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Employee archived successfully'
    })
  } catch (error) {
    console.error('Error archiving employee:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid employee ID',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to archive employee'
    }, { status: 500 })
  }
}

// ============================================================================
// PATCH /api/employees/[id] - Restore archived employee
// ============================================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate employee ID
    const employeeId = EmployeeIdSchema.parse(params.id)

    // Restore employee via service
    const employee = await employeeService.restore(employeeId)

    if (!employee) {
      return NextResponse.json({
        success: false,
        error: 'Employee not found or could not be restored'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: employee,
      message: 'Employee restored successfully'
    })
  } catch (error) {
    console.error('Error restoring employee:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid employee ID',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to restore employee'
    }, { status: 500 })
  }
}
