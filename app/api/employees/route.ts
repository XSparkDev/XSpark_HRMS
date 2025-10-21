// ============================================================================
// EMPLOYEES API ROUTE - Controller Implementation
// ============================================================================
// This shows how to use the service layer in API routes
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { employeeService } from '@/lib/services'
import { z } from 'zod'

// Validation schemas
const CreateEmployeeSchema = z.object({
  auth_user_id: z.string().uuid().optional(),
  first_name: z.string().min(1).max(100),
  middle_name: z.string().max(100).optional(),
  last_name: z.string().min(1).max(100),
  preferred_name: z.string().max(100).optional(),
  id_number: z.string().length(13).optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sex: z.enum(['male', 'female']),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  pronouns: z.string().max(50).optional(),
  job_title_id: z.string().uuid().optional(),
  role_id: z.string().uuid().optional(),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  alternative_phone: z.string().max(20).optional(),
  address: z.string().optional(),
  tax_number: z.string().max(50).optional(),
  nationality: z.string().max(100).default('South Africa'),
  passport_number: z.string().max(50).optional(),
  passport_document_url: z.string().url().optional(),
  work_permit_url: z.string().url().optional(),
  employment_status: z.enum(['active', 'suspended', 'terminated', 'probation', 'absconded', 'archived']).default('probation'),
  date_hired: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  profile_picture_url: z.string().url().optional(),
  documents: z.array(z.any()).optional()
})

const UpdateEmployeeSchema = CreateEmployeeSchema.partial().extend({
  id: z.string().uuid()
})

const EmployeeFiltersSchema = z.object({
  search: z.string().optional(),
  department: z.string().optional(),
  job_title: z.string().optional(),
  employment_status: z.string().optional(),
  nationality: z.string().optional(),
  is_active: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0)
})

// ============================================================================
// GET /api/employees - Get all employees with optional filtering
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse and validate query parameters
    const filters = EmployeeFiltersSchema.parse({
      search: searchParams.get('search') || undefined,
      department: searchParams.get('department') || undefined,
      job_title: searchParams.get('job_title') || undefined,
      employment_status: searchParams.get('employment_status') || undefined,
      nationality: searchParams.get('nationality') || undefined,
      is_active: searchParams.get('is_active') ? searchParams.get('is_active') === 'true' : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0
    })

    // Get employees from service
    const employees = await employeeService.getAllActive(filters)

    return NextResponse.json({
      success: true,
      data: employees,
      meta: {
        count: employees.length,
        limit: filters.limit,
        offset: filters.offset
      }
    })
  } catch (error) {
    console.error('Error fetching employees:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch employees'
    }, { status: 500 })
  }
}

// ============================================================================
// POST /api/employees - Create a new employee
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request body
    const employeeData = CreateEmployeeSchema.parse(body)

    // Create employee via service
    const employee = await employeeService.create(employeeData)

    return NextResponse.json({
      success: true,
      data: employee,
      message: 'Employee created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating employee:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid employee data',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to create employee'
    }, { status: 500 })
  }
}

// ============================================================================
// PUT /api/employees - Update an employee
// ============================================================================
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request body
    const updateData = UpdateEmployeeSchema.parse(body)

    // Update employee via service
    const employee = await employeeService.update(updateData.id, updateData)

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
