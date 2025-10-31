// ============================================================================
// PROFILE DECRYPTED FIELDS API
// ============================================================================
// Returns decrypted sensitive fields (id_number, tax_number) ONLY if:
// - caller is the same user (owns the employee record), OR
// - caller has admin/super_admin role
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/services/auth-service'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { supabase } from '@/lib/supabase'
import { decrypt } from '@/lib/crypto'

export async function GET(request: NextRequest) {
  try {
    // Get auth token from Authorization header if present
    const authHeader = request.headers.get('Authorization')
    let user = null
    let employee = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      // Authenticate with the provided token
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !authUser) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }
      user = authUser
      // Get employee by auth_user_id
      const { data: empData, error: empError } = await supabaseAdmin
        .from('employees')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .single()
      
      if (empError || !empData) {
        return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
      }
      employee = empData
    } else {
      // Fall back to session-based auth
      const authResponse = await authService.getCurrentUserWithEmployee()
      user = authResponse.user
      employee = authResponse.employee || null
    }

    if (!user || !employee) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve role name (default to employee)
    let roleName: string = 'employee'
    if (employee.role_id) {
      const { data: roleData } = await supabaseAdmin
        .from('roles')
        .select('role_name')
        .eq('id', employee.role_id)
        .single()
      if (roleData?.role_name) roleName = roleData.role_name
    }

    const isAdmin = roleName === 'admin' || roleName === 'super_admin'
    const isSelf = employee.auth_user_id === user.id

    if (!isAdmin && !isSelf) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Fetch encrypted fields fresh to avoid stale data
    const { data: freshEmployee, error } = await supabaseAdmin
      .from('employees')
      .select('encrypted_id_number, encrypted_tax_number')
      .eq('id', employee.id)
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to fetch sensitive data' }, { status: 500 })
    }

    // Convert BYTEA (hex format) to base64 for decryption
    const convertByteaToBase64 = (byteaValue: any): string | null => {
      if (!byteaValue) return null
      
      try {
        // If it's already a Buffer, convert directly
        if (Buffer.isBuffer(byteaValue)) {
          return byteaValue.toString('base64')
        }
        
        // If it's a string (PostgreSQL BYTEA is returned as hex string)
        if (typeof byteaValue === 'string') {
          // Supabase returns BYTEA as hex string, JSON serializes it as "\\x6371..."
          // In JavaScript, this becomes a string containing literal "\x" followed by hex
          let hexString = byteaValue.trim()
          
          // Handle escaped format: remove \x or \\x prefix
          // The string might be: "\\x6371..." (JSON) -> "\x6371..." (JS string)
          if (hexString.startsWith('\\x')) {
            // Remove single \x prefix
            hexString = hexString.substring(2)
          } else if (hexString.startsWith('\\\\x')) {
            // Handle double-escaped (shouldn't happen but be safe)
            hexString = hexString.substring(4)
          }
          
          // Try to convert hex to buffer
          try {
            const buffer = Buffer.from(hexString, 'hex')
            if (buffer.length > 0) {
              // Old data: stored as base64 string directly -> PostgreSQL stored as UTF-8 bytes
              // -> Supabase returns hex of UTF-8 bytes -> convert hex -> Buffer -> UTF-8 -> that's the base64 string
              // New data: stored as Buffer(binary) -> PostgreSQL stored as binary
              // -> Supabase returns hex of binary -> convert hex -> Buffer -> base64 -> that's the base64
              
              // First try: assume it's old data (stored as UTF-8 string of base64)
              const utf8String = buffer.toString('utf8')
              
              // Check if the UTF-8 string is valid base64
              const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
              if (base64Regex.test(utf8String) && utf8String.length > 10) {
                // It's likely a base64 string (old format)
                console.log(`Converted hex (${hexString.length} chars) - legacy format: UTF-8 base64 string (${utf8String.length} chars)`)
                return utf8String
              }
              
              // Second try: assume it's new data (stored as binary) -> convert to base64
              const base64 = buffer.toString('base64')
              console.log(`Converted hex (${hexString.length} chars) - new format: binary to base64 (${base64.length} chars)`)
              return base64
            }
          } catch (hexError) {
            console.error('Hex conversion failed:', hexError)
            console.error('Hex string sample:', hexString.substring(0, 50))
            return null
          }
          
          return null
        }
        
        return null
      } catch (error) {
        console.error('Error converting BYTEA to base64:', error)
        console.error('Input value type:', typeof byteaValue)
        console.error('Input value sample:', typeof byteaValue === 'string' ? byteaValue.substring(0, 50) : String(byteaValue).substring(0, 50))
        return null
      }
    }

    // Debug: Log the raw BYTEA value
    console.log('Raw encrypted_id_number type:', typeof freshEmployee?.encrypted_id_number)
    console.log('Raw encrypted_id_number value:', freshEmployee?.encrypted_id_number ? String(freshEmployee.encrypted_id_number).substring(0, 100) : 'null')
    console.log('Is Buffer?', Buffer.isBuffer(freshEmployee?.encrypted_id_number))
    
    // Convert and decrypt
    const encryptedIdBase64 = convertByteaToBase64(freshEmployee?.encrypted_id_number)
    const encryptedTaxBase64 = convertByteaToBase64(freshEmployee?.encrypted_tax_number)

    console.log('Encrypted ID Base64:', encryptedIdBase64 ? encryptedIdBase64.substring(0, 50) + '...' : 'null')
    console.log('Encrypted Tax Base64:', encryptedTaxBase64 ? encryptedTaxBase64.substring(0, 50) + '...' : 'null')

    let id_number = null
    let tax_number = null

    if (encryptedIdBase64) {
      try {
        id_number = decrypt(encryptedIdBase64)
        console.log('Successfully decrypted id_number')
      } catch (error) {
        console.error('Error decrypting id_number:', error)
        console.error('Error details:', error instanceof Error ? error.message : String(error))
      }
    } else {
      console.log('No encryptedIdBase64 to decrypt')
    }

    if (encryptedTaxBase64) {
      try {
        tax_number = decrypt(encryptedTaxBase64)
        console.log('Successfully decrypted tax_number')
      } catch (error) {
        console.error('Error decrypting tax_number:', error)
      }
    }

    return NextResponse.json({
      success: true,
      data: { id_number, tax_number }
    })
  } catch (error) {
    console.error('Decrypted profile error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}


