// ============================================================================
// ROLES API ROUTE - Get all roles
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    const { data: roles, error } = await supabaseAdmin
      .from('roles')
      .select('id, role_name, description')
      .order('role_name')

    if (error) {
      console.error('Error fetching roles:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch roles'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: roles || []
    })
  } catch (error) {
    console.error('Error in roles API:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch roles'
    }, { status: 500 })
  }
}


