import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/services/auth-service'
import { z } from 'zod'

// Validation schema for requesting reset
const resetRequestSchema = z.object({
  email: z.string().email('Invalid email address')
})

// Validation schema for updating password
const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Check if this is a reset request or password update
    if (body.email) {
      // Request password reset
      const validation = resetRequestSchema.safeParse(body)
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

      await authService.requestPasswordReset(validation.data.email)

      return NextResponse.json({
        success: true,
        message: 'Password reset email sent. Please check your inbox.'
      })

    } else if (body.newPassword) {
      // Update password (after clicking reset link)
      const validation = resetPasswordSchema.safeParse(body)
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

      // Validate password strength
      const passwordValidation = authService.validatePasswordStrength(validation.data.newPassword)
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

      await authService.updatePassword(validation.data.newPassword)

      return NextResponse.json({
        success: true,
        message: 'Password updated successfully'
      })

    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request. Provide either email or newPassword'
        },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Password reset error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Password reset failed'
      },
      { status: 500 }
    )
  }
}

