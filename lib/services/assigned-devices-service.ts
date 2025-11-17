// ============================================================================
// ASSIGNED DEVICES SERVICE - Repository Layer
// ============================================================================
// Provides CRUD operations for the `assigned_devices` table, including
// filtering helpers and soft-delete support. Acts as the single integration
// point between the application and the assigned devices schema.
// ============================================================================

import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BaseService } from './base-service'

export type AssignmentStatus =
  | 'pending'
  | 'approved'
  | 'active'
  | 'borrowed'
  | 'awaiting_return'
  | 'returned'
  | 'overdue'
  | 'cancelled'
  | 'rejected'

export type AssignmentType = 'permanent' | 'temporary' | 'loan' | 'repair' | 'other'

export type DeviceCondition =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor'
  | 'damaged'
  | 'unusable'
  
export interface AssignedDevice {
  id: string
  device_id: string
  employee_id: string
  assigned_by?: string | null
  approved_by?: string | null
  assignment_type: AssignmentType
  status: AssignmentStatus
  assigned_date: string | null
  expected_return_date?: string | null
  actual_return_date?: string | null
  assigned_condition?: DeviceCondition | null
  returned_condition?: DeviceCondition | null
  purpose?: string | null
  assignment_notes?: string | null
  return_notes?: string | null
  approval_required: boolean
  approval_requested_at?: string | null
  approval_status?: AssignmentStatus | null
  approved_at?: string | null
  rejection_reason?: string | null
  return_requested_at?: string | null
  return_verified_by?: string | null
  return_verified_at?: string | null
  has_issues: boolean
  issue_description?: string | null
  reported_at?: string | null
  deleted_at?: string | null
  created_at: string
  updated_at: string
}

export interface AssignmentFilters {
  employeeId?: string
  deviceId?: string
  status?: AssignmentStatus | AssignmentStatus[]
  assignmentType?: AssignmentType
  fromDate?: string
  toDate?: string
  includeDeleted?: boolean
  limit?: number
  offset?: number
}

export interface CreateAssignmentInput {
  device_id: string
  employee_id: string
  assigned_by?: string
  assignment_type?: AssignmentType
  status?: AssignmentStatus
  expected_return_date?: string
  assigned_condition?: DeviceCondition
  purpose?: string
  assignment_notes?: string
  approval_required?: boolean
}

export type UpdateAssignmentInput = Partial<Omit<CreateAssignmentInput, 'device_id' | 'employee_id'>> & {
  assigned_condition?: DeviceCondition | null
  returned_condition?: DeviceCondition | null
  actual_return_date?: string | null
  return_notes?: string | null
  approval_status?: AssignmentStatus | null
  approved_by?: string | null
  approved_at?: string | null
  rejection_reason?: string | null
  return_requested_at?: string | null
  return_verified_by?: string | null
  return_verified_at?: string | null
  has_issues?: boolean
  issue_description?: string | null
  reported_at?: string | null
}

export class AssignedDevicesService extends BaseService {
  private readonly table = 'assigned_devices'
  private readonly admin = supabaseAdmin

  // ============================================================================
  // READ OPERATIONS
  // ============================================================================

  /**
   * List assignments with optional filtering.
   */
  async listAssignments(filters: AssignmentFilters = {}): Promise<AssignedDevice[]> {
    try {
      let query = supabase.from(this.table).select('*')

      if (filters.employeeId) {
        query = query.eq('employee_id', filters.employeeId)
      }

      if (filters.deviceId) {
        query = query.eq('device_id', filters.deviceId)
      }

      if (filters.assignmentType) {
        query = query.eq('assignment_type', filters.assignmentType)
      }

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status)
        } else {
          query = query.eq('status', filters.status)
        }
      }

      if (filters.fromDate) {
        query = query.gte('assigned_date', filters.fromDate)
      }

      if (filters.toDate) {
        query = query.lte('assigned_date', filters.toDate)
      }

      if (!filters.includeDeleted) {
        query = query.is('deleted_at', null)
      }

      if (typeof filters.limit === 'number' && typeof filters.offset === 'number') {
        query = query.range(filters.offset, filters.offset + filters.limit - 1)
      } else if (typeof filters.limit === 'number') {
        query = query.limit(filters.limit)
      }

      query = query.order('assigned_date', { ascending: false })

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as AssignedDevice[]
    } catch (error) {
      this.handleError(error, 'list assignments')
      return []
    }
  }

  /**
   * Fetch a single assignment by ID.
   */
  async getAssignmentById(id: string): Promise<AssignedDevice | null> {
    try {
      const { data, error } = await supabase.from(this.table).select('*').eq('id', id).single()
      if (error) throw error
      return data as AssignedDevice
    } catch (error) {
      this.handleError(error, 'get assignment by id')
      return null
    }
  }

  /**
   * Fetch active assignments for an employee.
   */
  async listActiveAssignmentsForEmployee(employeeId: string): Promise<AssignedDevice[]> {
    return this.listAssignments({ employeeId, status: ['approved', 'active'], includeDeleted: false })
  }

  // ============================================================================
  // CREATE
  // ============================================================================

  async createAssignment(payload: CreateAssignmentInput): Promise<AssignedDevice> {
    try {
      const insertData = {
        assignment_type: payload.assignment_type ?? 'temporary',
        status: payload.status ?? (payload.approval_required === false ? 'approved' : 'pending'),
        approval_required: payload.approval_required ?? true,
        approval_requested_at: (payload.approval_required ?? true) ? new Date().toISOString() : null,
        assigned_date: (payload.approval_required ?? true) ? null : new Date().toISOString(),
        ...payload,
      }

      const { data, error } = await this.admin
        .from(this.table)
        .insert(insertData)
        .select('*')
        .single()

      if (error) throw error
      return data as AssignedDevice
    } catch (error) {
      this.handleError(error, 'create assignment')
      return null as never
    }
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  async updateAssignment(id: string, updates: UpdateAssignmentInput): Promise<AssignedDevice> {
    try {
      const { data, error } = await this.admin
        .from(this.table)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()

      if (error) throw error
      return data as AssignedDevice
    } catch (error) {
      this.handleError(error, 'update assignment')
      return null as never
    }
  }

  // ============================================================================
  // DELETE OPERATIONS
  // ============================================================================

  /**
   * Soft delete (default) or hard delete an assignment.
   */
  async deleteAssignment(id: string, options: { hardDelete?: boolean } = {}): Promise<void> {
    const { hardDelete = false } = options

    try {
      if (hardDelete) {
        const { error } = await this.admin.from(this.table).delete().eq('id', id)
        if (error) throw error
        return
      }

      const { error } = await this.admin
        .from(this.table)
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      this.handleError(error, 'delete assignment')
    }
  }

  /**
   * Restore a soft deleted assignment.
   */
  async restoreAssignment(id: string): Promise<AssignedDevice> {
    try {
      const { data, error } = await this.admin
        .from(this.table)
        .update({ deleted_at: null, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()

      if (error) throw error
      return data as AssignedDevice
    } catch (error) {
      this.handleError(error, 'restore assignment')
      return null as never
    }
  }
}

export const assignedDevicesService = new AssignedDevicesService()

