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

    return NextResponse.json(
      {
        success: true,
        data: roles || []
      },
      // Roles change extremely rarely; serve from cache for 60s and let the
      // CDN/browser revalidate in the background for up to 5 minutes so
      // repeat navigations don't re-hit the DB on every page load.
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }
    )
  } catch (error) {
    console.error('Error in roles API:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch roles'
    }, { status: 500 })
  }
}


