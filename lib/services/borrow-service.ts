// ============================================================================
// BORROW SERVICE - Repository Layer (REBUILT)
// ============================================================================
// Handles CRUD-style operations for the `borrows` table.
// 
// Status Tracking:
// - is_borrowed: false = pending request, true = active borrow
// - is_returned: false = not returned, true = returned (history)
// 
// Active Borrows: is_borrowed = true AND is_returned = false
// Pending Requests: is_borrowed = false AND is_returned = false (and not rejected)
// Returned Devices: is_returned = true (full history maintained)
// 
// IMPORTANT: Records are NEVER deleted, only marked as returned to maintain
// full audit history.
// ============================================================================

import { supabaseAdmin } from '@/lib/supabase-admin'

import { BaseService } from './base-service'
import { devicesService } from './devices-service'
import { notificationService } from './notification-service'

const BORROW_STATUSES = [
  'pending_borrow',
  'borrowed',
  'pending_return',
  'returned',
  'rejected',
] as const

type BorrowStatus = (typeof BORROW_STATUSES)[number]

// ============================================================================
// INTERFACES - Based on actual database schema
// ============================================================================

export interface BorrowRecord {
  borrow_id: string
  device_id: string
  borrowed_by: string
  borrow_date: string | null
  return_date: string | null
  is_borrowed: boolean | null
  is_returned?: boolean | null // New: tracks if device has been returned
  borrow_request?: boolean | null // New: true while awaiting supervisor action
  borrow_status?: string | null // New: normalized workflow status
  notes?: string | null
  qr_code_url?: string | null
  status?: string | null // Optional: for backward compatibility
  approval_status?: string | null // Optional: for backward compatibility
  returned_at?: string | null // Optional: for backward compatibility
}

export interface BorrowFilters {
  deviceId?: string
  borrowedBy?: string
  isBorrowed?: boolean // false = pending, true = active (must also have is_returned = false)
  isReturned?: boolean // true = returned devices (for history)
  borrowStatus?: string // e.g. 'active' or a BorrowStatus
  borrowRequest?: boolean // filter by borrow_request flag
  fromDate?: string
  toDate?: string
  limit?: number
  offset?: number
}

export interface CreateBorrowInput {
  device_id: string
  borrowed_by: string
  borrow_date?: string | null
  return_date?: string | null
  notes?: string | null
}

export type UpdateBorrowInput = Partial<{
  borrow_date: string | null
  return_date: string | null
  is_borrowed: boolean
  is_returned?: boolean // Allow updating is_returned status
  notes: string | null
}>

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ============================================================================
// OLD IMPLEMENTATION - COMMENTED OUT FOR REBUILD
// ============================================================================
/*
export class BorrowService extends BaseService {
  // ... old implementation commented out ...
}
*/

// ============================================================================
// NEW CLEAN IMPLEMENTATION
// ============================================================================

export class BorrowService extends BaseService {
  private readonly table = 'borrows'
  private readonly admin = supabaseAdmin

  private getBorrowStatusValue(record: BorrowRecord | null | undefined): BorrowStatus | null {
    const raw = (record as any)?.borrow_status
    return this.normalizeBorrowStatus(raw)
  }

  private normalizeBorrowStatus(input: unknown): BorrowStatus | null {
    const raw = typeof input === 'string' ? input.trim().toLowerCase() : ''
    if (!raw) return null
    return (BORROW_STATUSES as readonly string[]).includes(raw) ? (raw as BorrowStatus) : null
  }

