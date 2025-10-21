// ============================================================================
// EMPLOYEE SERVICE TEST API ROUTE
// ============================================================================
// This route tests the employee service directly to debug issues
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { employeeService } from '@/lib/services'
import { supabase } from '@/lib/supabase'

// ============================================================================
// GET /api/employees/test - Test employee service directly
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing employee service directly...')
    
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: {}
    }

    // Test 1: Direct query to active_employees view
    try {
      const { data: activeEmployees, error: activeEmployeesError } = await supabase
        .from('active_employees')
        .select('*')
        .limit(5)

      results.tests.directActiveEmployeesQuery = {
        success: !activeEmployeesError,
        error: activeEmployeesError?.message,
        hasData: activeEmployees && activeEmployees.length > 0,
        count: activeEmployees?.length || 0,
        data: activeEmployees || []
      }
    } catch (error) {
      results.tests.directActiveEmployeesQuery = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 2: Direct query to employees table
    try {
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .limit(5)

      results.tests.directEmployeesQuery = {
        success: !employeesError,
        error: employeesError?.message,
        hasData: employees && employees.length > 0,
        count: employees?.length || 0,
        data: employees || []
      }
    } catch (error) {
      results.tests.directEmployeesQuery = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 3: Employee service getAllActive method
    try {
      const employees = await employeeService.getAllActive()
      results.tests.employeeServiceGetAllActive = {
        success: true,
        hasData: employees && employees.length > 0,
        count: employees?.length || 0,
        data: employees || []
      }
    } catch (error) {
      results.tests.employeeServiceGetAllActive = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 4: Employee service getById method (with a non-existent ID)
    try {
      const employee = await employeeService.getById('non-existent-id')
      results.tests.employeeServiceGetById = {
        success: true,
        found: employee !== null,
        data: employee
      }
    } catch (error) {
      results.tests.employeeServiceGetById = {
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
    console.error('Employee service test error:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Employee service test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
