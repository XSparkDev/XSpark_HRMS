// ============================================================================
// INCIDENTS SERVICE - Asset Management System
// ============================================================================
// Manages incident reporting for resources (damage, malfunction, etc.)
// ============================================================================

import { supabase } from '@/lib/supabase'

export interface Incident {
  incident_id: string
  resource_id: string
  reported_by: string
  incident_type: 'Damage' | 'Malfunction' | 'Lost' | 'Other'
  description: string
  severity?: 'Low' | 'Medium' | 'High' | 'Critical'
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed'
  resolved_by?: string
  resolved_at?: string
  resolution_notes?: string
  created_at: string
  updated_at: string
}

export interface CreateIncidentData {
  resource_id: string
  reported_by: string
  incident_type: 'Damage' | 'Malfunction' | 'Lost' | 'Other'
  description: string
  severity?: 'Low' | 'Medium' | 'High' | 'Critical'
  status?: 'Open' | 'In Progress' | 'Resolved' | 'Closed'
}

export interface UpdateIncidentData extends Partial<CreateIncidentData> {
  incident_id: string
}

export interface IncidentFilters {
  resource_id?: string
  reported_by?: string
  incident_type?: string
  severity?: string
  status?: string
  start_date?: string
  end_date?: string
  limit?: number
  offset?: number
}

export class IncidentsService {
  // ============================================================================
  // READ OPERATIONS
  // ============================================================================

  /**
   * Get all incidents with optional filtering
   */
  async getAll(filters?: IncidentFilters): Promise<Incident[]> {
    try {
      let query = supabase.from('incidents').select('*')

      if (filters?.resource_id) {
        query = query.eq('resource_id', filters.resource_id)
      }

      if (filters?.reported_by) {
        query = query.eq('reported_by', filters.reported_by)
      }

      if (filters?.incident_type) {
        query = query.eq('incident_type', filters.incident_type)
      }

      if (filters?.severity) {
        query = query.eq('severity', filters.severity)
      }

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      if (filters?.start_date) {
        query = query.gte('created_at', filters.start_date)
      }

      if (filters?.end_date) {
        query = query.lte('created_at', filters.end_date)
      }

      if (filters?.limit) {
        query = query.limit(filters.limit)
      }

      if (filters?.offset) {
        query = query.range(filters.offset, (filters.offset || 0) + (filters.limit || 50) - 1)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching incidents:', error)
      throw new Error('Failed to fetch incidents')
    }
  }

  /**
   * Get incident by ID
   */
  async getById(incidentId: string): Promise<Incident | null> {
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .eq('incident_id', incidentId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching incident by ID:', error)
      return null
    }
  }

  /**
   * Get incidents by resource
   */
  async getByResource(resourceId: string): Promise<Incident[]> {
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .eq('resource_id', resourceId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching incidents by resource:', error)
      throw new Error('Failed to fetch incidents by resource')
    }
  }

  /**
   * Get incidents by user
   */
  async getByUser(userId: string): Promise<Incident[]> {
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .eq('reported_by', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching incidents by user:', error)
      throw new Error('Failed to fetch incidents by user')
    }
  }

  /**
   * Get open incidents
   */
  async getOpen(): Promise<Incident[]> {
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .eq('status', 'Open')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching open incidents:', error)
      throw new Error('Failed to fetch open incidents')
    }
  }

  /**
   * Get critical incidents
   */
  async getCritical(): Promise<Incident[]> {
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .eq('severity', 'Critical')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching critical incidents:', error)
      throw new Error('Failed to fetch critical incidents')
    }
  }

  // ============================================================================
  // CREATE OPERATIONS
  // ============================================================================

  /**
   * Create a new incident
   */
  async create(incidentData: CreateIncidentData): Promise<Incident> {
    try {
      const { data, error } = await supabase
        .from('incidents')
        .insert([incidentData])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating incident:', error)
      throw new Error('Failed to create incident')
    }
  }

  // ============================================================================
  // UPDATE OPERATIONS
  // ============================================================================

  /**
   * Update incident
   */
  async update(incidentId: string, updates: Partial<UpdateIncidentData>): Promise<Incident | null> {
    try {
      const { data, error } = await supabase
        .from('incidents')
        .update(updates)
        .eq('incident_id', incidentId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating incident:', error)
      throw new Error('Failed to update incident')
    }
  }

  /**
   * Mark incident as in progress
   */
  async markInProgress(incidentId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('incidents')
        .update({ status: 'In Progress' })
        .eq('incident_id', incidentId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error marking incident as in progress:', error)
      throw new Error('Failed to mark incident as in progress')
    }
  }

  /**
   * Resolve an incident
   */
  async resolve(incidentId: string, resolvedBy: string, resolutionNotes?: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('incidents')
        .update({
          status: 'Resolved',
          resolved_by: resolvedBy,
          resolved_at: new Date().toISOString(),
          resolution_notes: resolutionNotes
        })
        .eq('incident_id', incidentId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error resolving incident:', error)
      throw new Error('Failed to resolve incident')
    }
  }

  /**
   * Close an incident
   */
  async close(incidentId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('incidents')
        .update({ status: 'Closed' })
        .eq('incident_id', incidentId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error closing incident:', error)
      throw new Error('Failed to close incident')
    }
  }

  // ============================================================================
  // DELETE OPERATIONS
  // ============================================================================

  /**
   * Delete an incident
   */
  async delete(incidentId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('incidents')
        .delete()
        .eq('incident_id', incidentId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting incident:', error)
      throw new Error('Failed to delete incident')
    }
  }

  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================

  /**
   * Get incident count by status
   */
  async getCountByStatus(): Promise<Record<string, number>> {
    try {
      const { data, error } = await supabase.from('incidents').select('status')

      if (error) throw error

      const counts = data.reduce((acc: Record<string, number>, incident: { status: string }) => {
        acc[incident.status] = (acc[incident.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return counts
    } catch (error) {
      console.error('Error getting incident count by status:', error)
      throw new Error('Failed to get incident count by status')
    }
  }

  /**
   * Get incident count by severity
   */
  async getCountBySeverity(): Promise<Record<string, number>> {
    try {
      const { data, error } = await supabase.from('incidents').select('severity')

      if (error) throw error

      const counts = data.reduce((acc: Record<string, number>, incident: { severity?: string }) => {
        const severity = incident.severity || 'Unknown'
        acc[severity] = (acc[severity] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return counts
    } catch (error) {
      console.error('Error getting incident count by severity:', error)
      throw new Error('Failed to get incident count by severity')
    }
  }
}

// Export singleton instance
export const incidentsService = new IncidentsService()
export default incidentsService