  /**
   * Enforce consistent state across borrow_status + boolean flags.
   * If you change the truth table, update this mapping too.
   */
  private buildStatusPatch(status: BorrowStatus): {
    borrow_status: BorrowStatus
    borrow_request: boolean
    is_borrowed: boolean
    is_returned: boolean
  } {
    switch (status) {
      case 'pending_borrow':
        return { borrow_status: status, borrow_request: true, is_borrowed: false, is_returned: false }
      case 'borrowed':
        return { borrow_status: status, borrow_request: false, is_borrowed: true, is_returned: false }
      case 'pending_return':
        // Return has been requested but not yet approved.
        // `is_returned` MUST remain false until supervisor approves.
        return { borrow_status: status, borrow_request: true, is_borrowed: true, is_returned: false }
      case 'returned':
        return { borrow_status: status, borrow_request: false, is_borrowed: false, is_returned: true }
      case 'rejected':
        return { borrow_status: status, borrow_request: false, is_borrowed: false, is_returned: false }
    }
  }

  /**
   * Resolve borrower identifier (UUID or employee_id) to employee UUID
   */
  private async resolveBorrowerIdentifier(identifier: string): Promise<{ employeeId: string; employeeUuid: string }> {
    const trimmed = identifier?.trim()
    if (!trimmed) {
      throw new Error('borrowed_by is required')
    }

    const column = uuidRegex.test(trimmed) ? 'id' : 'employee_id'
    const { data, error } = await this.admin
      .from('employees')
      .select('id, employee_id')
      .eq(column, trimmed)
      .maybeSingle()

    if (error) {
      console.warn('[BorrowService] Error resolving borrower identifier:', error)
      throw new Error(`Borrower not found: ${error.message || 'Database error'}`)
    }

    if (!data?.id || !data?.employee_id) {
      throw new Error('Borrower not found')
    }

    return {
      employeeUuid: data.id,
      employeeId: data.employee_id,
    }
  }

  /**
   * List borrows with filters
   * is_borrowed = false → pending requests
   * is_borrowed = true → active borrows
   */
  async listBorrows(filters: BorrowFilters = {}): Promise<{ data: BorrowRecord[]; count: number }> {
    try {
      let query = this.admin.from(this.table).select('*', { count: 'exact' })

      // Interpret high-level borrowStatus hints into concrete flags.
      // For now we only support 'active' explicitly.
      const normalizedStatus = filters.borrowStatus?.toLowerCase()
      if (normalizedStatus === 'active') {
        filters.isBorrowed = true
        filters.isReturned = false
      }
      const normalizedBorrowStatus = this.normalizeBorrowStatus(filters.borrowStatus)
      if (normalizedBorrowStatus) {
        query = query.eq('borrow_status', normalizedBorrowStatus)
      }

      if (filters.deviceId) {
        query = query.eq('device_id', filters.deviceId)
      }

      if (filters.borrowedBy) {
        const { employeeUuid } = await this.resolveBorrowerIdentifier(filters.borrowedBy)
        query = query.eq('borrowed_by', employeeUuid)
      }

      if (typeof filters.borrowRequest === 'boolean') {
        query = query.eq('borrow_request', filters.borrowRequest)
      }

      // Filter by is_borrowed:
      // - isBorrowed = false → pending requests (is_borrowed = false OR NULL, and not returned)
      // - isBorrowed = true  → active borrows (is_borrowed = true AND is_returned = false)
      if (typeof filters.isBorrowed === 'boolean') {
        if (filters.isBorrowed === true) {
          // Active borrows
          query = query.eq('is_borrowed', true).eq('is_returned', false)
        } else {
          // Pending requests: include legacy rows where is_borrowed is NULL
          query = query
            .or('is_borrowed.is.false,is_borrowed.is.null')
            .eq('is_returned', false)
        }
      }
      
      // Filter by is_returned for history queries
      if (typeof filters.isReturned === 'boolean') {
        query = query.eq('is_returned', filters.isReturned)
      }

      if (filters.fromDate) {
        query = query.gte('borrow_date', filters.fromDate)
      }

      if (filters.toDate) {
        query = query.lte('borrow_date', filters.toDate)
      }

      if (typeof filters.limit === 'number' && typeof filters.offset === 'number') {
        query = query.range(filters.offset, filters.offset + filters.limit - 1)
      } else if (typeof filters.limit === 'number') {
        query = query.limit(filters.limit)
      }

      const { data, error, count } = await query.order('borrow_date', { ascending: false })

      if (error) {
        console.error('[BorrowService] Query error:', error)
        this.handleError(error, 'list borrows')
      }

      let filteredData = (data as BorrowRecord[]) ?? []
      
      // Additional client-side filtering (legacy safety)
      // If borrow_status exists, trust it; otherwise fall back to old columns.
      filteredData = filteredData.filter((b) => {
        const bs = (b.borrow_status || '').toLowerCase()
        if (bs) return true
        // Legacy: drop rows that look rejected/returned via old columns
        const status = (b.status || '').toLowerCase()
        const approvalStatus = (b.approval_status || '').toLowerCase()
        const legacyRejected = status.includes('rejected') || approvalStatus.includes('rejected')
        const legacyReturned = b.is_returned === true || status.includes('returned') || b.returned_at !== null
        return !legacyRejected && !legacyReturned
      })
      
      // For active borrows, ensure is_returned = false
      if (typeof filters.isBorrowed === 'boolean' && filters.isBorrowed === true) {
        const beforeCount = filteredData.length
        filteredData = filteredData.filter((borrow) => {
          return borrow.is_returned !== true
        })
        
        if (beforeCount !== filteredData.length) {
          console.log('[BorrowService] Filtered active borrows (removed returned):', {
            before: beforeCount,
            after: filteredData.length,
          })
        }
      }

      return {
        data: filteredData,
        count: filteredData.length,
      }
    } catch (error) {
      console.error('[BorrowService] Exception in listBorrows:', error)
      this.handleError(error, 'list borrows')
    }
  }

