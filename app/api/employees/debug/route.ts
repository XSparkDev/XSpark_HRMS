// ============================================================================
// EMPLOYEE CREATION DEBUG API ROUTE
// ============================================================================
// This route helps debug employee creation issues
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { employeeService } from '@/lib/services'
import { supabase } from '@/lib/supabase'

// ============================================================================
// POST /api/employees/debug - Debug employee creation
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    console.log('🐛 Debugging employee creation...')
    
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: {}
    }

    // Test 1: Check if we can insert directly into employees table
    try {
      const testEmployeeData = {
        first_name: 'Debug',
        last_name: 'Test',
        email: 'debug.test@xspark.com',
        dob: '1990-01-01',
        sex: 'male',
        date_hired: '2025-01-01',
        nationality: 'South Africa',
        employment_status: 'probation'
      }

      const { data: directInsert, error: directInsertError } = await supabase
        .from('employees')
        .insert([testEmployeeData])
        .select()
        .single()

      results.tests.directInsert = {
        success: !directInsertError,
        error: directInsertError?.message,
        data: directInsert
      }

      // Clean up the test data
      if (directInsert && !directInsertError) {
        await supabase
          .from('employees')
          .delete()
          .eq('id', directInsert.id)
      }
    } catch (error) {
      results.tests.directInsert = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 2: Check required fields
    try {
      const minimalData = {
        first_name: 'Minimal',
        last_name: 'Test',
        email: 'minimal.test@xspark.com',
        dob: '1990-01-01',
        sex: 'male',
        date_hired: '2025-01-01'
      }

      const { data: minimalInsert, error: minimalError } = await supabase
        .from('employees')
        .insert([minimalData])
        .select()
        .single()

      results.tests.minimalInsert = {
        success: !minimalError,
        error: minimalError?.message,
        data: minimalInsert
      }

      // Clean up
      if (minimalInsert && !minimalError) {
        await supabase
          .from('employees')
          .delete()
          .eq('id', minimalInsert.id)
      }
    } catch (error) {
      results.tests.minimalInsert = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 3: Check what columns exist in employees table
    try {
      const { data: columns, error: columnsError } = await supabase
        .from('employees')
        .select('*')
        .limit(0)

      results.tests.tableStructure = {
        success: !columnsError,
        error: columnsError?.message,
        note: 'This will show what columns are available'
      }
    } catch (error) {
      results.tests.tableStructure = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 4: Try employee service create method
    try {
      const serviceData = {
        first_name: 'Service',
        last_name: 'Test',
        email: 'service.test@xspark.com',
        dob: '1990-01-01',
        sex: 'male',
        date_hired: '2025-01-01',
        nationality: 'South Africa'
      }

      const serviceResult = await employeeService.create(serviceData)
      
      results.tests.serviceCreate = {
        success: true,
        data: serviceResult
      }

      // Clean up
      if (serviceResult) {
        await supabase
          .from('employees')
          .delete()
          .eq('id', serviceResult.id)
      }
    } catch (error) {
      results.tests.serviceCreate = {
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
    console.error('Employee creation debug error:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Employee creation debug failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
