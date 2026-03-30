// ============================================================================
// MAINTENANCE SERVICE - Repository Layer
// ============================================================================
// Handles CRUD-style operations for the `maintenance_requests` table
// Supports multiple asset types: devices, resources, and rooms
// ============================================================================

import { supabaseAdmin } from '@/lib/supabase-admin'

import { BaseService } from './base-service'
import { devicesService } from './devices-service'

export type AssetType = 'device' | 'resource' | 'room'
export type AssetUsability = 'usable' | 'not_usable' | 'partially_usable'

export interface MaintenanceRequestRecord {
  id: string
  asset_type: AssetType
  asset_id: string // UUID or string ID depending on asset_type
  reported_by: string | null
  assigned_to: string | null
  issue_title: string
  issue_description: string | null
  issue_category: string | null
  priority: string | null // 'low' | 'medium' | 'high' (lowercase in DB)
  status: string | null // 'submitted' | 'in_progress' | 'completed' | 'resolved' (default: 'submitted')
  asset_usability: AssetUsability | null
  attachments: string | null // JSON array of attachment URLs/paths
  reported_at: string | null
  updated_at: string | null
  // Legacy columns (kept for backward compatibility during migration)
  device_id?: string | null
  room_id?: string | null
}

export interface MaintenanceRequestFilters {
  assetType?: AssetType | AssetType[]
  assetId?: string
  reportedBy?: string
  assignedTo?: string
  status?: string | string[]
  priority?: string | string[]
  issueCategory?: string | string[]
  fromDate?: string
  toDate?: string
  limit?: number
  offset?: number
}

export interface CreateMaintenanceRequestInput {
  asset_type: AssetType
  asset_id: string // UUID or string ID
  reported_by: string
  assigned_to?: string | null
  issue_title: string
  issue_description?: string | null
  issue_category?: string | null
  priority?: string // 'low' | 'medium' | 'high' (lowercase)
  status?: string // 'submitted' | 'in_progress' | 'completed' | 'resolved' (default: 'submitted')
  asset_usability?: AssetUsability
  attachments?: string[] | null // Array of attachment URLs/paths
}