  /**
   * Get single borrow by ID
   */
  async getBorrowById(borrowId: string): Promise<BorrowRecord | null> {
    return this.executeQuery<BorrowRecord | null>(
      async () => {
        const { data, error } = await this.admin
          .from(this.table)
          .select('*')
          .eq('borrow_id', borrowId)
          .maybeSingle()
        return { data: data as BorrowRecord | null, error }
      },
      'get borrow by id',
    )
  }

  /**
   * Create new borrow request
   * Sets is_borrowed = false (pending)
   */
  async createBorrow(payload: CreateBorrowInput): Promise<BorrowRecord> {
    this.validateRequired(payload, ['device_id', 'borrowed_by'])
    const { employeeUuid } = await this.resolveBorrowerIdentifier(payload.borrowed_by)

    const deviceIdentifier = payload.device_id?.trim()
    if (!deviceIdentifier) {
      throw new Error('device_id is required')
    }

    // Lookup device
    const device = await devicesService.getDeviceByIdentifier(deviceIdentifier)
    if (!device) {
      throw new Error('Device not found')
    }

    // Check if device is already borrowed
      const activeBorrow = await this.getActiveBorrowByDevice(device.device_id)
      if (activeBorrow) {
        throw new Error('Device is currently borrowed and not available')
      }

    // Check device status
    const status = (device.status || '').toLowerCase().trim()
    const blockedStatuses = ['borrowed', 'in_maintenance', 'maintenance', 'repair', 'damaged', 'broken', 'unusable', 'decommissioned']
    const isBlocked = blockedStatuses.some(blocked => status.includes(blocked))
    
    if (isBlocked) {
      throw new Error(`Device is not available for borrowing. Current status: ${device.status || 'unknown'}`)
    }

    // Validate borrow_date is not in the past and not a weekend
    const borrowDate = payload.borrow_date ?? new Date().toISOString()
    if (borrowDate) {
    const borrowDateObj = new Date(borrowDate)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    borrowDateObj.setHours(0, 0, 0, 0)
    if (borrowDateObj < now) {
      throw new Error('Borrow date cannot be in the past. Please select today or a future date.')
    }
    // Check for weekends (Saturday = 6, Sunday = 0)
    const dayOfWeek = borrowDateObj.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      throw new Error('Borrow date cannot fall on a weekend.')
    }
    }

