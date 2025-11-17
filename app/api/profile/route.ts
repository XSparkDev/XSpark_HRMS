import { NextRequest, NextResponse } from "next/server"
import { appFormSchema, validateProfile, type ProfileFormData } from "@/lib/validation/app-form"
import { encrypt, decrypt, sanitizeInput, validateFileUpload, checkRateLimit, logAuditEvent } from "@/lib/crypto"
import { getCurrentUser } from "@/lib/auth"

type StoredBankingDetails = (NonNullable<ProfileFormData["banking_details"]> & {
  encrypted_account_number?: string | null
  encrypted_id_number?: string | null
}) | undefined

type StoredProfile = (ProfileFormData & {
  encrypted_id_number?: string | null
  encrypted_tax_number?: string | null
  banking_details?: StoredBankingDetails
}) & Record<string, any>

// Mock database - replace with actual database calls
const profiles: Map<string, StoredProfile> = new Map()

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimit = checkRateLimit(clientIP, 15 * 60 * 1000, 10) // 10 requests per 15 minutes
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          message: "Too many requests. Please try again later.",
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        },
        { status: 429 }
      )
    }

    // Get current user
    const user = getCurrentUser()
    if (!user || !user.id) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }
    const userId = user.id

    // Parse and validate request body
    const body = await request.json()
    
    // Server-side validation
    const validationResult = validateProfile(body)
    if (!validationResult.success) {
      logAuditEvent('profile_validation_failed', {
        userId,
        errors: validationResult.errors,
        ip: clientIP,
        userAgent: request.headers.get('user-agent')
      }, userId, 'medium')
      
      return NextResponse.json(
        { 
          message: "Validation failed",
          errors: validationResult.errors
        },
        { status: 400 }
      )
    }

    // Sanitize all text inputs
    const sanitizedData = {
      ...body,
      first_name: sanitizeInput(body.first_name),
      middle_name: sanitizeInput(body.middle_name || ''),
      last_name: sanitizeInput(body.last_name),
      preferred_name: sanitizeInput(body.preferred_name || ''),
      pronouns: sanitizeInput(body.pronouns || ''),
      address: sanitizeInput(body.address || ''),
      reason: sanitizeInput(body.reason || ''),
      // Sanitize next of kin data
      next_of_kin: body.next_of_kin ? {
        ...body.next_of_kin,
        first_name: sanitizeInput(body.next_of_kin.first_name || ''),
        middle_name: sanitizeInput(body.next_of_kin.middle_name || ''),
        last_name: sanitizeInput(body.next_of_kin.last_name || ''),
        email: sanitizeInput(body.next_of_kin.email || ''),
        relationship: sanitizeInput(body.next_of_kin.relationship || '')
      } : undefined,
      // Sanitize banking data
      banking_details: body.banking_details ? {
        ...body.banking_details,
        full_name: sanitizeInput(body.banking_details.full_name || ''),
        email: sanitizeInput(body.banking_details.email || ''),
        address: sanitizeInput(body.banking_details.address || ''),
        bank_name: sanitizeInput(body.banking_details.bank_name || ''),
        branch_number: sanitizeInput(body.banking_details.branch_number || ''),
        account_type: sanitizeInput(body.banking_details.account_type || '')
      } : undefined
    }

    // Encrypt sensitive data
    const encryptedData = {
      ...sanitizedData,
      // Encrypt sensitive fields
      encrypted_id_number: sanitizedData.id_number ? encrypt(sanitizedData.id_number) : null,
      encrypted_tax_number: sanitizedData.tax_number ? encrypt(sanitizedData.tax_number) : null,
      // Encrypt banking details
      banking_details: sanitizedData.banking_details ? {
        ...sanitizedData.banking_details,
        encrypted_account_number: sanitizedData.banking_details.account_number ? encrypt(sanitizedData.banking_details.account_number) : null,
        encrypted_id_number: sanitizedData.banking_details.id_number ? encrypt(sanitizedData.banking_details.id_number) : null
      } : undefined
    }

    // Remove plain text sensitive data
    delete encryptedData.id_number
    delete encryptedData.tax_number
    if (encryptedData.banking_details) {
      delete encryptedData.banking_details.account_number
      delete encryptedData.banking_details.id_number
    }

    // Generate employee ID if not provided
    if (!encryptedData.employee_id) {
      const now = new Date()
      const year = now.getFullYear().toString().slice(-2)
      const month = (now.getMonth() + 1).toString().padStart(2, '0')
      const sequence = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
      encryptedData.employee_id = `XSP${year}${month}/${sequence}`
    }

    // Add metadata
    const profileData = {
      ...encryptedData,
      id: crypto.randomUUID(),
      auth_user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
      // Set verification flags based on nationality
      id_verified: encryptedData.nationality === 'South Africa' ? false : false, // Will be set by admin
      work_permit_verified: encryptedData.nationality !== 'South Africa' ? false : null,
      bank_verified: false // Will be set by admin
    }

    // Store profile (in production, save to database)
    profiles.set(userId, profileData as StoredProfile)

    // Log successful creation
    logAuditEvent('profile_created', {
      userId,
      employeeId: profileData.employee_id,
      nationality: profileData.nationality,
      ip: clientIP,
      userAgent: request.headers.get('user-agent')
    }, userId, 'high')

    return NextResponse.json(
      { 
        message: "Profile created successfully",
        profile: {
          id: profileData.id,
          employee_id: profileData.employee_id,
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          email: profileData.email,
          nationality: profileData.nationality,
          created_at: profileData.created_at
        }
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Profile creation error:', error)
    
    logAuditEvent('profile_creation_error', {
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
    const user = getCurrentUser()
    if (!user || !user.id) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }
    const userId = user.id

    // Get profile from database
    const profile = profiles.get(userId)
    if (!profile) {
      return NextResponse.json(
        { message: "Profile not found" },
        { status: 404 }
      )
    }

    // Decrypt sensitive data for display
    const decryptedProfile = {
      ...profile,
      id_number: profile.encrypted_id_number ? decrypt(profile.encrypted_id_number) : null,
      tax_number: profile.encrypted_tax_number ? decrypt(profile.encrypted_tax_number) : null,
      banking_details: profile.banking_details ? {
        ...profile.banking_details,
        account_number: profile.banking_details.encrypted_account_number ? 
          decrypt(profile.banking_details.encrypted_account_number) : null,
        id_number: profile.banking_details.encrypted_id_number ? 
          decrypt(profile.banking_details.encrypted_id_number) : null
      } : undefined
    }

    // Remove encrypted fields
    delete decryptedProfile.encrypted_id_number
    delete decryptedProfile.encrypted_tax_number
    if (decryptedProfile.banking_details) {
      delete decryptedProfile.banking_details.encrypted_account_number
      delete decryptedProfile.banking_details.encrypted_id_number
    }

    // Log profile access
    logAuditEvent('profile_accessed', {
      userId,
      ip: clientIP,
      userAgent: request.headers.get('user-agent')
    }, userId, 'low')

    return NextResponse.json(decryptedProfile)

  } catch (error) {
    console.error('Profile retrieval error:', error)
    
    logAuditEvent('profile_retrieval_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    }, undefined, 'critical')

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimit = checkRateLimit(clientIP, 15 * 60 * 1000, 5) // 5 updates per 15 minutes
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "Too many update requests" },
        { status: 429 }
      )
    }

    // Get current user
    const user = getCurrentUser()
    if (!user || !user.id) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }
    const userId = user.id

    // Check if profile exists
    const existingProfile = profiles.get(userId)
    if (!existingProfile) {
      return NextResponse.json(
        { message: "Profile not found" },
        { status: 404 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    
    // Server-side validation
    const validationResult = validateProfile(body)
    if (!validationResult.success) {
      logAuditEvent('profile_update_validation_failed', {
        userId,
        errors: validationResult.errors,
        ip: clientIP,
        userAgent: request.headers.get('user-agent')
      }, userId, 'medium')
      
      return NextResponse.json(
        { 
          message: "Validation failed",
          errors: validationResult.errors
        },
        { status: 400 }
      )
    }

    // Check for sensitive field changes requiring re-authentication
    const sensitiveFields = ['id_number', 'tax_number', 'passport_number', 'account_number']
    const hasSensitiveChanges = sensitiveFields.some(field => {
      if (field === 'account_number') {
        return body.banking_details?.account_number !== 
               (existingProfile.banking_details?.encrypted_account_number ? 
                decrypt(existingProfile.banking_details.encrypted_account_number) : null)
      }
      return body[field] !== (existingProfile[`encrypted_${field}`] ? 
                             decrypt(existingProfile[`encrypted_${field}`]) : null)
    })

    if (hasSensitiveChanges && !body.reauthenticated) {
      return NextResponse.json(
        { 
          message: "Re-authentication required for sensitive data changes",
          requiresReauth: true
        },
        { status: 403 }
      )
    }

    // Sanitize all text inputs
    const sanitizedData = {
      ...body,
      first_name: sanitizeInput(body.first_name),
      middle_name: sanitizeInput(body.middle_name || ''),
      last_name: sanitizeInput(body.last_name),
      preferred_name: sanitizeInput(body.preferred_name || ''),
      pronouns: sanitizeInput(body.pronouns || ''),
      address: sanitizeInput(body.address || ''),
      // Sanitize next of kin data
      next_of_kin: body.next_of_kin ? {
        ...body.next_of_kin,
        first_name: sanitizeInput(body.next_of_kin.first_name || ''),
        middle_name: sanitizeInput(body.next_of_kin.middle_name || ''),
        last_name: sanitizeInput(body.next_of_kin.last_name || ''),
        email: sanitizeInput(body.next_of_kin.email || ''),
        relationship: sanitizeInput(body.next_of_kin.relationship || '')
      } : undefined,
      // Sanitize banking data
      banking_details: body.banking_details ? {
        ...body.banking_details,
        full_name: sanitizeInput(body.banking_details.full_name || ''),
        email: sanitizeInput(body.banking_details.email || ''),
        address: sanitizeInput(body.banking_details.address || ''),
        bank_name: sanitizeInput(body.banking_details.bank_name || ''),
        branch_number: sanitizeInput(body.banking_details.branch_number || ''),
        account_type: sanitizeInput(body.banking_details.account_type || '')
      } : undefined
    }

    // Encrypt sensitive data
    const encryptedData = {
      ...sanitizedData,
      // Encrypt sensitive fields
      encrypted_id_number: sanitizedData.id_number ? encrypt(sanitizedData.id_number) : existingProfile.encrypted_id_number,
      encrypted_tax_number: sanitizedData.tax_number ? encrypt(sanitizedData.tax_number) : existingProfile.encrypted_tax_number,
      // Encrypt banking details
      banking_details: sanitizedData.banking_details ? {
        ...sanitizedData.banking_details,
        encrypted_account_number: sanitizedData.banking_details.account_number ? encrypt(sanitizedData.banking_details.account_number) : existingProfile.banking_details?.encrypted_account_number ?? null,
        encrypted_id_number: sanitizedData.banking_details.id_number ? encrypt(sanitizedData.banking_details.id_number) : existingProfile.banking_details?.encrypted_id_number ?? null
      } : existingProfile.banking_details
    }

    // Remove plain text sensitive data
    delete encryptedData.id_number
    delete encryptedData.tax_number
    if (encryptedData.banking_details) {
      delete encryptedData.banking_details.account_number
      delete encryptedData.banking_details.id_number
    }

    // Update profile
    const updatedProfile = {
      ...existingProfile,
      ...encryptedData,
      updated_at: new Date().toISOString()
    }

    // Store updated profile
    profiles.set(userId, updatedProfile)

    // Log successful update
    logAuditEvent('profile_updated', {
      userId,
      employeeId: updatedProfile.employee_id,
      sensitiveFieldsChanged: hasSensitiveChanges,
      ip: clientIP,
      userAgent: request.headers.get('user-agent')
    }, userId, 'high')

    return NextResponse.json(
      { 
        message: "Profile updated successfully",
        profile: {
          id: updatedProfile.id,
          employee_id: updatedProfile.employee_id,
          first_name: updatedProfile.first_name,
          last_name: updatedProfile.last_name,
          email: updatedProfile.email,
          updated_at: updatedProfile.updated_at
        }
      }
    )

  } catch (error) {
    console.error('Profile update error:', error)
    
    logAuditEvent('profile_update_error', {
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
    const rateLimit = checkRateLimit(clientIP, 15 * 60 * 1000, 1) // 1 deletion per 15 minutes
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "Too many deletion requests" },
        { status: 429 }
      )
    }

    // Get current user
    const user = getCurrentUser()
    if (!user || !user.id) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }
    const userId = user.id

    // Check if profile exists
    const existingProfile = profiles.get(userId)
    if (!existingProfile) {
      return NextResponse.json(
        { message: "Profile not found" },
        { status: 404 }
      )
    }

    // Soft delete profile
    const deletedProfile = {
      ...existingProfile,
      is_active: false,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    profiles.set(userId, deletedProfile)

    // Log deletion
    logAuditEvent('profile_deleted', {
      userId,
      employeeId: deletedProfile.employee_id,
      ip: clientIP,
      userAgent: request.headers.get('user-agent')
    }, userId, 'critical')

    return NextResponse.json(
      { message: "Profile deleted successfully" }
    )

  } catch (error) {
    console.error('Profile deletion error:', error)
    
    logAuditEvent('profile_deletion_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    }, undefined, 'critical')

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}
