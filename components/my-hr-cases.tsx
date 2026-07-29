"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getCurrentUser } from "@/lib/auth"
import { Clock, Calendar, User, FileText, Eye } from "lucide-react"
import { format } from "date-fns"

interface Ticket {
  id: string
  category: string
  subcategory?: string
  subject: string
  description: string
  status: string
  confidential: boolean
  priority: string
  estimated_sla: string
  created_at: string
  updated_at: string
  attachments?: Array<{ filename: string; size: number }>
  assigned_to?: string | null
  resolved_at?: string | null
}

export function MyHrCases({ onContactHr }: { onContactHr?: () => void } = {}) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [employeeUuid, setEmployeeUuid] = useState<string | null>(null)

  const user = getCurrentUser()
  const lastFetchedEmployeeIdRef = useRef<string | null>(null)
  const lastFetchTimeRef = useRef<number>(0)

  // Fetch employee UUID from /api/auth/me
  useEffect(() => {
    if (!user?.id) return

    const fetchEmployeeUuid = async () => {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        }
        
        // Get Bearer token from localStorage
        try {
          const storedSession = localStorage.getItem('xspark_session')
          if (storedSession) {
            const sessionParsed = JSON.parse(storedSession)
            if (sessionParsed?.access_token) {
              headers['Authorization'] = `Bearer ${sessionParsed.access_token}`
            }
          }
        } catch (error) {
          console.warn('[MyHrCases] Failed to parse session for Bearer token:', error)
        }

        const res = await fetch("/api/auth/me", { headers })
        const json = await res.json()
        
        if (res.ok && json.success && json.data?.employee?.id) {
          // Use the actual UUID from employees table
          setEmployeeUuid(json.data.employee.id)
        } else {
          if (res.status !== 401) {
            console.warn("[MyHrCases] Failed to fetch employee UUID:", json.error)
          }
        }
      } catch (error) {
        console.warn("[MyHrCases] Error fetching employee UUID:", error)
      }
    }

    fetchEmployeeUuid()
  }, [user?.id])

  // Fetch tickets when employee UUID is available
  useEffect(() => {
    if (!employeeUuid) return

    let cancelled = false

    const doFetch = async () => {
      // Prevent duplicate immediate requests (e.g., React Strict Mode)
      if (
        lastFetchedEmployeeIdRef.current === employeeUuid &&
        Date.now() - lastFetchTimeRef.current < 1000
      ) {
        return
      }
      lastFetchedEmployeeIdRef.current = employeeUuid
      lastFetchTimeRef.current = Date.now()
      await fetchTickets(employeeUuid)
    }

    // Initial fetch
    doFetch()

    // Optional polling every 60s (max once per minute)
    const interval = setInterval(() => {
      if (!cancelled && employeeUuid) {
        fetchTickets(employeeUuid)
      }
    }, 60000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [employeeUuid])

  const fetchTickets = async (id: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/hr-tickets?employee_id=${id}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()

      if (result.success) {
        setTickets(result.tickets || [])
      } else {
        setTickets([])
      }
    } catch (error) {
      console.error('Error fetching tickets:', error)
      // Set empty array on error so UI shows "No tickets" instead of crashing
      setTickets([])
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      open: { variant: 'secondary', label: 'Open' },
      in_progress: { variant: 'default', label: 'In Progress' },
      resolved: { variant: 'success', label: 'Resolved' },
      closed: { variant: 'outline', label: 'Closed' }
    }
    return variants[status] || variants.open
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'payroll':
      case 'benefits':
        return '$'
      case 'leave':
        return '📅'
      case 'performance':
        return '📈'
      case 'workplace_issue':
        return '⚠️'
      case 'documents':
        return '📄'
      default:
        return '📝'
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy')
    } catch {
      return dateString
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My HR Cases</CardTitle>
          <CardDescription>Loading your tickets...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (tickets.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>My HR Cases</CardTitle>
            <CardDescription>Your submitted HR requests and tickets</CardDescription>
          </div>
          {onContactHr && (
            <Button size="sm" onClick={onContactHr}>
              Contact HR
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4" />
            <p>No tickets yet</p>
            <p className="text-sm mt-1">Submit a request through Contact HR to get started</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>My HR Cases</CardTitle>
            <CardDescription>Your submitted HR requests and tickets</CardDescription>
          </div>
          {onContactHr && (
            <Button size="sm" onClick={onContactHr}>
              Contact HR
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {tickets.map((ticket) => {
                const { variant, label } = getStatusBadge(ticket.status)
                return (
                  <div
                    key={ticket.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getCategoryIcon(ticket.category)}</span>
                        <h4 className="font-medium">{ticket.subject}</h4>
                        {ticket.confidential && (
                          <Badge variant="destructive" className="text-xs">Confidential</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Case ID: {ticket.id} • {ticket.category}
                        {ticket.subcategory ? ` • ${ticket.subcategory}` : ""}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Created {formatDate(ticket.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          SLA: {ticket.estimated_sla}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 ml-4">
                      <Badge variant={variant as any}>{label}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedTicket(ticket)
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Case Detail Modal */}
      {selectedTicket && (
        <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedTicket.subject}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-muted-foreground">Case ID</p>
                    <p>{selectedTicket.id}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Status</p>
                    <Badge variant={getStatusBadge(selectedTicket.status).variant as any}>
                      {getStatusBadge(selectedTicket.status).label}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Category</p>
                    <p>{selectedTicket.category}</p>
                  </div>
                  {selectedTicket.subcategory && (
                    <div>
                      <p className="font-medium text-muted-foreground">Subcategory</p>
                      <p>{selectedTicket.subcategory}</p>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-muted-foreground">Priority</p>
                    <Badge variant="outline">{selectedTicket.priority}</Badge>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Estimated SLA</p>
                    <p>{selectedTicket.estimated_sla}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Created</p>
                    <p>{formatDate(selectedTicket.created_at)}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Last Updated</p>
                    <p>{formatDate(selectedTicket.updated_at)}</p>
                  </div>
                  {selectedTicket.resolved_at && (
                    <div>
                      <p className="font-medium text-muted-foreground">Resolved</p>
                      <p>{formatDate(selectedTicket.resolved_at)}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="font-medium text-muted-foreground mb-2">Description</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>

                {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-2">Attachments</p>
                    <div className="space-y-2">
                      {selectedTicket.attachments.map((att, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm border rounded p-2">
                          <FileText className="h-4 w-4" />
                          <span>{att.filename}</span>
                          <span className="text-muted-foreground">
                            ({(att.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedTicket.assigned_to && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-2">Assigned To</p>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <p>{selectedTicket.assigned_to}</p>
                    </div>
                  </div>
                )}

                {selectedTicket.confidential && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="text-sm text-red-600 font-medium">Confidential Ticket</p>
                    <p className="text-xs text-red-500 mt-1">This ticket is only visible to authorized HR staff.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

