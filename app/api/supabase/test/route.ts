// ============================================================================
// SUPABASE INTEGRATION TEST API ROUTE
// ============================================================================
// This route tests the Supabase integration and provides status information
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { initializeSupabaseIntegration } from '@/lib/supabase-init'

// ============================================================================
// GET /api/supabase/test - Test Supabase integration
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Supabase integration...')
    
    // Run the initialization test
    const success = await initializeSupabaseIntegration()
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Supabase integration test passed',
        timestamp: new Date().toISOString(),
        status: {
          database: 'connected',
          storage: 'connected',
          schema: 'valid',
          seedData: 'valid',
          buckets: 'configured'
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'Supabase integration test failed',
        timestamp: new Date().toISOString(),
        status: {
          database: 'error',
          storage: 'error',
          schema: 'error',
          seedData: 'error',
          buckets: 'error'
        }
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Supabase integration test error:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Supabase integration test failed with error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// ============================================================================
// POST /api/supabase/test - Run specific tests
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { testType } = body

    const { supabase } = await import('@/lib/supabase')
    
    switch (testType) {
      case 'database':
        const { data: dbTest, error: dbError } = await supabase
          .from('roles')
          .select('count')
          .limit(1)
        
        return NextResponse.json({
          success: !dbError,
          testType: 'database',
          result: dbError ? dbError.message : 'Database connection successful',
          timestamp: new Date().toISOString()
        })

      case 'storage':
        const { data: storageTest, error: storageError } = await supabase.storage
          .from('employee-documents')
          .list('', { limit: 1 })
        
        return NextResponse.json({
          success: !storageError,
          testType: 'storage',
          result: storageError ? storageError.message : 'Storage connection successful',
          timestamp: new Date().toISOString()
        })

      case 'auth':
        const { data: authTest, error: authError } = await supabase.auth.getSession()
        
        return NextResponse.json({
          success: !authError,
          testType: 'auth',
          result: authError ? authError.message : 'Auth service accessible',
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid test type',
          validTestTypes: ['database', 'storage', 'auth'],
          timestamp: new Date().toISOString()
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Supabase test error:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Test failed with error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
