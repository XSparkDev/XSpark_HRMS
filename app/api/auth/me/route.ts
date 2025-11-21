import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/lib/services/auth-service'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    // Prefer Authorization header if present (SPA call with bearer token)
    const authHeader = request.headers.get('Authorization')

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)

      // Create authenticated client with user's token (respects RLS)
      const supabaseUrl = process.env.SUPABASE_URL!
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      })

      // Get user from token
      const { data: { user }, error } = await userClient.auth.getUser(token)
      if (error || !user) {
        return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
      }

      // Fetch employee using user's authenticated client (respects RLS)
      // If RLS allows user to read their own employee record, this works
      // Otherwise, fall back to admin client only after verifying ownership
      let employee = null
      // PREVIOUS QUERY: .select('*, job_titles(title)')
      // UPDATED QUERY: includes next_of_kin so profile consumers receive NOK rows.
      const { data: employeeData, error: empError } = await userClient
        .from('employees')
        .select('*, job_titles(title), next_of_kin(*), role:roles(role_name)')
        .eq('auth_user_id', user.id)
        .single()

      console.log('Employee data with next_of_kin (user client):', employeeData)

      employee = employeeData || null

      // If RLS blocks access, verify ownership and use admin client as fallback
      if (empError || !employee) {
        // Double-check: verify this token belongs to this user before using admin client
        // PREVIOUS QUERY: .select('*, job_titles(title)')
        // UPDATED QUERY: .select('*, job_titles(title), next_of_kin(*)')
        const { data: adminEmployee } = await supabaseAdmin
          .from('employees')
          .select('*, job_titles(title), next_of_kin(*), role:roles(role_name)')
          .eq('auth_user_id', user.id)
          .single()

        console.log('Employee data with next_of_kin (admin client):', adminEmployee)
        
        if (!adminEmployee) {
          return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
        }
        
        // Only use admin data if auth_user_id matches (security check)
        if (adminEmployee.auth_user_id === user.id) {
          employee = adminEmployee
        } else {
          return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
        }
      }

      const roleName = employee?.role?.role_name?.toLowerCase?.() || 'employee'

      return NextResponse.json({
        success: true,
        data: {
          user,
          employee: employee
            ? {
                ...employee,
                role_name: roleName,
              }
            : null,
          session: null
        }
      })
    }

    // Fallback: cookie/session based
    const authResponse = await authService.getCurrentUserWithEmployee()

    if (!authResponse.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    const roleName =
      authResponse.employee?.role?.role_name?.toLowerCase?.() || 'employee'

    return NextResponse.json({
      success: true,
      data: {
        user: authResponse.user,
        employee: authResponse.employee
          ? {
              ...authResponse.employee,
              role_name: roleName,
            }
          : null,
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

