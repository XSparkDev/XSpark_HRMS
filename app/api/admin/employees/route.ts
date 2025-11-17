// ============================================================================
// ADMIN EMPLOYEES API ROUTE - Admin Employee Creation
// ============================================================================
// This endpoint creates both Supabase Auth user and employee record atomically
// Includes validation, rollback, and encryption handling
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/services/auth-service'
import { z } from 'zod'

// Validation schema for admin employee creation
const AdminCreateEmployeeSchema = z.object({
  employee: z.object({
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
    profile_picture_url: z.string().url().optional()
  }),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  options: z.object({
    sendEmail: z.boolean().optional()
  }).optional()
})

// ============================================================================
// POST /api/admin/employees - Create employee with auth
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request body
    const validation = AdminCreateEmployeeSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors
      }, { status: 400 })
    }

    const { employee, password, options } = validation.data

    // Create employee with auth using service
    const result = await authService.createEmployeeWithAuth(
      employee,
      password,
      options || {}
    )

    return NextResponse.json({
      success: true,
      data: {
        employee: result.employee,
        authUser: {
          id: result.authUser.id,
          email: result.authUser.email,
          created_at: result.authUser.created_at
        }
      },
      message: 'Employee created successfully with authentication'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating employee with auth:', error)
    
    // Handle specific error types
    const errorMessage = error instanceof Error ? error.message : 'Failed to create employee'
    
    // Determine status code based on error message
    let statusCode = 500
    if (errorMessage.includes('already exists') || errorMessage.includes('already registered')) {
      statusCode = 409
    } else if (errorMessage.includes('validation') || errorMessage.includes('must provide')) {
      statusCode = 400
    }

    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: statusCode })
  }
}

// ============================================================================
// GET /api/admin/employees - List employees (future implementation)
// ============================================================================
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: 'Not implemented yet'
  }, { status: 501 })
}

