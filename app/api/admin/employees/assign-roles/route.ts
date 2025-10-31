// ============================================================================
// ADMIN: ASSIGN DEFAULT ROLES TO EMPLOYEES
// ============================================================================
// Retroactively assigns "employee" role_id to employees without a role_id
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { employeeService } from '@/lib/services'

export async function POST(request: NextRequest) {
  try {
    const result = await employeeService.assignDefaultRoleToEmployeesWithoutRole()

    return NextResponse.json({
      success: true,
      message: `Assigned default role to ${result.updated} employees`,
      data: result
    })
  } catch (error) {
    console.error('Error assigning default roles:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign default roles'
    }, { status: 500 })
  }
}

