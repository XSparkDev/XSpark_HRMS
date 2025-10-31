import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/services/auth-service'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { z } from 'zod'

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validation = loginSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.errors
        },
        { status: 400 }
      )
    }

    const { email, password } = validation.data

    // Attempt login
    const authResponse = await authService.login({ email, password })

    // Check if employee exists
    if (!authResponse.employee) {
      return NextResponse.json(
        {
          success: false,
          error: 'Employee record not found for this user'
        },
        { status: 404 }
      )
    }

    // Check if employee is active
    if (!authResponse.employee.is_active) {
      return NextResponse.json(
        {
          success: false,
          error: 'Your account has been deactivated. Please contact HR.'
        },
        { status: 403 }
      )
    }

    // Fetch role name from roles table if role_id exists
    let roleName = 'employee' // Default
    if (authResponse.employee.role_id) {
      const { data: roleData } = await supabaseAdmin
        .from('roles')
        .select('role_name')
        .eq('id', authResponse.employee.role_id)
        .single()
      
      if (roleData?.role_name) {
        roleName = roleData.role_name
      }
    }

    // Format user object with role for frontend
    const userWithRole = {
      ...authResponse.user,
      role: roleName,
      name: `${authResponse.employee.first_name} ${authResponse.employee.last_name}`,
      employeeId: authResponse.employee.employee_id
    }

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithRole,
        employee: authResponse.employee,
        session: authResponse.session
      }
    })

  } catch (error) {
    console.error('Login error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 401 }
    )
  }
}

