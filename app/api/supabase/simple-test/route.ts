// ============================================================================
// SIMPLE DATABASE TEST API ROUTE
// ============================================================================
// This route tests basic database functionality by trying to query key tables
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// ============================================================================
// GET /api/supabase/simple-test - Test basic database functionality
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Running simple database tests...')
    
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: {}
    }

    // Test 1: Check if roles table exists and is accessible
    try {
      const { data: roles, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .limit(1)

      results.tests.roles = {
        success: !rolesError,
        error: rolesError?.message,
        hasData: roles && roles.length > 0,
        count: roles?.length || 0
      }
    } catch (error) {
      results.tests.roles = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 2: Check if employees table exists
    try {
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('id')
        .limit(1)

      results.tests.employees = {
        success: !employeesError,
        error: employeesError?.message,
        hasData: employees && employees.length > 0,
        count: employees?.length || 0
      }
    } catch (error) {
      results.tests.employees = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 3: Check if job_titles table exists
    try {
      const { data: jobTitles, error: jobTitlesError } = await supabase
        .from('job_titles')
        .select('id')
        .limit(1)

      results.tests.jobTitles = {
        success: !jobTitlesError,
        error: jobTitlesError?.message,
        hasData: jobTitles && jobTitles.length > 0,
        count: jobTitles?.length || 0
      }
    } catch (error) {
      results.tests.jobTitles = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 4: Check if leave_balances table exists
    try {
      const { data: leaveBalances, error: leaveBalancesError } = await supabase
        .from('leave_balances')
        .select('id')
        .limit(1)

      results.tests.leaveBalances = {
        success: !leaveBalancesError,
        error: leaveBalancesError?.message,
        hasData: leaveBalances && leaveBalances.length > 0,
        count: leaveBalances?.length || 0
      }
    } catch (error) {
      results.tests.leaveBalances = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 5: Check if active_employees view exists
    try {
      const { data: activeEmployees, error: activeEmployeesError } = await supabase
        .from('active_employees')
        .select('id')
        .limit(1)

      results.tests.activeEmployeesView = {
        success: !activeEmployeesError,
        error: activeEmployeesError?.message,
        hasData: activeEmployees && activeEmployees.length > 0,
        count: activeEmployees?.length || 0
      }
    } catch (error) {
      results.tests.activeEmployeesView = {
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
    console.error('Simple database test error:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Simple database test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
