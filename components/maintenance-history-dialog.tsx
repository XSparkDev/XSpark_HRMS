"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Search, RefreshCw, Loader2, History } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type MaintenanceRequest = {
  id: string
  reference_number?: string | null
  asset_type: "device" | "resource" | "room"
  asset_id: string
  asset_name: string
  issue_title: string
  issue_description: string
  issue_category: string
  priority: string
  status: string
  outcome?: string | null
  assigned_to?: string | null
  asset_usability: string
  reported_by: string
  reported_at: string
  attachments?: string[]
}

const statusBadgeVariants: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-200",
}

const priorityBadgeVariants: Record<string, string> = {
  low: "bg-gray-100 text-gray-800 border-gray-200",
  medium: "bg-blue-100 text-blue-800 border-blue-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  critical: "bg-red-100 text-red-800 border-red-200",
}

interface MaintenanceHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MaintenanceHistoryDialog({ open, onOpenChange }: MaintenanceHistoryDialogProps) {
  const { toast } = useToast()
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [assetNamesLookup, setAssetNamesLookup] = useState<Record<string, string>>({})

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch completed and resolved maintenance requests separately
      const [completedResponse, resolvedResponse] = await Promise.all([
        fetch(`/api/maintenance-requests?limit=500&status=completed`, {
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }),
        fetch(`/api/maintenance-requests?limit=500&status=resolved`, {
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }),
      ])
      
      const completedJson = await completedResponse.json()
      const resolvedJson = await resolvedResponse.json()
      
      const completedRequests = completedResponse.ok && completedJson.success ? (completedJson.data || []) : []
      const resolvedRequests = resolvedResponse.ok && resolvedJson.success ? (resolvedJson.data || []) : []
      
      // Combine and deduplicate by ID
      const allRequests = [...completedRequests, ...resolvedRequests]
      const uniqueRequests = allRequests.filter(
        (request, index, self) => index === self.findIndex((r) => r.id === request.id)
      )
      
      // Sort by reported_at descending (most recent first)
      uniqueRequests.sort((a, b) => {
        const dateA = new Date(a.reported_at).getTime()
        const dateB = new Date(b.reported_at).getTime()
        return dateB - dateA
      })
      
      if (completedResponse.ok || resolvedResponse.ok) {
        // Fetch asset names for all requests
        const namesLookup: Record<string, string> = {}
        
        const fetchPromises = uniqueRequests.map(async (request: MaintenanceRequest) => {
          const lookupKey = `${request.asset_type}:${request.asset_id}`
          
          try {
            if (request.asset_type === "device") {
              const deviceResponse = await fetch(`/api/devices/${encodeURIComponent(request.asset_id)}`, {
                cache: "no-store",
                credentials: "include",
                headers: {
                  Accept: "application/json",
                },
              })
              const deviceJson = await deviceResponse.json()
              if (deviceResponse.ok && deviceJson.success && deviceJson.data) {
                const device = deviceJson.data
                const deviceName = device.model || device.brand || device.asset_tag || device.device_id || "Unknown Device"
                return { lookupKey, name: deviceName }
              }
            } else if (request.asset_type === "resource") {
              const resourceResponse = await fetch(`/api/resources/${encodeURIComponent(request.asset_id)}`, {
                cache: "no-store",
                credentials: "include",
                headers: {
                  Accept: "application/json",
                },
              })
              const resourceJson = await resourceResponse.json()
              if (resourceResponse.ok && resourceJson.success && resourceJson.data) {
                const resource = resourceJson.data
                const resourceName = resource.resource_name || resource.resource_id || "Unknown Resource"
                return { lookupKey, name: resourceName }
              }
            } else if (request.asset_type === "room") {
              const roomResponse = await fetch(`/api/rooms/${encodeURIComponent(request.asset_id)}`, {
                cache: "no-store",
                credentials: "include",
                headers: {
                  Accept: "application/json",
                },
              })
              const roomJson = await roomResponse.json()
              if (roomResponse.ok && roomJson.success && roomJson.data) {
                const room = roomJson.data
                const roomName = room.room_name || room.room_code || room.id || "Unknown Room"
                return { lookupKey, name: roomName }
              }
            }
          } catch (error) {
            console.error(`Failed to fetch asset name for ${lookupKey}:`, error)
          }
          return null
        })
        
        const results = await Promise.all(fetchPromises)
        results.forEach((result) => {
          if (result) {
            namesLookup[result.lookupKey] = result.name
          }
        })
        
        setAssetNamesLookup(namesLookup)
      } else {
        const errorMsg = completedJson.error || resolvedJson.error || "Failed to fetch maintenance history"
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error("Failed to fetch maintenance history:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch maintenance history",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (open) {
      fetchHistory()
    }
  }, [open, fetchHistory])

  const filteredRequests = useMemo(() => {
    if (!searchTerm) return requests
    
    const searchLower = searchTerm.toLowerCase()
    return requests.filter((request) => {
      const assetName = assetNamesLookup[`${request.asset_type}:${request.asset_id}`] || request.asset_name
      return (
        assetName.toLowerCase().includes(searchLower) ||
        request.issue_title.toLowerCase().includes(searchLower) ||
        request.issue_description.toLowerCase().includes(searchLower) ||
        request.reference_number?.toLowerCase().includes(searchLower) ||
        request.issue_category.toLowerCase().includes(searchLower)
      )
    })
  }, [requests, searchTerm, assetNamesLookup])

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateString
    }
  }

  const getAssetName = (request: MaintenanceRequest) => {
    const lookupKey = `${request.asset_type}:${request.asset_id}`
    return assetNamesLookup[lookupKey] || request.asset_name || "Unknown Asset"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Maintenance History
          </DialogTitle>
          <DialogDescription>
            View all completed and resolved maintenance requests
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search and Refresh */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search by asset, issue, reference number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={fetchHistory}
                  disabled={loading}
                  className="w-full md:w-auto"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">
                  {searchTerm ? "No maintenance requests found matching your search." : "No maintenance history available."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Asset</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Reported At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-mono text-xs">
                          {request.reference_number || request.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{getAssetName(request)}</span>
                            <span className="text-xs text-muted-foreground capitalize">
                              {request.asset_type}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            <p className="font-medium truncate">{request.issue_title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {request.issue_description}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm capitalize">
                            {request.issue_category.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={priorityBadgeVariants[request.priority] || ""}
                          >
                            {request.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={statusBadgeVariants[request.status] || ""}
                          >
                            {request.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm capitalize">
                            {request.outcome || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(request.reported_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Summary */}
          {!loading && filteredRequests.length > 0 && (
            <div className="text-sm text-muted-foreground text-center">
              Showing {filteredRequests.length} of {requests.length} maintenance requests
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
