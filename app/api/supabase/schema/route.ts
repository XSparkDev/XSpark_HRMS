// ============================================================================
// DATABASE SCHEMA INSPECTION API ROUTE
// ============================================================================
// This route inspects the current database schema to verify what's been created
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// ============================================================================
// GET /api/supabase/schema - Inspect database schema
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Inspecting database schema...')
    
    // Check what tables exist
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name')

    if (tablesError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch tables',
        details: tablesError.message,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    // Check what views exist
    const { data: views, error: viewsError } = await supabase
      .from('information_schema.views')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name')

    if (viewsError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch views',
        details: viewsError.message,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    // Check what ENUMs exist
    const { data: enums, error: enumsError } = await supabase
      .from('pg_type')
      .select('typname')
      .eq('typtype', 'e')
      .order('typname')

    if (enumsError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch ENUMs',
        details: enumsError.message,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    // Check if we can query the roles table specifically
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('*')
      .limit(5)

    return NextResponse.json({
      success: true,
      message: 'Database schema inspection completed',
      timestamp: new Date().toISOString(),
      schema: {
        tables: tables?.map(t => t.table_name) || [],
        views: views?.map(v => v.table_name) || [],
        enums: enums?.map(e => e.typname) || [],
        rolesTest: {
          success: !rolesError,
          error: rolesError?.message,
          count: roles?.length || 0,
          sample: roles || []
        }
      }
    })
  } catch (error) {
    console.error('Database schema inspection error:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Database schema inspection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
