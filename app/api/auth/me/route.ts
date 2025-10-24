import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/services/auth-service'

export async function GET(request: NextRequest) {
  try {
    const authResponse = await authService.getCurrentUserWithEmployee()

    if (!authResponse.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not authenticated'
        },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        user: authResponse.user,
        employee: authResponse.employee,
        session: authResponse.session
      }
    })

  } catch (error) {
    console.error('Get current user error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user data'
      },
      { status: 500 }
    )
  }
}

