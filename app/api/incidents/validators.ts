import { z } from 'zod'

export const IncidentStatusEnum = z.enum(['Open', 'In Progress', 'Resolved', 'Closed'])
export const IncidentSeverityEnum = z.enum(['Low', 'Medium', 'High', 'Critical'])
export const IncidentTypeEnum = z.enum(['Damage', 'Malfunction', 'Lost', 'Other'])

export const incidentListSchema = z.object({
  deviceId: z.string().optional(),
  reportedBy: z.string().optional(),
  resolvedBy: z.string().optional(),
  status: IncidentStatusEnum.optional(),
  severity: IncidentSeverityEnum.optional(),
  incidentType: IncidentTypeEnum.optional(),
  search: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  offset: z.coerce.number().min(0).optional(),
})

export const incidentCreateSchema = z.object({
  device_id: z.string().min(1, 'device_id is required'),
  reported_by: z.string().min(1, 'reported_by is required'),
  incident_type: IncidentTypeEnum,
  description: z.string().min(1, 'description is required'),
  severity: IncidentSeverityEnum.nullable().optional(),
  status: IncidentStatusEnum.optional(),
  resolution_notes: z.string().nullable().optional(),
  resolved_by: z.string().nullable().optional(),
  resolved_at: z.string().nullable().optional(),
})

export const incidentUpdateSchema = z.object({
  device_id: z.string().optional(),
  reported_by: z.string().optional(),
  incident_type: IncidentTypeEnum.optional(),
  description: z.string().optional(),
  severity: IncidentSeverityEnum.nullable().optional(),
  status: IncidentStatusEnum.optional(),
  resolution_notes: z.string().nullable().optional(),
  resolved_by: z.string().nullable().optional(),
  resolved_at: z.string().nullable().optional(),
})









