import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/services/auth-service'

export async function POST(request: NextRequest) {
  try {
    await authService.logout()

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })

  } catch (error) {
    console.error('Logout error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed'
      },
      { status: 500 }
    )
  }
}

