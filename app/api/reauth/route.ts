import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, logAuditEvent, generateToken, hash, verifyHash } from "@/lib/crypto"
import { getCurrentUser } from "@/lib/auth"

// Re-authentication session storage (in production, use Redis or database)
const reauthSessions = new Map<string, {
  userId: string
  expiresAt: number
  purpose: string
  verified: boolean
}>()

// Sensitive operations requiring re-authentication
const SENSITIVE_OPERATIONS = {
  'update_id_number': 'Update ID Number',
  'update_tax_number': 'Update Tax Number',
  'update_passport_number': 'Update Passport Number',
  'update_banking_details': 'Update Banking Details',
  'delete_profile': 'Delete Profile',
  'update_sensitive_data': 'Update Sensitive Data'
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimit = checkRateLimit(clientIP, 15 * 60 * 1000, 5) // 5 re-auth requests per 15 minutes
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "Too many re-authentication requests" },
        { status: 429 }
      )
    }

    // Get current user
    const user = getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }

    const { operation, password, twoFactorCode } = await request.json()

    if (!operation || !SENSITIVE_OPERATIONS[operation as keyof typeof SENSITIVE_OPERATIONS]) {
      return NextResponse.json(
        { message: "Invalid operation" },
        { status: 400 }
      )
    }

    // Verify password (in production, verify against hashed password in database)
    const isValidPassword = await verifyPassword(user.id, password)
    if (!isValidPassword) {
      logAuditEvent('reauth_password_failed', {
        userId: user.id,
        operation,
        ip: clientIP,
        userAgent: request.headers.get('user-agent')
      }, user.id, 'high')

      return NextResponse.json(
        { message: "Invalid password" },
        { status: 401 }
      )
    }

    // Verify 2FA if enabled (mock implementation)
    if (user.twoFactorEnabled) {
      const isValid2FA = await verifyTwoFactorCode(user.id, twoFactorCode)
      if (!isValid2FA) {
        logAuditEvent('reauth_2fa_failed', {
          userId: user.id,
          operation,
          ip: clientIP,
          userAgent: request.headers.get('user-agent')
        }, user.id, 'high')

        return NextResponse.json(
          { message: "Invalid 2FA code" },
          { status: 401 }
        )
      }
    }

    // Create re-authentication session
    const sessionToken = generateToken(32)
    const expiresAt = Date.now() + (15 * 60 * 1000) // 15 minutes

    reauthSessions.set(sessionToken, {
      userId: user.id,
      expiresAt,
      purpose: operation,
      verified: true
    })

    // Log successful re-authentication
    logAuditEvent('reauth_successful', {
      userId: user.id,
      operation,
      sessionToken: hash(sessionToken), // Log hashed token for security
      ip: clientIP,
      userAgent: request.headers.get('user-agent')
    }, user.id, 'high')

    return NextResponse.json({
      message: "Re-authentication successful",
      sessionToken,
      expiresAt,
      operation: SENSITIVE_OPERATIONS[operation as keyof typeof SENSITIVE_OPERATIONS]
    })

  } catch (error) {
    console.error('Re-authentication error:', error)
    
    logAuditEvent('reauth_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    }, undefined, 'critical')

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimit = checkRateLimit(clientIP, 15 * 60 * 1000, 100) // 100 requests per 15 minutes
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "Too many requests" },
        { status: 429 }
      )
    }

    // Get current user
    const user = getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const sessionToken = searchParams.get('token')

    if (!sessionToken) {
      return NextResponse.json(
        { message: "Session token required" },
        { status: 400 }
      )
    }

    // Verify session
    const session = reauthSessions.get(sessionToken)
    if (!session) {
      return NextResponse.json(
        { message: "Invalid session token" },
        { status: 401 }
      )
    }

    if (session.userId !== user.id) {
      return NextResponse.json(
        { message: "Session token does not match user" },
        { status: 401 }
      )
    }

    if (session.expiresAt < Date.now()) {
      reauthSessions.delete(sessionToken)
      return NextResponse.json(
        { message: "Session expired" },
        { status: 401 }
      )
    }

    if (!session.verified) {
      return NextResponse.json(
        { message: "Session not verified" },
        { status: 401 }
      )
    }

    // Log session verification
    logAuditEvent('reauth_session_verified', {
      userId: user.id,
      purpose: session.purpose,
      ip: clientIP,
      userAgent: request.headers.get('user-agent')
    }, user.id, 'medium')

    return NextResponse.json({
      valid: true,
      purpose: session.purpose,
      expiresAt: session.expiresAt,
      timeRemaining: session.expiresAt - Date.now()
    })

  } catch (error) {
    console.error('Session verification error:', error)
    
    logAuditEvent('reauth_session_verification_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    }, undefined, 'critical')

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimit = checkRateLimit(clientIP, 15 * 60 * 1000, 20) // 20 requests per 15 minutes
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "Too many requests" },
        { status: 429 }
      )
    }

    // Get current user
    const user = getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }

    const { sessionToken } = await request.json()

    if (!sessionToken) {
      return NextResponse.json(
        { message: "Session token required" },
        { status: 400 }
      )
    }

    // Verify session ownership
    const session = reauthSessions.get(sessionToken)
    if (!session || session.userId !== user.id) {
      return NextResponse.json(
        { message: "Invalid session token" },
        { status: 401 }
      )
    }

    // Revoke session
    reauthSessions.delete(sessionToken)

    // Log session revocation
    logAuditEvent('reauth_session_revoked', {
      userId: user.id,
      purpose: session.purpose,
      ip: clientIP,
      userAgent: request.headers.get('user-agent')
    }, user.id, 'medium')

    return NextResponse.json({
      message: "Session revoked successfully"
    })

  } catch (error) {
    console.error('Session revocation error:', error)
    
    logAuditEvent('reauth_session_revocation_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    }, undefined, 'critical')

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

// Helper functions (mock implementations - replace with actual implementations)

async function verifyPassword(userId: string, password: string): Promise<boolean> {
  // Mock password verification
  // In production, hash the provided password and compare with stored hash
  console.log(`Verifying password for user ${userId}`)
  
  // Mock: accept any non-empty password
  return password && password.length > 0
}

async function verifyTwoFactorCode(userId: string, code: string): Promise<boolean> {
  // Mock 2FA verification
  // In production, verify against TOTP or SMS code
  console.log(`Verifying 2FA code for user ${userId}`)
  
  // Mock: accept any 6-digit code
  return code && /^\d{6}$/.test(code)
}

// Cleanup expired sessions (run periodically)
setInterval(() => {
  const now = Date.now()
  for (const [token, session] of reauthSessions.entries()) {
    if (session.expiresAt < now) {
      reauthSessions.delete(token)
    }
  }
}, 5 * 60 * 1000) // Clean up every 5 minutes
