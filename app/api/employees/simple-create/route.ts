// ============================================================================
// SIMPLE EMPLOYEE CREATION TEST
// ============================================================================
// Test employee creation with proper ID number
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const testEmployeeData = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@xspark.com',
      dob: '1990-01-01',
      sex: 'male',
      date_hired: '2025-01-01',
      nationality: 'South Africa',
      employment_status: 'probation',
      id_number: '1234567890123'
    }

    const { data, error } = await supabase
      .from('employees')
      .insert([testEmployeeData])
      .select()
      .single()

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        details: error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: data,
      message: 'Employee created successfully'
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
