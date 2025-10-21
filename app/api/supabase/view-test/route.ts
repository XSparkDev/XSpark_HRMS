// ============================================================================
// VIEW COLUMNS TEST API ROUTE
// ============================================================================
// This route tests what columns are available in the active_employees view
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// ============================================================================
// GET /api/supabase/view-test - Test view columns
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing active_employees view columns...')
    
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: {}
    }

    // Test 1: Query active_employees view without any filters
    try {
      const { data: activeEmployees, error: activeEmployeesError } = await supabase
        .from('active_employees')
        .select('*')
        .limit(1)

      results.tests.activeEmployeesNoFilters = {
        success: !activeEmployeesError,
        error: activeEmployeesError?.message,
        hasData: activeEmployees && activeEmployees.length > 0,
        count: activeEmployees?.length || 0,
        data: activeEmployees || []
      }
    } catch (error) {
      results.tests.activeEmployeesNoFilters = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 2: Query active_employees view with is_active filter
    try {
      const { data: activeEmployees, error: activeEmployeesError } = await supabase
        .from('active_employees')
        .select('*')
        .eq('is_active', true)
        .limit(1)

      results.tests.activeEmployeesWithFilter = {
        success: !activeEmployeesError,
        error: activeEmployeesError?.message,
        hasData: activeEmployees && activeEmployees.length > 0,
        count: activeEmployees?.length || 0,
        data: activeEmployees || []
      }
    } catch (error) {
      results.tests.activeEmployeesWithFilter = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 3: Query employees table directly
    try {
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .eq('is_active', true)
        .limit(1)

      results.tests.employeesTableWithFilter = {
        success: !employeesError,
        error: employeesError?.message,
        hasData: employees && employees.length > 0,
        count: employees?.length || 0,
        data: employees || []
      }
    } catch (error) {
      results.tests.employeesTableWithFilter = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 4: Try to get column names by selecting specific columns
    try {
      const { data: activeEmployees, error: activeEmployeesError } = await supabase
        .from('active_employees')
        .select('id, first_name, last_name, email, is_active')
        .limit(1)

      results.tests.activeEmployeesSpecificColumns = {
        success: !activeEmployeesError,
        error: activeEmployeesError?.message,
        hasData: activeEmployees && activeEmployees.length > 0,
        count: activeEmployees?.length || 0,
        data: activeEmployees || []
      }
    } catch (error) {
      results.tests.activeEmployeesSpecificColumns = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Calculate overall success
    const testResults = Object.values(results.tests)
    const successCount = testResults.filter((test: any) => test.success).length
    const totalTests = testResults.length

    results.success = successCount === totalTests
    results.summary = {
      totalTests,
      passedTests: successCount,
      failedTests: totalTests - successCount,
      successRate: `${Math.round((successCount / totalTests) * 100)}%`
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('View columns test error:', error)
    
    return NextResponse.json({
      success: false,
      message: 'View columns test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
