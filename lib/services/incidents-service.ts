// ============================================================================
// INCIDENTS SERVICE - Repository Layer
// ============================================================================
// CRUD utilities for the `incidents` table. Provides helpers to validate
// enumerations, ensure employee/device references exist, and normalize records.
// ============================================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import { BaseService } from './base-service'
import { devicesService } from './devices-service'

const INCIDENT_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'] as const
const INCIDENT_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'] as const
const INCIDENT_TYPES = ['Damage', 'Malfunction', 'Lost', 'Other'] as const

type IncidentStatus = (typeof INCIDENT_STATUSES)[number]
type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number]
type IncidentType = (typeof INCIDENT_TYPES)[number]

export interface IncidentRecord {
  incident_id: string
  device_id: string
  reported_by: string
  incident_type: IncidentType
  description: string
  severity: IncidentSeverity | null
  status: IncidentStatus
  resolved_by: string | null
  resolved_at: string | null
  resolution_notes: string | null
  created_at: string
  updated_at: string
}

export interface IncidentFilters {
  deviceId?: string
  reportedBy?: string
  resolvedBy?: string
  status?: IncidentStatus
  severity?: IncidentSeverity
  incidentType?: IncidentType
  search?: string
  fromDate?: string
  toDate?: string
  limit?: number
  offset?: number
}

export interface CreateIncidentInput {
  device_id: string
  reported_by: string
  incident_type: IncidentType
  description: string
  severity?: IncidentSeverity | null
  status?: IncidentStatus
  resolution_notes?: string | null
  resolved_by?: string | null
  resolved_at?: string | null
}