export type UpdateMaintenanceRequestInput = Partial<{
  asset_type: AssetType
  asset_id: string
  assigned_to: string | null
  issue_title: string
  issue_description: string | null
  issue_category: string | null
  priority: string // 'low' | 'medium' | 'high'
  status: string // 'submitted' | 'in_progress' | 'completed' | 'resolved'
  asset_usability: AssetUsability
  attachments: string[] | null
}>

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class MaintenanceService extends BaseService {
  private readonly table = 'maintenance_requests'
  private readonly admin = supabaseAdmin

  private async resolveReporterIdentifier(identifier: string): Promise<{ employeeId: string; employeeUuid: string }> {
    const trimmed = identifier?.trim()
    if (!trimmed) {
      throw new Error('reported_by is required')
    }

    const isUuid = uuidRegex.test(trimmed)
    const column = isUuid ? 'id' : 'employee_id'
    
    // Try to find the employee using the appropriate column
    const { data, error } = await this.admin
      .from('employees')
      .select('id, employee_id')
      .eq(column, trimmed)
      .maybeSingle()

    if (error) {
      console.error('[MaintenanceService] Database error resolving reporter identifier:', {
        identifier: trimmed,
        column,
        error: error.message,
        code: error.code,
      })
      throw new Error(
        `Database error while looking up reporter with ${isUuid ? 'UUID' : 'employee_id'} '${trimmed}': ${error.message}. ` +
        `Please verify the employee exists in the database.`
      )
    }

    if (!data) {
      // Try the other column to see if maybe the identifier type was wrong
      const alternateColumn = isUuid ? 'employee_id' : 'id'
      const { data: altData } = await this.admin
        .from('employees')
        .select('id, employee_id')
        .eq(alternateColumn, trimmed)
        .maybeSingle()
      
      if (altData) {
        throw new Error(
          `Reporter not found with ${isUuid ? 'UUID' : 'employee_id'} '${trimmed}'. ` +
          `However, an employee exists with ${alternateColumn} '${trimmed}'. ` +
          `Please use the correct identifier type: ${isUuid ? 'employee_id instead of UUID' : 'UUID instead of employee_id'}.`
        )
      }
      
      throw new Error(
        `Reporter not found with identifier '${trimmed}'. ` +
        `Tried looking up by ${column}. ` +
        `Please verify the employee exists in the employees table. ` +
        `Valid identifiers are: employee UUID (from employees.id) or employee_id (from employees.employee_id).`
      )
    }

    if (!data.id) {
      throw new Error(
        `Employee found but missing UUID (id). ` +
        `Found employee_id: '${data.employee_id}', but id is null. ` +
        `This may indicate a data integrity issue.`
      )
    }

    if (!data.employee_id) {
      throw new Error(
        `Employee found but missing employee_id. ` +
        `Found UUID: '${data.id}', but employee_id is null. ` +
        `This may indicate a data integrity issue.`
      )
    }

    return {
      employeeUuid: data.id,
      employeeId: data.employee_id,
    }
  }

  /**
   * Validate that an asset exists based on asset_type and asset_id
   * @throws Error with detailed message if asset not found or validation fails
   */
  private async validateAsset(assetType: AssetType, assetId: string): Promise<void> {
    switch (assetType) {
      case 'device': {
        // Devices can be identified by device_id, asset_tag, serial_number, or UUID
        // Use getDeviceByIdentifier which handles all lookup strategies
        try {
          const device = await devicesService.getDeviceByIdentifier(assetId)
          if (device === null) {
            // Determine what type of identifier was provided for better error message
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            const isUuid = uuidRegex.test(assetId)
            
            const identifierType = isUuid 
              ? 'UUID' 
              : 'device_id, asset_tag, or serial_number'
            
            throw new Error(
              `Device not found with identifier '${assetId}'. ` +
              `The service tried looking up by: device_id, UUID (if applicable), asset_tag, and serial_number. ` +
              `None of these matched the provided ${identifierType}. ` +
              `To find available devices, use GET /api/devices to see the list of devices with their device_id, asset_tag, and serial_number values. ` +
              `Valid identifiers are: device_id, asset_tag, serial_number, or UUID (if the table has an id column). ` +
              `Note: If you're using a UUID, the devices table must have an 'id' column. Otherwise, use device_id, asset_tag, or serial_number.`
            )
          }
          // Device found successfully
          return
        } catch (error) {
          // Re-throw our custom "Device not found" errors
          if (error instanceof Error && error.message.includes('Device not found')) {
            throw error
          }
          // Wrap unexpected errors (database errors, etc.)
          throw new Error(
            `Error validating device '${assetId}': ${error instanceof Error ? error.message : String(error)}. ` +
            `Please verify the device exists and try again.`
          )
        }
      }
      case 'resource': {
        // Resources use resource_id (string, not UUID)
        const { data, error } = await this.admin
          .from('resources')
          .select('resource_id')
          .eq('resource_id', assetId)
          .maybeSingle()
        
        if (error) {
          throw new Error(`Database error validating resource: ${error.message}`)
        }
        
        if (data === null) {
          throw new Error(
            `Resource with resource_id '${assetId}' not found. ` +
            `Resources must use resource_id (string identifier), not UUID. ` +
            `Please verify the resource exists in the database.`
          )
        }
        
        return
      }
      case 'room': {
        // Rooms use UUID
        if (!uuidRegex.test(assetId)) {
          throw new Error(
            `Invalid room ID format '${assetId}'. ` +
            `Rooms must use UUID format (e.g., '550e8400-e29b-41d4-a716-446655440000'). ` +
            `Received: '${assetId}'`
          )
        }
        
        const { data, error } = await this.admin
          .from('rooms')
          .select('id')
          .eq('id', assetId)
          .maybeSingle()
        
        if (error) {
          throw new Error(`Database error validating room: ${error.message}`)
        }
        
        if (data === null) {
          throw new Error(
            `Room with id '${assetId}' not found. ` +
            `Please verify the room UUID exists in the database.`
          )
        }
        
        return
      }
      default:
        throw new Error(`Invalid asset_type: ${assetType}. Must be 'device', 'resource', or 'room'`)
    }
  }

  /**
   * Update asset status based on maintenance request
   * Only updates device status (resources and rooms don't have status fields)
   */
  private async updateAssetStatus(
    assetType: AssetType,
    assetId: string,
    status: string,
    assetUsability?: AssetUsability | null
  ): Promise<void> {
    try {
      if (assetType === 'device') {
        const statusLower = (status ?? '').toLowerCase()
        if (statusLower === 'completed' || statusLower === 'resolved') {
          // Mark device as available when maintenance is completed
          await devicesService.markDeviceAsAvailable(assetId)
        } else if (statusLower === 'in_progress' || statusLower === 'submitted') {
          // Ensure device is marked as in maintenance
          await devicesService.updateDevice(assetId, {
            status: 'in_maintenance',
          })
        }

        // If asset_usability is 'not_usable', mark device as unavailable
        if (assetUsability === 'not_usable') {
          await devicesService.updateDevice(assetId, {
            status: 'in_maintenance',
          })
        }
      }
      // Resources and rooms don't have status fields that need updating
    } catch (error) {
      console.warn(`[MaintenanceService] Failed to update ${assetType} status:`, error)
      // Don't throw - allow maintenance request to be created even if status update fails
    }
  }

  async listMaintenanceRequests(filters: MaintenanceRequestFilters = {}): Promise<{ data: MaintenanceRequestRecord[]; count: number }> {
    try {
      let query = this.admin.from(this.table).select('*', { count: 'exact' })

      if (filters.assetType) {
        if (Array.isArray(filters.assetType)) {
          query = query.in('asset_type', filters.assetType)
        } else {
          query = query.eq('asset_type', filters.assetType)
        }
      }

      if (filters.assetId) {
        query = query.eq('asset_id', filters.assetId)
      }

      if (filters.reportedBy) {
        const { employeeUuid } = await this.resolveReporterIdentifier(filters.reportedBy)
        query = query.eq('reported_by', employeeUuid)
      }

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status)
        } else {
          query = query.eq('status', filters.status)
        }
      }

      if (filters.priority) {
        if (Array.isArray(filters.priority)) {
          query = query.in('priority', filters.priority)
        } else {
          query = query.eq('priority', filters.priority)
        }
      }

      if (filters.issueCategory) {
        if (Array.isArray(filters.issueCategory)) {
          query = query.in('issue_category', filters.issueCategory)
        } else {
          query = query.eq('issue_category', filters.issueCategory)
        }
      }

      if (filters.assignedTo) {
        const { employeeUuid } = await this.resolveReporterIdentifier(filters.assignedTo)
        query = query.eq('assigned_to', employeeUuid)
      }

      if (filters.fromDate) {
        query = query.gte('reported_at', filters.fromDate)
      }

      if (filters.toDate) {
        query = query.lte('reported_at', filters.toDate)
      }

      if (typeof filters.limit === 'number' && typeof filters.offset === 'number') {
        query = query.range(filters.offset, filters.offset + filters.limit - 1)
      } else if (typeof filters.limit === 'number') {
        query = query.limit(filters.limit)
      }

      const { data, error, count } = await query.order('reported_at', { ascending: false })
      if (error) {
        this.handleError(error, 'list maintenance requests')
      }

      return {
        data: (data as MaintenanceRequestRecord[]) ?? [],
        count: count ?? 0,
      }
    } catch (error) {
      this.handleError(error, 'list maintenance requests')
    }
  }

  async getMaintenanceRequestById(requestId: string): Promise<MaintenanceRequestRecord | null> {
    return this.executeQuery<MaintenanceRequestRecord | null>(
      async () => {
        const { data, error } = await this.admin.from(this.table).select('*').eq('id', requestId).maybeSingle()
        return { data: data as MaintenanceRequestRecord | null, error }
      },
      'get maintenance request by id',
    )
  }

  async createMaintenanceRequest(payload: CreateMaintenanceRequestInput): Promise<MaintenanceRequestRecord> {
    this.validateRequired(payload, ['asset_type', 'asset_id', 'reported_by', 'issue_title'])

    // Validate asset_type
    if (!['device', 'resource', 'room'].includes(payload.asset_type)) {
      throw new Error(`Invalid asset_type: ${payload.asset_type}. Must be 'device', 'resource', or 'room'`)
    }

    // Validate that the asset exists (throws detailed error if not found)
    await this.validateAsset(payload.asset_type, payload.asset_id)

    const { employeeUuid } = await this.resolveReporterIdentifier(payload.reported_by)

    // Resolve assigned_to if provided
    let assignedToUuid: string | null = null
    if (payload.assigned_to) {
      try {
        const assigned = await this.resolveReporterIdentifier(payload.assigned_to)
        assignedToUuid = assigned.employeeUuid
      } catch (error) {
        console.warn('[MaintenanceService] Failed to resolve assigned_to, continuing without assignment:', error)
        // Continue without assignment if resolution fails
      }
    }

    // Serialize attachments array to JSON string
    let attachmentsJson: string | null = null
    if (payload.attachments && Array.isArray(payload.attachments) && payload.attachments.length > 0) {
      try {
        attachmentsJson = JSON.stringify(payload.attachments)
      } catch (error) {
        console.warn('[MaintenanceService] Failed to serialize attachments:', error)
      }
    }

    // Build insert payload
    const insertPayload: any = {
      asset_type: payload.asset_type,
      asset_id: payload.asset_id,
      reported_by: employeeUuid,
      assigned_to: assignedToUuid,
      issue_title: payload.issue_title,
      issue_description: payload.issue_description ?? null,
      issue_category: payload.issue_category ?? null,
      priority: (payload.priority ?? 'medium').toLowerCase(),
      status: (payload.status ?? 'submitted').toLowerCase(),
      asset_usability: payload.asset_usability ?? null,
      attachments: attachmentsJson,
      reported_at: new Date().toISOString(),
    }

    const sanitized = this.sanitizeInput(insertPayload)

    const request = await this.executeInsert<MaintenanceRequestRecord>(
      async () => {
        const { data, error } = await this.admin.from(this.table).insert(sanitized).select('*').single()
        
        // Provide helpful error message if columns are missing
        if (error) {
          const errorMessage = error.message || String(error)
          if (errorMessage.includes('column') && (errorMessage.includes('does not exist') || errorMessage.includes('schema cache'))) {
            throw new Error(
              `Database schema is missing required columns. Please run the migration script: ` +
              `database/migrations/add-maintenance-request-columns.sql. ` +
              `Error: ${errorMessage}`
            )
          }
        }
        
        return { data: data as MaintenanceRequestRecord, error }
      },
      'create maintenance request',
    )

    // Update asset status based on maintenance request
    await this.updateAssetStatus(
      payload.asset_type,
      payload.asset_id,
      request.status ?? 'submitted',
      payload.asset_usability
    )

    return request
  }

  async updateMaintenanceRequest(requestId: string, updates: UpdateMaintenanceRequestInput): Promise<MaintenanceRequestRecord | null> {
    // Get the current request to check asset info
    const currentRequest = await this.getMaintenanceRequestById(requestId)
    if (!currentRequest) {
      throw new Error('Maintenance request not found')
    }

    // If asset_type or asset_id is being updated, validate the new asset
    if (updates.asset_type || updates.asset_id) {
      const assetType = updates.asset_type ?? currentRequest.asset_type
      const assetId = updates.asset_id ?? currentRequest.asset_id

      if (!['device', 'resource', 'room'].includes(assetType)) {
        throw new Error(`Invalid asset_type: ${assetType}. Must be 'device', 'resource', or 'room'`)
      }

      // Validate that the asset exists (throws detailed error if not found)
      await this.validateAsset(assetType, assetId)
    }

    // Handle attachments serialization
    const updatePayload: any = { ...updates }
    if (updates.attachments !== undefined) {
      if (updates.attachments === null || (Array.isArray(updates.attachments) && updates.attachments.length === 0)) {
        updatePayload.attachments = null
      } else if (Array.isArray(updates.attachments)) {
        try {
          updatePayload.attachments = JSON.stringify(updates.attachments)
        } catch (error) {
          console.warn('[MaintenanceService] Failed to serialize attachments:', error)
          delete updatePayload.attachments // Don't update if serialization fails
        }
      }
    }

    const sanitized = this.sanitizeInput(updatePayload)

    const request = await this.executeUpdate<MaintenanceRequestRecord | null>(
      async () => {
        const { data, error } = await this.admin
          .from(this.table)
          .update(sanitized)
          .eq('id', requestId)
          .select('*')
          .maybeSingle()
        return { data: data as MaintenanceRequestRecord | null, error }
      },
      'update maintenance request',
    )

    // Update asset status based on maintenance request status
    if (request && (updates.status || updates.asset_usability !== undefined)) {
      const assetType = request.asset_type
      const assetId = request.asset_id
      const status = updates.status ?? request.status ?? 'submitted'
      const assetUsability = updates.asset_usability ?? request.asset_usability ?? null

      await this.updateAssetStatus(assetType, assetId, status, assetUsability)
    }

    return request
  }

  async deleteMaintenanceRequest(requestId: string, options: { hardDelete?: boolean } = {}): Promise<boolean> {
    // Get the request to update asset status
    const request = await this.getMaintenanceRequestById(requestId)
    
    if (options.hardDelete || true) { // Always hard delete
      const result = await this.executeDelete(
        async () => {
          const { error } = await this.admin.from(this.table).delete().eq('id', requestId)
          return { error }
        },
        'hard delete maintenance request',
      )
      
      // Update asset status after deletion
      if (result && request) {
        try {
          // Only mark as available if the request was not completed
          // (if it was completed, the asset should already be available)
          const statusLower = (request.status ?? '').toLowerCase()
          if (statusLower !== 'completed' && statusLower !== 'resolved') {
            // Restore asset to available state
            if (request.asset_type === 'device') {
              await devicesService.markDeviceAsAvailable(request.asset_id)
            }
            // Resources and rooms don't need status restoration
          }
        } catch (assetError) {
          console.error('[MaintenanceService] Failed to update asset status after maintenance request deletion:', assetError)
        }
      }
      
      return result
    }

    // Soft delete (if needed in future)
    const updateResult = await this.updateMaintenanceRequest(requestId, {
      status: 'completed',
    })
    return Boolean(updateResult)
  }

  /**
   * Get maintenance requests by asset (replaces getMaintenanceRequestsByDevice)
   */
  async getMaintenanceRequestsByAsset(assetType: AssetType, assetId: string): Promise<MaintenanceRequestRecord[]> {
    return this.executeQueryArray<MaintenanceRequestRecord>(
      async () => {
        const { data, error } = await this.admin
          .from(this.table)
          .select('*')
          .eq('asset_type', assetType)
          .eq('asset_id', assetId)
          .order('reported_at', { ascending: false })
        return { data: data as MaintenanceRequestRecord[] | null, error }
      },
      'get maintenance requests by asset',
    )
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use getMaintenanceRequestsByAsset('device', deviceId) instead
   */
  async getMaintenanceRequestsByDevice(deviceId: string): Promise<MaintenanceRequestRecord[]> {
    return this.getMaintenanceRequestsByAsset('device', deviceId)
  }

  async getMaintenanceRequestsByReporter(identifier: string): Promise<MaintenanceRequestRecord[]> {
    try {
      const { employeeUuid } = await this.resolveReporterIdentifier(identifier)

      return this.executeQueryArray<MaintenanceRequestRecord>(
        async () => {
          const { data, error } = await this.admin
            .from(this.table)
            .select('*')
            .eq('reported_by', employeeUuid)
            .order('reported_at', { ascending: false })
          return { data: data as MaintenanceRequestRecord[] | null, error }
        },
        'get maintenance requests by reporter',
      )
    } catch (error) {
      // If reporter not found or any other error, return empty array
      if (error instanceof Error && error.message.includes('Reporter not found')) {
        console.warn('[MaintenanceService] Reporter not found:', identifier)
        return []
      }
      
      console.error('[MaintenanceService] Error in getMaintenanceRequestsByReporter:', error)
      return [] // Return empty array instead of throwing
    }
  }

  async getActiveMaintenanceRequests(): Promise<MaintenanceRequestRecord[]> {
    return this.executeQueryArray<MaintenanceRequestRecord>(
      async () => {
        const { data, error } = await this.admin
          .from(this.table)
          .select('*')
          .neq('status', 'completed')
          .neq('status', 'resolved')
          .order('reported_at', { ascending: false })
        return { data: data as MaintenanceRequestRecord[] | null, error }
      },
      'get active maintenance requests',
    )
  }

  async completeMaintenanceRequest(requestId: string): Promise<MaintenanceRequestRecord | null> {
    const request = await this.getMaintenanceRequestById(requestId)
    if (!request) {
      throw new Error('Maintenance request not found')
    }

    return this.updateMaintenanceRequest(requestId, {
      status: 'completed',
    })
  }
}

export const maintenanceService = new MaintenanceService()
