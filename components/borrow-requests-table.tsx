// ============================================================================
// BORROW REQUESTS TABLE COMPONENT (REBUILT)
// ============================================================================
// Clean, testable component for displaying and managing pending borrow requests
// ============================================================================

'use client'

import { useState, useCallback, useEffect } from 'react'
import { CheckCircle2, X, MoreVertical, RefreshCw, Eye, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { getCurrentUser } from '@/lib/auth'
import { ApproveBorrowModal } from '@/components/approve-borrow-modal'
import { RejectBorrowModal } from '@/components/reject-borrow-modal'

// ============================================================================
// TYPES
// ============================================================================

export interface BorrowRequest {
  id: string
  employeeName: string
  employeeSurname: string
  employeeId: string // Internal use only, not displayed
  deviceName: string
  deviceId?: string
  assetTag: string
  borrowDate: string
  purpose: string
  status: string
  createdAt?: string
}

interface BorrowRequestsTableProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove?: (id: string) => Promise<void>
  onReject?: (id: string, reason: string) => Promise<void>
  onViewDetails?: (request: BorrowRequest) => void
  onDelete?: (id: string) => Promise<void>
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BorrowRequestsTable({
  open,
  onOpenChange,
  onApprove,
  onReject,
  onViewDetails,
  onDelete,
}: BorrowRequestsTableProps) {
  const { toast } = useToast()
  const [requests, setRequests] = useState<BorrowRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [selectedRequestForAction, setSelectedRequestForAction] = useState<BorrowRequest | null>(null)

  // Fetch pending borrow requests
  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      // Status-first: pending borrows are borrow_status='pending_borrow'
      const borrowsResponse = await fetch('/api/borrows?borrowStatus=pending_borrow&limit=100', {
        cache: 'no-store',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      })

      if (!borrowsResponse.ok) {
        throw new Error(`HTTP ${borrowsResponse.status}: ${borrowsResponse.statusText}`)
      }

      const borrowsData = await borrowsResponse.json()
      if (!borrowsData.success || !Array.isArray(borrowsData.data)) {
        throw new Error('Invalid API response format')
      }

      const borrowRecords = borrowsData.data

      // Fetch devices and employees in parallel
      const [devicesResponse, employeesResponse] = await Promise.all([
        fetch('/api/devices?limit=1000&offset=0', {
          cache: 'no-store',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }),
        fetch('/api/employees?limit=1000&offset=0', {
          cache: 'no-store',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }),
      ])

      const [devicesJson, employeesJson] = await Promise.all([
        devicesResponse.json().catch(() => ({ success: false, data: [] })),
        employeesResponse.json().catch(() => ({ success: false, data: [] })),
      ])

      const devices = devicesJson.success && Array.isArray(devicesJson.data) ? devicesJson.data : []
      const employees = employeesJson.success && Array.isArray(employeesJson.data) ? employeesJson.data : []

      const devicesMap = new Map(devices.map((d: any) => [d.device_id, d]))
      const employeesMap = new Map(employees.map((e: any) => [e.id, e]))

      // Map borrow records to BorrowRequest format
      const mappedRequests = borrowRecords.map((item: any) => {
        const device = devicesMap.get(item.device_id) as any
        const employee = employeesMap.get(item.borrowed_by) as any

        return {
          id: item.borrow_id || item.id,
          employeeName: employee?.first_name || employee?.preferred_name || 'Unknown',
          employeeSurname: employee?.last_name || '',
          employeeId: employee?.employee_id || item.borrowed_by || 'Unknown', // Internal use only
          deviceName: device?.model || device?.brand || device?.device_type || 'Device',
          deviceId: item.device_id,
          assetTag: device?.asset_tag || item.device_id,
          borrowDate: item.borrow_date,
          purpose: item.notes || '',
          status: 'pending_borrow',
          createdAt: item.borrow_date,
        }
      })

      setRequests(mappedRequests)
    } catch (error) {
      console.error('[BorrowRequestsTable] Failed to fetch requests:', error)
      toast({
        variant: 'destructive',
        title: 'Failed to load requests',
        description: error instanceof Error ? error.message : 'Please try again',
      })
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Fetch when dialog opens
  useEffect(() => {
    if (open) {
      fetchRequests()
    }
  }, [open, fetchRequests])

  // Handle approve click - opens confirmation modal
  const handleApproveClick = useCallback(
    (request: BorrowRequest) => {
      setSelectedRequestForAction(request)
      setApproveModalOpen(true)
    },
    []
  )

  // Handle approve confirmation - called from modal after QR scan
  const handleApproveConfirm = useCallback(
    async (id: string) => {
      if (onApprove) {
        setApprovingId(id)
        try {
          await onApprove(id)
          await fetchRequests() // Refresh after approval
          toast({
            title: 'Request approved',
            description: 'Borrow request approved successfully',
          })
        } catch (error) {
          // Error handled by onApprove
          throw error
        } finally {
          setApprovingId(null)
        }
      } else {
        // Default approve handler
        setApprovingId(id)
        try {
          const user = getCurrentUser()
          const supervisorId = user?.id || user?.employeeId
          if (!supervisorId) {
            throw new Error('Supervisor ID is required')
          }

          const response = await fetch(`/api/borrows/${id}?action=approve`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({ supervisorId }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || `Failed to approve: ${response.statusText}`)
          }

          toast({
            title: 'Request approved',
            description: 'Borrow request approved successfully',
          })

          await fetchRequests()
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Approval failed',
            description: error instanceof Error ? error.message : 'Failed to approve request',
          })
          throw error
        } finally {
          setApprovingId(null)
        }
      }
    },
    [onApprove, fetchRequests, toast]
  )

  // Handle reject click - opens confirmation modal
  const handleRejectClick = useCallback(
    (request: BorrowRequest) => {
      setSelectedRequestForAction(request)
      setRejectModalOpen(true)
    },
    []
  )

  // Handle reject confirmation - called from modal after reason is provided
  const handleRejectConfirm = useCallback(
    async (id: string, reason: string) => {
      if (onReject) {
        setRejectingId(id)
        try {
          await onReject(id, reason)
          await fetchRequests() // Refresh after rejection
          toast({
            title: 'Request rejected',
            description: 'Borrow request rejected successfully',
          })
        } catch (error) {
          // Error handled by onReject
          throw error
        } finally {
          setRejectingId(null)
        }
      } else {
        // Default reject handler
        setRejectingId(id)
        try {
          const user = getCurrentUser()
          const supervisorId = user?.id || user?.employeeId
          if (!supervisorId) {
            throw new Error('Supervisor ID is required')
          }

          const response = await fetch(`/api/borrows/${id}?action=reject`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({ supervisorId, reason }),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || `Failed to reject: ${response.statusText}`)
          }

          toast({
            title: 'Request rejected',
            description: 'Borrow request rejected successfully',
          })

          await fetchRequests()
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Rejection failed',
            description: error instanceof Error ? error.message : 'Failed to reject request',
          })
          throw error
        } finally {
          setRejectingId(null)
        }
      }
    },
    [onReject, fetchRequests, toast]
  )

  // Format date
  const formatDateTime = (dateString: string | undefined) => {
    if (!dateString) return '—'
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return dateString
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-[#92278F]">
                <CheckCircle2 className="h-5 w-5" />
                Pending Borrow Requests
              </DialogTitle>
              <DialogDescription>Review and approve device borrowing requests</DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRequests}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-[#92278F] mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-muted-foreground">No pending borrow requests</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                  <TableHeader>
                    <TableRow className="bg-[#92278F]/5">
                      <TableHead className="font-semibold text-[#25294B] text-sm py-3 px-4">
                        Employee Name
                      </TableHead>
                      <TableHead className="font-semibold text-[#25294B] text-sm py-3 px-4">
                        Employee Surname
                      </TableHead>
                      <TableHead className="font-semibold text-[#25294B] text-sm py-3 px-4">
                        Device
                      </TableHead>
                      <TableHead className="font-semibold text-[#25294B] text-sm py-3 px-4">
                        Date & Time
                      </TableHead>
                      <TableHead className="font-semibold text-[#25294B] text-sm py-3 px-4">
                        Purpose
                      </TableHead>
                      <TableHead className="font-semibold text-[#25294B] text-sm py-3 px-4">
                        Status
                      </TableHead>
                      <TableHead className="font-semibold text-[#25294B] text-sm py-3 px-4 text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {requests.map((request) => {
                    const isPending = request.status.toLowerCase() === 'pending'
                    const isApproving = approvingId === request.id
                    const isRejecting = rejectingId === request.id

                    return (
                      <TableRow key={request.id} className="hover:bg-[#92278F]/5">
                        <TableCell className="font-medium text-[#25294B] text-sm py-3 px-4">
                          {request.employeeName}
                        </TableCell>
                        <TableCell className="font-medium text-[#25294B] text-sm py-3 px-4">
                          {request.employeeSurname}
                        </TableCell>
                        <TableCell className="font-medium text-[#25294B] text-sm py-3 px-4">
                          {request.deviceName}
                        </TableCell>
                        <TableCell className="text-[#58595B] text-sm py-3 px-4">
                          {formatDateTime(request.createdAt || request.borrowDate)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-[#58595B] text-sm py-3 px-4">
                          {request.purpose}
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <Badge
                            onClick={isPending ? () => handleApproveClick(request) : undefined}
                            className={`text-xs border ${
                              isPending
                                ? 'bg-[#BE1E2D]/10 text-[#BE1E2D] border-[#BE1E2D]/30 cursor-pointer hover:bg-[#BE1E2D]/20'
                                : 'bg-muted text-muted-foreground border-border cursor-default'
                            }`}
                          >
                            {request.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-muted"
                                disabled={isApproving || isRejecting}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {isPending && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleApproveClick(request)}
                                    disabled={isApproving || isRejecting}
                                    className="text-green-600 hover:bg-green-50 cursor-pointer"
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleRejectClick(request)}
                                    disabled={isApproving || isRejecting}
                                    className="text-[#BE1E2D] hover:bg-[#BE1E2D]/10 cursor-pointer"
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Reject
                                  </DropdownMenuItem>
                                </>
                              )}
                              {onViewDetails && (
                                <DropdownMenuItem
                                  onClick={() => onViewDetails(request)}
                                  className="text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                              )}
                              {onDelete && (
                                <DropdownMenuItem
                                  onClick={() => onDelete(request.id)}
                                  className="text-[#BE1E2D] hover:bg-[#BE1E2D]/10 cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Approve Confirmation Modal - Outside main dialog so it can render independently */}
    <ApproveBorrowModal
      open={approveModalOpen}
      onOpenChange={setApproveModalOpen}
      request={
        selectedRequestForAction
          ? {
              id: selectedRequestForAction.id,
              deviceId: selectedRequestForAction.deviceId || selectedRequestForAction.assetTag,
              deviceName: selectedRequestForAction.deviceName,
              assetTag: selectedRequestForAction.assetTag,
              employeeName: selectedRequestForAction.employeeName,
              employeeId: selectedRequestForAction.employeeId,
              borrowDate: selectedRequestForAction.borrowDate,
              purpose: selectedRequestForAction.purpose,
            }
          : null
      }
      onConfirm={handleApproveConfirm}
    />

    {/* Reject Confirmation Modal - Outside main dialog so it can render independently */}
    <RejectBorrowModal
      open={rejectModalOpen}
      onOpenChange={setRejectModalOpen}
      request={
        selectedRequestForAction
          ? {
              id: selectedRequestForAction.id,
              deviceName: selectedRequestForAction.deviceName,
              employeeName: selectedRequestForAction.employeeName,
            }
          : null
      }
      onConfirm={handleRejectConfirm}
    />
  </>
  )
}
