import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/services/auth-service'
import { z } from 'zod'

// Validation schema
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  metadata: z.record(z.any()).optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validation = signupSchema.safeParse(body)
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

    const signupData = validation.data

    // Validate password strength
    const passwordValidation = authService.validatePasswordStrength(signupData.password)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password does not meet security requirements',
          details: passwordValidation.errors
        },
        { status: 400 }
      )
    }

    // Check if email already exists
    const emailExists = await authService.isEmailRegistered(signupData.email)
    if (emailExists) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email already registered'
        },
        { status: 409 }
      )
    }

    // Sign up user
    const authResponse = await authService.signup(signupData)

    return NextResponse.json({
      success: true,
      message: 'Signup successful. Please check your email to verify your account.',
      data: {
        user: authResponse.user,
        session: authResponse.session
      }
    })

  } catch (error) {
    console.error('Signup error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Signup failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