export type UpdateIncidentInput = Partial<CreateIncidentInput> & {
  status?: IncidentStatus
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class IncidentsService extends BaseService {
  private readonly table = 'incidents'
  private readonly admin = supabaseAdmin

  private normalize(record: any): IncidentRecord {
    return {
      incident_id: record.incident_id,
      device_id: record.device_id,
      reported_by: record.reported_by,
      incident_type: record.incident_type,
      description: record.description,
      severity: record.severity ?? null,
      status: record.status,
      resolved_by: record.resolved_by ?? null,
      resolved_at: record.resolved_at ?? null,
      resolution_notes: record.resolution_notes ?? null,
      created_at: record.created_at,
      updated_at: record.updated_at,
    }
  }

  private ensureEnumValue<T extends string>(value: T | undefined | null, allowed: readonly T[], field: string): T | null {
    if (value == null) {
      return null
    }
    if (!allowed.includes(value)) {
      throw new Error(`${field} must be one of: ${allowed.join(', ')}`)
    }
    return value
  }

  private async resolveEmployeeIdentifier(identifier: string | null | undefined, field: string): Promise<string | null> {
    if (!identifier) return null
    const trimmed = identifier.trim()
    if (!trimmed) return null
    const column = uuidRegex.test(trimmed) ? 'id' : 'employee_id'
    const { data, error } = await this.admin.from('employees').select('id').eq(column, trimmed).maybeSingle()
    if (error) {
      this.handleError(error, `resolve employee ${field}`)
    }
    if (!data?.id) {
      throw new Error(`Employee for ${field} not found`)
    }
    return data.id
  }

  private async assertDeviceExists(deviceId: string): Promise<string> {
    const trimmed = deviceId?.trim()
    if (!trimmed) {
      throw new Error('device_id is required')
    }

    const device = await devicesService.getDeviceById(trimmed)
    if (!device?.device_id) {
      throw new Error('Device not found')
    }
    return device.device_id
  }

  async listIncidents(filters: IncidentFilters = {}): Promise<{ data: IncidentRecord[]; count: number }> {
    try {
      let query = this.admin.from(this.table).select('*', { count: 'exact' })

      if (filters.deviceId) {
        query = query.eq('device_id', filters.deviceId)
      }
      if (filters.reportedBy) {
        const reporter = await this.resolveEmployeeIdentifier(filters.reportedBy, 'reported_by filter')
        if (reporter) query = query.eq('reported_by', reporter)
      }
      if (filters.resolvedBy) {
        const resolver = await this.resolveEmployeeIdentifier(filters.resolvedBy, 'resolved_by filter')
        if (resolver) query = query.eq('resolved_by', resolver)
      }
      if (filters.status) {
        query = query.eq('status', this.ensureEnumValue(filters.status, INCIDENT_STATUSES, 'status'))
      }
      if (filters.severity) {
        query = query.eq('severity', this.ensureEnumValue(filters.severity, INCIDENT_SEVERITIES, 'severity'))
      }
      if (filters.incidentType) {
        query = query.eq('incident_type', this.ensureEnumValue(filters.incidentType, INCIDENT_TYPES, 'incident_type'))
      }
      if (filters.fromDate) {
        query = query.gte('created_at', filters.fromDate)
      }
      if (filters.toDate) {
        query = query.lte('created_at', filters.toDate)
      }
      if (filters.search) {
        query = query.ilike('description', `%${filters.search}%`)
      }
      if (typeof filters.limit === 'number' && typeof filters.offset === 'number') {
        query = query.range(filters.offset, filters.offset + filters.limit - 1)
      } else if (typeof filters.limit === 'number') {
        query = query.limit(filters.limit)
      }

      const { data, error, count } = await query.order('created_at', { ascending: false })
      if (error) {
        this.handleError(error, 'list incidents')
      }

      return {
        data: (data ?? []).map((row) => this.normalize(row)),
        count: count ?? data?.length ?? 0,
      }
    } catch (error) {
      this.handleError(error, 'list incidents')
    }
  }

  async getIncidentById(incidentId: string): Promise<IncidentRecord | null> {
    return this.executeQuery<IncidentRecord | null>(
      async () => {
        const { data, error } = await this.admin.from(this.table).select('*').eq('incident_id', incidentId).maybeSingle()
        return { data: data ? this.normalize(data) : null, error }
      },
      'get incident by id',
    )
  }

  async createIncident(payload: CreateIncidentInput): Promise<IncidentRecord> {
    this.validateRequired(payload, ['device_id', 'reported_by', 'incident_type', 'description'])
    const deviceId = await this.assertDeviceExists(payload.device_id)
    const reporter = await this.resolveEmployeeIdentifier(payload.reported_by, 'reported_by')

    if (!reporter) {
      throw new Error('reported_by is invalid')
    }

    const resolver = await this.resolveEmployeeIdentifier(payload.resolved_by ?? null, 'resolved_by')

    const sanitized = this.sanitizeInput({
      device_id: deviceId,
      reported_by: reporter,
      incident_type: this.ensureEnumValue(payload.incident_type, INCIDENT_TYPES, 'incident_type'),
      description: payload.description,
      severity: this.ensureEnumValue(payload.severity ?? null, INCIDENT_SEVERITIES, 'severity'),
      status: this.ensureEnumValue(payload.status ?? 'Open', INCIDENT_STATUSES, 'status') ?? 'Open',
      resolution_notes: payload.resolution_notes ?? null,
      resolved_by: resolver,
      resolved_at: payload.resolved_at ?? null,
    })

    if (['Resolved', 'Closed'].includes(sanitized.status) && !sanitized.resolved_at) {
      sanitized.resolved_at = new Date().toISOString()
    }

    const record = await this.executeInsert<IncidentRecord>(
      async () => {
        const { data, error } = await this.admin.from(this.table).insert(sanitized).select('*').single()
        return { data: data ? this.normalize(data) : null, error }
      },
      'create incident',
    )

    return record
  }

  async updateIncident(incidentId: string, updates: UpdateIncidentInput): Promise<IncidentRecord | null> {
    const patch: Record<string, any> = {}

    if (updates.device_id) {
      patch.device_id = await this.assertDeviceExists(updates.device_id)
    }
    if (updates.reported_by) {
      const reporter = await this.resolveEmployeeIdentifier(updates.reported_by, 'reported_by')
      if (!reporter) throw new Error('reported_by is invalid')
      patch.reported_by = reporter
    }
    if (updates.resolved_by !== undefined) {
      patch.resolved_by = await this.resolveEmployeeIdentifier(updates.resolved_by, 'resolved_by')
    }
    if (updates.incident_type) {
      patch.incident_type = this.ensureEnumValue(updates.incident_type, INCIDENT_TYPES, 'incident_type')
    }
    if (updates.severity !== undefined) {
      patch.severity = this.ensureEnumValue(updates.severity ?? null, INCIDENT_SEVERITIES, 'severity')
    }
    if (updates.status) {
      patch.status = this.ensureEnumValue(updates.status, INCIDENT_STATUSES, 'status')
      if (['Resolved', 'Closed'].includes(patch.status) && !updates.resolved_at) {
        patch.resolved_at = new Date().toISOString()
      }
    }
    if (updates.description !== undefined) {
      patch.description = updates.description
    }
    if (updates.resolution_notes !== undefined) {
      patch.resolution_notes = updates.resolution_notes ?? null
    }
    if (updates.resolved_at !== undefined) {
      patch.resolved_at = updates.resolved_at
    }

    const sanitized = this.sanitizeInput(patch)

    return this.executeUpdate<IncidentRecord | null>(
      async () => {
        const { data, error } = await this.admin
          .from(this.table)
          .update(sanitized)
          .eq('incident_id', incidentId)
          .select('*')
          .maybeSingle()
        return { data: data ? this.normalize(data) : null, error }
      },
      'update incident',
    )
  }

  async deleteIncident(incidentId: string): Promise<boolean> {
    return this.executeDelete(
      async () => {
        const { error } = await this.admin.from(this.table).delete().eq('incident_id', incidentId)
        return { error }
      },
      'delete incident',
    )
  }
}

export const incidentsService = new IncidentsService()

