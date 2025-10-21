// ============================================================================
// NOTES SERVICE - Repository Pattern Implementation (Updated)
// ============================================================================
// This service handles all note-related operations with proper database integration
// ============================================================================

import { BaseService } from './base-service'

// Database types matching our schema
export interface Note {
  id: string
  employee_id?: string
  title?: string
  content: string
  author_id: string
  is_confidential: boolean
  created_at: string
  updated_at: string
}

export interface CreateNoteData {
  employee_id?: string
  title?: string
  content: string
  author_id: string
  is_confidential?: boolean
}

export interface UpdateNoteData {
  id: string
  title?: string
  content?: string
  is_confidential?: boolean
}

export interface NoteFilters {
  employee_id?: string
  author_id?: string
  is_confidential?: boolean
  search?: string
  limit?: number
  offset?: number
}

export class NotesService extends BaseService {
  // ============================================================================
  // READ OPERATIONS
  // ============================================================================

  /**
   * Get all notes with optional filtering
   */
  async getAllNotes(filters?: NoteFilters): Promise<Note[]> {
    return this.executeQueryArray(
      () => {
        let query = this.supabase
          .from('notes')
          .select(`
            *,
            employees!notes_employee_id_fkey(first_name, last_name, employee_id),
            employees!notes_author_id_fkey(first_name, last_name, employee_id)
          `)

        // Apply filters
        if (filters?.employee_id) {
          query = query.eq('employee_id', filters.employee_id)
        }

        if (filters?.author_id) {
          query = query.eq('author_id', filters.author_id)
        }

        if (filters?.is_confidential !== undefined) {
          query = query.eq('is_confidential', filters.is_confidential)
        }

        if (filters?.search) {
          query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`)
        }

        if (filters?.limit) {
          query = query.limit(filters.limit)
        }

        if (filters?.offset) {
          query = query.range(filters.offset, (filters.offset || 0) + (filters.limit || 50) - 1)
        }

        return query.order('created_at', { ascending: false })
      },
      'fetching notes'
    )
  }

  /**
   * Get note by ID
   */
  async getNoteById(id: string): Promise<Note | null> {
    return this.executeQuery(
      () => this.supabase
        .from('notes')
        .select(`
          *,
          employees!notes_employee_id_fkey(first_name, last_name, employee_id),
          employees!notes_author_id_fkey(first_name, last_name, employee_id)
        `)
        .eq('id', id)
        .single(),
      'fetching note by ID'
    )
  }

  /**
   * Get notes by employee ID
   */
  async getNotesByEmployee(employeeId: string): Promise<Note[]> {
    return this.executeQueryArray(
      () => this.supabase
        .from('notes')
        .select(`
          *,
          employees!notes_employee_id_fkey(first_name, last_name, employee_id),
          employees!notes_author_id_fkey(first_name, last_name, employee_id)
        `)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false }),
      'fetching notes by employee'
    )
  }

  /**
   * Get notes by author ID
   */
  async getNotesByAuthor(authorId: string): Promise<Note[]> {
    return this.executeQueryArray(
      () => this.supabase
        .from('notes')
        .select(`
          *,
          employees!notes_employee_id_fkey(first_name, last_name, employee_id),
          employees!notes_author_id_fkey(first_name, last_name, employee_id)
        `)
        .eq('author_id', authorId)
        .order('created_at', { ascending: false }),
      'fetching notes by author'
    )
  }

  /**
   * Get high alert notes for dashboard (implements visibility rules)
   */
  async getHighAlertNotesForDashboard(userId: string, userRole: string): Promise<Note[]> {
    try {
      // Get user's role permissions
      const { data: roleData, error: roleError } = await this.supabase
        .from('employees')
        .select('roles(can_view_sensitive_data)')
        .eq('auth_user_id', userId)
        .single()

      if (roleError) {
        console.error('Error fetching user role:', roleError)
        return []
      }

      const canViewSensitive = roleData?.roles?.can_view_sensitive_data || false

      let query = this.supabase
        .from('notes')
        .select(`
          *,
          employees!notes_employee_id_fkey(first_name, last_name, employee_id),
          employees!notes_author_id_fkey(first_name, last_name, employee_id)
        `)
        .eq('is_confidential', true) // High alert = confidential notes

      // Apply visibility rules
      if (!canViewSensitive) {
        // Regular users can only see their own confidential notes
        query = query.eq('author_id', userId)
      }
      // HR/Admin users can see all confidential notes

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(25)

      if (error) {
        this.handleError(error, 'fetching high alert notes')
      }

      return data || []
    } catch (error) {
      console.error('Error fetching high alert notes:', error)
      return []
    }
  }

  // ============================================================================
  // CREATE OPERATIONS
  // ============================================================================

  /**
   * Create a new note
   */
  async createNote(noteData: CreateNoteData): Promise<Note> {
    // Validate required fields
    this.validateRequired(noteData, ['content', 'author_id'])

    // Sanitize input
    const sanitizedData = this.sanitizeInput(noteData)

    return this.executeInsert(
      () => this.supabase
        .from('notes')
        .insert([{
          ...sanitizedData,
          is_confidential: sanitizedData.is_confidential || false
        }])
        .select()
        .single(),
      'creating note'
    )
  }

  // ============================================================================
  // UPDATE OPERATIONS
  // ============================================================================

  /**
   * Update a note
   */
  async updateNote(id: string, updates: Partial<UpdateNoteData>): Promise<Note | null> {
    // Sanitize input
    const sanitizedUpdates = this.sanitizeInput(updates)

    return this.executeUpdate(
      () => this.supabase
        .from('notes')
        .update(sanitizedUpdates)
        .eq('id', id)
        .select()
        .single(),
      'updating note'
    )
  }

  // ============================================================================
  // DELETE OPERATIONS
  // ============================================================================

  /**
   * Delete a note (hard delete)
   */
  async deleteNote(id: string, userId: string): Promise<boolean> {
    // Check if user has permission to delete
    const note = await this.getNoteById(id)
    if (!note) {
      throw new Error('Note not found')
    }

    // Check permissions: only author or HR/Admin can delete
    const canDelete = note.author_id === userId || await this.checkPermission(userId, 'hr_manager', 'delete note')
    
    if (!canDelete) {
      throw new Error('Insufficient permissions to delete note')
    }

    return this.executeDelete(
      () => this.supabase
        .from('notes')
        .delete()
        .eq('id', id),
      'deleting note'
    )
  }

  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================

  /**
   * Search notes by content
   */
  async searchNotes(query: string, limit: number = 10): Promise<Note[]> {
    return this.executeQueryArray(
      () => this.supabase
        .from('notes')
        .select(`
          *,
          employees!notes_employee_id_fkey(first_name, last_name, employee_id),
          employees!notes_author_id_fkey(first_name, last_name, employee_id)
        `)
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(limit),
      'searching notes'
    )
  }

  /**
   * Get note statistics
   */
  async getNoteStatistics(): Promise<{
    totalNotes: number
    confidentialNotes: number
    publicNotes: number
    notesByEmployee: Record<string, number>
  }> {
    try {
      const { data, error } = await this.supabase
        .from('notes')
        .select('is_confidential, employee_id')

      if (error) {
        this.handleError(error, 'fetching note statistics')
      }

      const stats = data.reduce((acc: any, note: { is_confidential: boolean; employee_id?: string }) => {
        acc.totalNotes++
        
        if (note.is_confidential) {
          acc.confidentialNotes++
        } else {
          acc.publicNotes++
        }

        if (note.employee_id) {
          acc.notesByEmployee[note.employee_id] = (acc.notesByEmployee[note.employee_id] || 0) + 1
        }

        return acc
      }, {
        totalNotes: 0,
        confidentialNotes: 0,
        publicNotes: 0,
        notesByEmployee: {} as Record<string, number>
      })

      return stats
    } catch (error) {
      console.error('Error fetching note statistics:', error)
      throw new Error('Failed to fetch note statistics')
    }
  }

  /**
   * Get recent notes
   */
  async getRecentNotes(limit: number = 10): Promise<Note[]> {
    return this.executeQueryArray(
      () => this.supabase
        .from('notes')
        .select(`
          *,
          employees!notes_employee_id_fkey(first_name, last_name, employee_id),
          employees!notes_author_id_fkey(first_name, last_name, employee_id)
        `)
        .order('created_at', { ascending: false })
        .limit(limit),
      'fetching recent notes'
    )
  }
}

// Export singleton instance
export const notesService = new NotesService()
export default notesService
