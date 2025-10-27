// ============================================================================
// RESOURCES SERVICE - Asset Management System
// ============================================================================
// Manages resources (equipment, rooms, vehicles, etc.)
// ============================================================================

import { supabase } from '@/lib/supabase'

export interface Resource {
  resource_id: string
  resource_name: string
  resource_type: string
  description?: string
  location?: string
  capacity?: number
  condition?: 'New' | 'Good' | 'Fair' | 'Damaged'
  qr_code_url?: string
  is_available: boolean
  notes?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CreateResourceData {
  resource_id: string
  resource_name: string
  resource_type: string
  description?: string
  location?: string
  capacity?: number
  condition?: 'New' | 'Good' | 'Fair' | 'Damaged'
  qr_code_url?: string
  is_available?: boolean
  notes?: string
  created_by?: string
}

export interface UpdateResourceData extends Partial<CreateResourceData> {
  resource_id: string
}

export interface ResourceFilters {
  resource_type?: string
  location?: string
  is_available?: boolean
  condition?: string
  search?: string
  limit?: number
  offset?: number
}

export class ResourcesService {
  // ============================================================================
  // READ OPERATIONS
  // ============================================================================

  /**
   * Get all resources with optional filtering
   */
  async getAll(filters?: ResourceFilters): Promise<Resource[]> {
    try {
      let query = supabase.from('resources').select('*')

      if (filters?.resource_type) {
        query = query.eq('resource_type', filters.resource_type)
      }

      if (filters?.location) {
        query = query.ilike('location', `%${filters.location}%`)
      }

      if (filters?.is_available !== undefined) {
        query = query.eq('is_available', filters.is_available)
      }

      if (filters?.condition) {
        query = query.eq('condition', filters.condition)
      }

      if (filters?.search) {
        query = query.or(`resource_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
      }

      if (filters?.limit) {
        query = query.limit(filters.limit)
      }

      if (filters?.offset) {
        query = query.range(filters.offset, (filters.offset || 0) + (filters.limit || 50) - 1)
      }

      const { data, error } = await query.order('resource_name', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching resources:', error)
      throw new Error('Failed to fetch resources')
    }
  }

  /**
   * Get resource by ID
   */
  async getById(resourceId: string): Promise<Resource | null> {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('resource_id', resourceId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching resource by ID:', error)
      return null
    }
  }

  /**
   * Get available resources (not currently booked)
   */
  async getAvailable(resourceType?: string): Promise<Resource[]> {
    try {
      // Use the available_resources view
      const { data, error } = await supabase
        .from('available_resources')
        .select('*')
        .eq('is_available', true)

      if (error) throw error

      // Filter by type if provided
      if (resourceType) {
        return (data || []).filter(r => r.resource_type === resourceType)
      }

      return data || []
    } catch (error) {
      console.error('Error fetching available resources:', error)
      throw new Error('Failed to fetch available resources')
    }
  }

  /**
   * Get resources by type
   */
  async getByType(resourceType: string): Promise<Resource[]> {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('resource_type', resourceType)
        .order('resource_name', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching resources by type:', error)
      throw new Error('Failed to fetch resources by type')
    }
  }

  /**
   * Search resources
   */
  async search(query: string, limit: number = 10): Promise<Resource[]> {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .or(`resource_name.ilike.%${query}%,description.ilike.%${query}%,resource_id.ilike.%${query}%`)
        .limit(limit)
        .order('resource_name', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error searching resources:', error)
      throw new Error('Failed to search resources')
    }
  }

  // ============================================================================
  // CREATE OPERATIONS
  // ============================================================================

  /**
   * Create a new resource
   */
  async create(resourceData: CreateResourceData): Promise<Resource> {
    try {
      const { data, error } = await supabase
        .from('resources')
        .insert([resourceData])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating resource:', error)
      throw new Error('Failed to create resource')
    }
  }

  /**
   * Create multiple resources
   */
  async createMultiple(resourcesData: CreateResourceData[]): Promise<Resource[]> {
    try {
      const { data, error } = await supabase
        .from('resources')
        .insert(resourcesData)
        .select()

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error creating multiple resources:', error)
      throw new Error('Failed to create resources')
    }
  }

  // ============================================================================
  // UPDATE OPERATIONS
  // ============================================================================

  /**
   * Update resource
   */
  async update(resourceId: string, updates: Partial<UpdateResourceData>): Promise<Resource | null> {
    try {
      const { data, error } = await supabase
        .from('resources')
        .update(updates)
        .eq('resource_id', resourceId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating resource:', error)
      throw new Error('Failed to update resource')
    }
  }

  /**
   * Mark resource as unavailable
   */
  async markUnavailable(resourceId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('resources')
        .update({ is_available: false })
        .eq('resource_id', resourceId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error marking resource as unavailable:', error)
      throw new Error('Failed to mark resource as unavailable')
    }
  }

  /**
   * Mark resource as available
   */
  async markAvailable(resourceId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('resources')
        .update({ is_available: true })
        .eq('resource_id', resourceId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error marking resource as available:', error)
      throw new Error('Failed to mark resource as available')
    }
  }

  /**
   * Update resource condition
   */
  async updateCondition(resourceId: string, condition: 'New' | 'Good' | 'Fair' | 'Damaged'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('resources')
        .update({ condition })
        .eq('resource_id', resourceId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error updating resource condition:', error)
      throw new Error('Failed to update resource condition')
    }
  }

  // ============================================================================
  // DELETE OPERATIONS
  // ============================================================================

  /**
   * Delete a resource
   */
  async delete(resourceId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('resources')
        .delete()
        .eq('resource_id', resourceId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting resource:', error)
      throw new Error('Failed to delete resource')
    }
  }

  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================

  /**
   * Get resource count by type
   */
  async getCountByType(): Promise<Record<string, number>> {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('resource_type')

      if (error) throw error

      const counts = data.reduce((acc: Record<string, number>, resource: { resource_type: string }) => {
        acc[resource.resource_type] = (acc[resource.resource_type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return counts
    } catch (error) {
      console.error('Error getting resource count by type:', error)
      throw new Error('Failed to get resource count by type')
    }
  }

  /**
   * Get resource count by condition
   */
  async getCountByCondition(): Promise<Record<string, number>> {
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('condition')

      if (error) throw error

      const counts = data.reduce((acc: Record<string, number>, resource: { condition: string }) => {
        acc[resource.condition] = (acc[resource.condition] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return counts
    } catch (error) {
      console.error('Error getting resource count by condition:', error)
      throw new Error('Failed to get resource count by condition')
    }
  }
}

// Export singleton instance
export const resourcesService = new ResourcesService()
export default resourcesService