    // Update device status to "pending borrow"
    try {
      await devicesService.updateDevice(device.device_id, {
        status: 'pending borrow',
      })
    } catch (deviceError) {
      const errorMessage = deviceError instanceof Error ? deviceError.message : 'Failed to update device status'
      throw new Error(`Failed to set device status to pending borrow: ${errorMessage}`)
    }

    // Create borrow record with is_borrowed = false (pending) and is_returned = false
    const pendingPatch = this.buildStatusPatch('pending_borrow')
    const insertPayload = this.sanitizeInput({
      device_id: device.device_id,
      borrowed_by: employeeUuid,
      notes: payload.notes ?? null,
      ...pendingPatch,
      borrow_date: borrowDate,
      return_date: payload.return_date ?? null,
    })

    const { data, error } = await this.admin
            .from(this.table)
      .insert(insertPayload)
            .select('*')
            .single()
          
    if (error) {
      // Rollback device status
    try {
      await devicesService.updateDevice(device.device_id, {
          status: device.status || 'available',
      })
      } catch (rollbackError) {
        console.error('[BorrowService] Failed to rollback device status:', rollbackError)
      }
      throw new Error(`Failed to create borrow record: ${error.message || 'Database error'}`)
    }

    return data as BorrowRecord
  }

  /**
   * Approve a borrow request
   * Sets is_borrowed = true (active)
   */
  async approveBorrow(borrowId: string, supervisorId: string): Promise<BorrowRecord | null> {
    const borrow = await this.getBorrowById(borrowId)
    if (!borrow) {
      throw new Error('Borrow request not found')
    }
    
    const currentStatus = this.getBorrowStatusValue(borrow)
    if (!currentStatus) {
      throw new Error('Borrow record is missing borrow_status')
    }

    // Idempotency: approving an already-borrowed record is a no-op.
    if (currentStatus === 'borrowed') {
      throw new Error('Borrow request is already approved')
    }

    if (currentStatus !== 'pending_borrow') {
      throw new Error(`Borrow request cannot be approved from status: ${currentStatus}`)
    }

    const updated = await this.executeUpdate<BorrowRecord | null>(
      async () => {
        const borrowedPatch = this.buildStatusPatch('borrowed')
        const { data, error } = await this.admin
          .from(this.table)
          .update({
            ...borrowedPatch,
          })
          .eq('borrow_id', borrowId)
          .select('*')
          .maybeSingle()
        return { data: data as BorrowRecord | null, error }
      },
      'approve borrow',
    )

    // Update device status to "borrowed"
    if (updated?.device_id) {
      await devicesService.markDeviceAsBorrowed(updated.device_id, updated.borrowed_by)
    }

    // Send approval notification to employee
    if (updated?.borrowed_by) {
      try {
        // Get device and employee information
        const device = await devicesService.getDeviceByIdentifier(updated.device_id)
        const { data: employee } = await this.admin
          .from('employees')
          .select('id, employee_id, first_name, last_name, preferred_name')
          .eq('id', updated.borrowed_by)
          .maybeSingle()

        const deviceName = device?.model || device?.asset_tag || 'device'
        const assetTag = device?.asset_tag || 'N/A'
        const employeeName = employee?.preferred_name || 
                           `${employee?.first_name || ''} ${employee?.last_name || ''}`.trim() ||
                           employee?.employee_id ||
                           'Employee'

        await notificationService.createNotification(
          {
            employee_id: updated.borrowed_by,
            title: 'Borrow Request Approved',
            message: `Your request to borrow ${deviceName} (Asset: ${assetTag}) has been approved. Please collect the device.`,
            notification_type: 'internal',
            published_by: supervisorId,
            is_confidential: false,
          },
          {
            sendEmail: true,
            preventDuplicates: true,
            duplicateWindowMinutes: 5,
          }
        )
        console.log(`[BorrowService] Sent approval notification to employee ${updated.borrowed_by}`)
      } catch (notifError) {
        console.error('[BorrowService] Failed to send approval notification:', notifError)
        // Don't fail the approval if notification fails
      }
    }

    return updated
  }

  /**
   * Reject a borrow request
   * Keep is_borrowed = false, update device status back to available
   */
  async rejectBorrow(borrowId: string, supervisorId: string, reason?: string): Promise<BorrowRecord | null> {
    const borrow = await this.getBorrowById(borrowId)
    if (!borrow) {
      throw new Error('Borrow request not found')
    }

    const currentStatus = this.getBorrowStatusValue(borrow)
    if (!currentStatus) {
      throw new Error('Borrow record is missing borrow_status')
    }
    if (currentStatus === 'rejected') {
      // Idempotent-ish: treat as already rejected
      return borrow
    }
    if (currentStatus !== 'pending_borrow') {
      throw new Error(`Borrow request cannot be rejected from status: ${currentStatus}`)
    }
    
    // Update notes with rejection reason
    const updatedNotes = reason
      ? `${borrow.notes || ''}\nRejection reason: ${reason}`.trim()
      : borrow.notes

    const updated = await this.executeUpdate<BorrowRecord | null>(
      async () => {
        const rejectedPatch = this.buildStatusPatch('rejected')
        const { data, error } = await this.admin
          .from(this.table)
          .update({
            notes: updatedNotes,
            ...rejectedPatch,
          })
          .eq('borrow_id', borrowId)
          .select('*')
          .maybeSingle()
        return { data: data as BorrowRecord | null, error }
      },
      'reject borrow',
    )

    // Make device available again
    if (updated?.device_id) {
      await devicesService.markDeviceAsAvailable(updated.device_id)
    }

    // Send rejection notification to employee
    if (updated?.borrowed_by) {
      try {
        // Get device and employee information
        const device = await devicesService.getDeviceByIdentifier(updated.device_id)
        const { data: employee } = await this.admin
          .from('employees')
          .select('id, employee_id, first_name, last_name, preferred_name')
          .eq('id', updated.borrowed_by)
          .maybeSingle()

        const deviceName = device?.model || device?.asset_tag || 'device'
        const assetTag = device?.asset_tag || 'N/A'
        const rejectionMessage = reason 
          ? `Your request to borrow ${deviceName} (Asset: ${assetTag}) has been rejected. Reason: ${reason}`
          : `Your request to borrow ${deviceName} (Asset: ${assetTag}) has been rejected.`

        await notificationService.createNotification(
          {
            employee_id: updated.borrowed_by,
            title: 'Borrow Request Rejected',
            message: rejectionMessage,
            notification_type: 'internal',
            published_by: supervisorId,
            is_confidential: false,
          },
          {
            sendEmail: true,
            preventDuplicates: true,
            duplicateWindowMinutes: 5,
          }
        )
        console.log(`[BorrowService] Sent rejection notification to employee ${updated.borrowed_by}`)
      } catch (notifError) {
        console.error('[BorrowService] Failed to send rejection notification:', notifError)
        // Don't fail the rejection if notification fails
      }
    }

    return updated
  }

  /**
   * Request a return (employee action)
   * Sets borrow_status = pending_return and keeps is_returned = false
   *
   * This DOES NOT mark the device as available; supervisor approval should
   * transition pending_return -> returned via the returns approval flow.
   */
  async requestReturn(borrowId: string): Promise<BorrowRecord | null> {
    const borrow = await this.getBorrowById(borrowId)
    if (!borrow) throw new Error('Borrow request not found')

    const currentStatus = this.getBorrowStatusValue(borrow)
    if (!currentStatus) throw new Error('Borrow record is missing borrow_status')

    if (currentStatus === 'pending_return') {
      return borrow
    }
    if (currentStatus !== 'borrowed') {
      throw new Error(`Return cannot be requested from status: ${currentStatus}`)
    }

    const now = new Date().toISOString()
    return this.executeUpdate<BorrowRecord | null>(
      async () => {
        const pendingReturnPatch = this.buildStatusPatch('pending_return')
        const { data, error } = await this.admin
          .from(this.table)
          .update({ ...pendingReturnPatch, updated_at: now })
          .eq('borrow_id', borrowId)
          .select('*')
          .maybeSingle()
        return { data: data as BorrowRecord | null, error }
      },
      'request return',
    )
  }

  /**
   * Return a device
   * Sets is_borrowed = false, is_returned = true, return_date = NOW()
   * Updates device status to available
   * IMPORTANT: Record is NOT deleted, only marked as returned
   */
  async returnDevice(borrowId: string): Promise<BorrowRecord | null> {
    const now = new Date().toISOString()
    console.log('[BorrowService] Returning device for borrow:', borrowId)
    
    try {
      const existing = await this.getBorrowById(borrowId)
      const currentStatus = this.getBorrowStatusValue(existing)
      if (!currentStatus) {
        throw new Error('Borrow record is missing borrow_status')
      }
      if (currentStatus === 'returned') {
        return existing
      }
      // Enforce two-step return: only supervisor approval should finalize return.
      if (currentStatus !== 'pending_return') {
        throw new Error(`Borrow cannot be marked returned from status: ${currentStatus} (expected pending_return)`)
      }

      const borrow = await this.executeUpdate<BorrowRecord | null>(
        async () => {
          const returnedPatch = this.buildStatusPatch('returned')
          const { data, error } = await this.admin
            .from(this.table)
            .update({
              return_date: now,
              ...returnedPatch,
            })
            .eq('borrow_id', borrowId)
            .select('*')
            .maybeSingle()
          return { data: data as BorrowRecord | null, error }
        },
        'return device',
      )

      if (!borrow) {
        console.error('[BorrowService] Return device failed: No borrow record found for borrowId:', borrowId)
        return null
      }

      console.log('[BorrowService] Successfully marked borrow as returned:', {
        borrowId,
        deviceId: borrow.device_id,
        isReturned: borrow.is_returned,
        returnDate: borrow.return_date,
      })

      // Update device status to available
      if (borrow.device_id) {
        try {
          await devicesService.markDeviceAsAvailable(borrow.device_id)
          console.log('[BorrowService] Updated device status to available:', borrow.device_id)
        } catch (deviceError) {
          console.error('[BorrowService] Error updating device status:', deviceError)
          // Don't fail the return if device update fails - the borrow is already marked as returned
        }
      }

      return borrow
    } catch (error) {
      console.error('[BorrowService] Error in returnDevice:', {
        borrowId,
        error: error instanceof Error ? error.message : String(error),
      })
      // Re-throw to let caller handle the error
      throw error
    }
  }

  /**
   * Get active borrow by device ID
   * Active = is_borrowed = true
   */
  async getActiveBorrowByDevice(deviceId: string): Promise<BorrowRecord | null> {
    try {
        const { data, error } = await this.admin
          .from(this.table)
          .select('*')
          .eq('device_id', deviceId)
          .eq('is_borrowed', true) // Active borrows only
          .eq('is_returned', false) // Not returned
          .order('borrow_date', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        if (error) {
          console.warn(`[BorrowService] Error checking active borrow for device ${deviceId}:`, error)
          return null
        }
        
        return (data as BorrowRecord | null) ?? null
    } catch (error) {
      console.warn(`[BorrowService] Unexpected error checking active borrow for device ${deviceId}:`, error)
      return null
    }
  }

  /**
   * Get active borrows by multiple device IDs
   */
  async getActiveBorrowsByDeviceIds(deviceIds: string[]): Promise<Map<string, BorrowRecord>> {
    if (!deviceIds || deviceIds.length === 0) {
      return new Map()
    }

    try {
      const { data, error } = await this.admin
        .from(this.table)
        .select('*')
        .in('device_id', deviceIds)
        .eq('is_borrowed', true) // Active borrows only
        .eq('is_returned', false) // Not returned
        .order('borrow_date', { ascending: false })

      if (error) {
        console.error('[BorrowService] Error fetching active borrows by device IDs:', error)
        return new Map()
      }

      const activeBorrowsMap = new Map<string, BorrowRecord>()
      ;((data as BorrowRecord[]) || []).forEach((borrow) => {
        // Only include if not returned
        if (borrow.is_returned !== true) {
          const existing = activeBorrowsMap.get(borrow.device_id)
          if (!existing || (borrow.borrow_date && existing.borrow_date && borrow.borrow_date > existing.borrow_date)) {
            activeBorrowsMap.set(borrow.device_id, borrow)
          }
        }
      })

      console.log('[BorrowService] Fetched active borrows:', {
        deviceIdsCount: deviceIds.length,
        activeBorrowsCount: activeBorrowsMap.size,
      })

      return activeBorrowsMap
    } catch (error) {
      console.error('[BorrowService] Unexpected error in getActiveBorrowsByDeviceIds:', error)
      return new Map()
    }
  }

  /**
   * Get borrows by borrower
   * @param identifier - Employee identifier (UUID or employee_id)
   * @param includeReturned - If true, includes returned borrows (history). If false, only active/pending.
   */
  async getBorrowsByBorrower(identifier: string, includeReturned: boolean = true): Promise<BorrowRecord[]> {
    try {
      const { employeeUuid } = await this.resolveBorrowerIdentifier(identifier)

      let query = this.admin
        .from(this.table)
        .select('*')
        .eq('borrowed_by', employeeUuid)
      
      // If not including returned, filter to only active/pending borrows
      if (!includeReturned) {
        query = query.eq('is_returned', false)
      }

      const { data, error } = await query.order('borrow_date', { ascending: false })

      if (error) {
        console.warn('[BorrowService] Error fetching borrows by borrower:', error)
        return []
      }

      const borrows = (data as BorrowRecord[]) ?? []
      
      // Filter for active borrows (is_borrowed = true AND is_returned = false)
      const activeBorrows = borrows.filter((borrow) => 
        borrow.is_borrowed === true && borrow.is_returned !== true
      )
      
      console.log('[BorrowService] Fetched borrows for borrower:', {
        identifier,
        includeReturned,
        total: borrows.length,
        active: activeBorrows.length,
        returned: borrows.filter(b => b.is_returned === true).length,
      })

      return includeReturned ? borrows : activeBorrows
    } catch (error) {
      if (error instanceof Error && error.message.includes('Borrower not found')) {
        console.warn('[BorrowService] Borrower not found:', identifier)
        return []
      }
      console.error('[BorrowService] Error in getBorrowsByBorrower:', error)
      return []
    }
  }

  /**
   * Get returned borrows (history) for a borrower
   * @param identifier - Employee identifier (UUID or employee_id)
   */
  async getReturnedBorrowsByBorrower(identifier: string): Promise<BorrowRecord[]> {
    try {
      const { employeeUuid } = await this.resolveBorrowerIdentifier(identifier)

      const { data, error } = await this.admin
        .from(this.table)
        .select('*')
        .eq('borrowed_by', employeeUuid)
        .eq('is_returned', true) // Only returned borrows
        .order('return_date', { ascending: false })

      if (error) {
        console.warn('[BorrowService] Error fetching returned borrows by borrower:', error)
        return []
      }

      const returnedBorrows = (data as BorrowRecord[]) ?? []
      
      console.log('[BorrowService] Fetched returned borrows for borrower:', {
        identifier,
        count: returnedBorrows.length,
      })

      return returnedBorrows
    } catch (error) {
      console.warn('[BorrowService] Error in getReturnedBorrowsByBorrower:', error)
      return []
    }
  }

  /**
   * Update borrow record
   * Note: For returning devices, use returnDevice() instead to ensure proper status updates
   */
  async updateBorrow(borrowId: string, updates: UpdateBorrowInput): Promise<BorrowRecord | null> {
    // If is_returned is being set to true, ensure return_date is set
    if (updates.is_returned === true && !updates.return_date) {
      updates.return_date = new Date().toISOString()
    }
    
    // If is_returned is true, ensure is_borrowed is false
    if (updates.is_returned === true && updates.is_borrowed !== false) {
      updates.is_borrowed = false
    }

    const sanitized = this.sanitizeInput(updates)
    
    console.log('[BorrowService] Updating borrow:', {
      borrowId,
      updates: Object.keys(sanitized),
      isReturned: sanitized.is_returned,
      isBorrowed: sanitized.is_borrowed,
    })
    
    const borrow = await this.executeUpdate<BorrowRecord | null>(
      async () => {
        const { data, error } = await this.admin
          .from(this.table)
          .update(sanitized)
          .eq('borrow_id', borrowId)
          .select('*')
          .maybeSingle()
        return { data: data as BorrowRecord | null, error }
      },
      'update borrow',
    )

    // Sync device status based on is_borrowed and is_returned
    if (borrow?.device_id) {
      try {
        if (borrow.is_returned === true || (typeof updates.is_returned === 'boolean' && updates.is_returned === true)) {
          // Device is returned, mark as available
          await devicesService.markDeviceAsAvailable(borrow.device_id)
          console.log('[BorrowService] Updated device status to available (returned):', borrow.device_id)
        } else if (typeof updates.is_borrowed === 'boolean') {
          if (updates.is_borrowed) {
            await devicesService.markDeviceAsBorrowed(borrow.device_id, borrow.borrowed_by)
            console.log('[BorrowService] Updated device status to borrowed:', borrow.device_id)
          } else {
            await devicesService.markDeviceAsAvailable(borrow.device_id)
            console.log('[BorrowService] Updated device status to available:', borrow.device_id)
          }
        }
      } catch (deviceError) {
        console.error('[BorrowService] Error syncing device status:', deviceError)
        // Don't fail the update if device status sync fails
      }
    }

    return borrow
  }

  /**
   * Delete borrow record
   * WARNING: This method should rarely be used. Prefer marking records as returned (is_returned = true)
   * instead of deleting them to maintain full audit history.
   * 
   * @param borrowId - The borrow record ID to delete
   * @param options - Delete options (hardDelete flag)
   * @returns true if deletion was successful
   */
  async deleteBorrow(borrowId: string, options: { hardDelete?: boolean } = {}): Promise<boolean> {
    console.warn('[BorrowService] WARNING: deleteBorrow called. Consider using returnDevice() instead to maintain history.')
    
    const borrow = await this.getBorrowById(borrowId)
    
    if (!borrow) {
      console.warn('[BorrowService] Cannot delete: borrow record not found:', borrowId)
      return false
    }
    
    try {
      const result = await this.executeDelete(
        async () => {
          const { error } = await this.admin.from(this.table).delete().eq('borrow_id', borrowId)
          return { error }
        },
        'delete borrow',
      )
      
      // Update device status after deletion
      if (result && borrow.device_id) {
        try {
          await devicesService.markDeviceAsAvailable(borrow.device_id)
          console.log('[BorrowService] Updated device status to available after deletion:', borrow.device_id)
        } catch (deviceError) {
          console.error('[BorrowService] Failed to update device status after borrow deletion:', deviceError)
        }
      }
      
      return result
    } catch (error) {
      console.error('[BorrowService] Error deleting borrow:', {
        borrowId,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  // ============================================================================
  // BACKWARD COMPATIBILITY ALIASES
  // ============================================================================

  /**
   * Alias for approveBorrow (for backward compatibility)
   */
  async approveBorrowRequest(borrowId: string, supervisorId: string): Promise<BorrowRecord | null> {
    return this.approveBorrow(borrowId, supervisorId)
  }

  /**
   * Alias for rejectBorrow (for backward compatibility)
   */
  async rejectBorrowRequest(borrowId: string, supervisorId: string, reason?: string): Promise<BorrowRecord | null> {
    return this.rejectBorrow(borrowId, supervisorId, reason)
  }
}

export const borrowService = new BorrowService()
