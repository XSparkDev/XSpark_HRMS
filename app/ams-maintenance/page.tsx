"use client"

import { useEffect, useMemo, useState } from "react"
import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { Trash2, Wrench, Search, Filter, MoreVertical, X } from "lucide-react"
import { MAINTENANCE_REQUESTS_UPDATED_EVENT } from "@/lib/storage/maintenance-requests"

const statusOptions = [
  { value: "all", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "In Progress", label: "In Progress" },
  { value: "Completed", label: "Completed" },
] as const

const priorityOptions = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
] as const

const issueTypeOptions = [
  { value: "hardware", label: "Hardware malfunction" },
  { value: "battery", label: "Battery or power issue" },
  { value: "display", label: "Screen/display problem" },
  { value: "network", label: "Connectivity/network issue" },
  { value: "software", label: "Software/OS issue" },
] as const

type MaintenanceStatus = "Pending" | "In Progress" | "Completed"

type MaintenanceRequest = {
  id: string
  deviceName: string
  assetTag: string
  issueType: string
  description: string
  status: MaintenanceStatus
  priority: "Low" | "Medium" | "High"
  createdAt: string
  updatedAt: string
  expectedCompletion?: string | null
}

type ResourceOption = {
  resource_id: string
  resource_name: string
  resource_type?: string | null
  location?: string | null
}

const statusBadgeVariants: Record<MaintenanceStatus, string> = {
  Pending: "bg-[#92278F]/10 text-[#92278F] border-[#92278F]/30",
  "In Progress": "bg-blue-100 text-blue-800 border-blue-200",
  Completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
}

export default function AMSMaintenancePage() {
  const user = getCurrentUser()
  const userIdentity = user?.employeeId ?? user?.email ?? null
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [filterStatus, setFilterStatus] = useState<typeof statusOptions[number]['value']>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [reportOpen, setReportOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryData, setSummaryData] = useState<MaintenanceRequest | null>(null)
  const [employeeRecord, setEmployeeRecord] = useState<any>(null)
  const [resourceOptions, setResourceOptions] = useState<ResourceOption[]>([])
  const [resourceOptionsLoading, setResourceOptionsLoading] = useState(true)
  const [resourceOptionsError, setResourceOptionsError] = useState<string | null>(null)
  const [selectedResourceId, setSelectedResourceId] = useState("")
  const [resourceName, setResourceName] = useState("")
  const [resourceSearchTerm, setResourceSearchTerm] = useState("")
  const [issueType, setIssueType] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<typeof priorityOptions[number]['value']>("Medium")
  const [uploadPrompt, setUploadPrompt] = useState<{ open: boolean; deviceName?: string }>({ open: false })
  const [uploadFileName, setUploadFileName] = useState<string | null>(null)

  if (!user) return null

  const storageKey = userIdentity ? `maintenance_requests_${userIdentity}` : null

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedEmployee = localStorage.getItem("xspark_employee")
    if (storedEmployee) {
      try {
        setEmployeeRecord(JSON.parse(storedEmployee))
      } catch (error) {
        console.error("Failed to parse stored employee record", error)
      }
    }
  }, [userIdentity])

  useEffect(() => {
    if (!userIdentity || typeof window === "undefined") return
    let isActive = true

    const fetchEmployee = async () => {
      try {
        let authHeaders: Record<string, string> = {}
        const storedSession = localStorage.getItem("xspark_session")
        if (storedSession) {
          try {
            const sessionParsed = JSON.parse(storedSession)
            if (sessionParsed?.access_token) {
              authHeaders["Authorization"] = `Bearer ${sessionParsed.access_token}`
            }
          } catch (error) {
            console.error("Failed to parse session for auth headers", error)
          }
        }

        const response = await fetch("/api/auth/me", {
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
        })
        const json = await response.json()
        if (!isActive) return
        if (response.ok && json.success && json.data?.employee) {
          setEmployeeRecord(json.data.employee)
          try {
            localStorage.setItem("xspark_employee", JSON.stringify(json.data.employee))
          } catch {
            // ignore storage errors
          }
        }
      } catch (error) {
        if (isActive) {
          console.error("Failed to fetch employee profile", error)
        }
      }
    }

    fetchEmployee()

    return () => {
      isActive = false
    }
  }, [userIdentity])

  useEffect(() => {
    let isMounted = true
    setResourceOptionsLoading(true)
    setResourceOptionsError(null)

    const loadResources = async () => {
      try {
        const response = await fetch("/api/resources?limit=200")
        const json = await response.json()
        
        if (!isMounted) return

        if (!response.ok || !json.success) {
          throw new Error(json?.error || "Failed to load resources")
        }

        const options: ResourceOption[] = (json.data ?? []).map((resource: any) => ({
          resource_id: resource.resource_id,
          resource_name: resource.resource_name ?? "Unnamed Resource",
          resource_type: resource.resource_type ?? null,
          location: resource.location ?? null,
        }))
        setResourceOptions(options)
        setResourceOptionsError(null)
      } catch (error) {
        console.error("Failed to load resources for maintenance reporting", error)
        setResourceOptions([])
        setResourceOptionsError("Unable to load resources. Please try again later.")
      } finally {
        setResourceOptionsLoading(false)
      }
    }

    loadResources()

    return () => {
      isMounted = false
    }
  }, [])

  const updateRequests = (updater: (prev: MaintenanceRequest[]) => MaintenanceRequest[]) => {
    setRequests((prev) => {
      const next = updater(prev)
      if (storageKey && typeof window !== "undefined") {
        localStorage.setItem(storageKey, JSON.stringify(next))
      }
      return next
    })
  }

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed: MaintenanceRequest[] = JSON.parse(stored)
        setRequests(parsed)
      }
    } catch (error) {
      console.error("Failed to load maintenance requests", error)
      setRequests([])
    }
  }, [storageKey])

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return

    const syncFromStorage = () => {
      try {
        const stored = localStorage.getItem(storageKey)
        if (stored) {
          const parsed: MaintenanceRequest[] = JSON.parse(stored)
          setRequests(parsed)
        }
      } catch (error) {
        console.error("Failed to sync maintenance requests", error)
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        syncFromStorage()
      }
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener(MAINTENANCE_REQUESTS_UPDATED_EVENT, syncFromStorage)

    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(MAINTENANCE_REQUESTS_UPDATED_EVENT, syncFromStorage)
    }
  }, [storageKey])

  const filteredRequests = useMemo(() => {
    let filtered = requests

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(req => 
        req.deviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.assetTag.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.issueType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((req) => req.status === filterStatus)
    }

    return filtered
  }, [requests, filterStatus, searchTerm])

  const handleCreateRequest = () => {
    if (!selectedResourceId || !issueType) return
    const selectedResource = resourceOptions.find((resource) => resource.resource_id === selectedResourceId)
    const resolvedName = selectedResource?.resource_name ?? resourceName
    if (!resolvedName) return
    const timestamp = new Date().toISOString()
    const newRequest: MaintenanceRequest = {
      id: crypto.randomUUID(),
      deviceName: resolvedName,
      assetTag: selectedResourceId,
      issueType,
      description,
      status: "Pending",
      priority,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    updateRequests((prev) => [newRequest, ...prev])
    setSummaryData(newRequest)
    setReportOpen(false)
    setSummaryOpen(true)
    setResourceName("")
    setSelectedResourceId("")
    setResourceSearchTerm("")
    setIssueType("")
    setDescription("")
    setPriority("Medium")
    setUploadFileName(null)
  }

  const handleDeleteRequest = (id: string) => {
    updateRequests((prev) => prev.filter((req) => req.id !== id))
  }

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-navy">Maintenance Requests</h1>
            <p className="text-muted-foreground mt-2">Submit and track maintenance requests for your devices</p>
          </div>
          <Button
            className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white"
            onClick={() => setReportOpen(true)}
          >
            Report Issue
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search maintenance requests..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 uniform-input"
                  />
                </div>
              </div>
              <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as typeof statusOptions[number]['value'])}>
                <SelectTrigger className="w-full md:w-48 uniform-input">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setFilterStatus("all")
                  setSearchTerm("")
                }}
              >
                <Filter className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Maintenance Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle>Maintenance Requests ({filteredRequests.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredRequests.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No maintenance requests yet. Report an issue to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100">
                    <TableHead>Device</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Reported On</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{request.deviceName}</span>
                          <span className="text-sm text-muted-foreground">Asset {request.assetTag}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-sm">
                        <div className="text-sm">{request.issueType}</div>
                        {request.description && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {request.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {request.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(request.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${statusBadgeVariants[request.status]}`}>
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Maintenance request actions"
                              className="hover:bg-muted focus-visible:ring-2 focus-visible:ring-[#92278F]/30"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.preventDefault()
                                handleDeleteRequest(request.id)
                              }}
                              className="text-[#BE1E2D] hover:bg-[#BE1E2D]/10"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={reportOpen}
        onOpenChange={(open) => {
          setReportOpen(open)
          if (!open) {
            // Reset form when modal closes
            setResourceSearchTerm("")
            setSelectedResourceId("")
            setResourceName("")
            setIssueType("")
            setDescription("")
            setPriority("Medium")
          }
        }}
      >
        <DialogContent className="sm:max-w-lg rounded-xl shadow-xl">
          <DialogHeader className="space-y-2 mb-4">
            <DialogTitle>Report Maintenance Issue</DialogTitle>
            <DialogDescription>Submit a maintenance ticket for your device.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {resourceOptionsError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {resourceOptionsError}
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Resource</label>
              <div className="space-y-2">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder={
                      resourceOptionsLoading
                        ? "Loading resources..."
                        : resourceOptions.length === 0
                        ? "No resources available"
                        : "Search resources by name, type, or location..."
                    }
                    value={resourceSearchTerm}
                    onChange={(e) => {
                      const newValue = e.target.value
                      setResourceSearchTerm(newValue)
                      // Clear selection if search term doesn't match selected resource
                      if (selectedResourceId) {
                        const selected = resourceOptions.find((r) => r.resource_id === selectedResourceId)
                        if (selected && !selected.resource_name?.toLowerCase().includes(newValue.toLowerCase()) && newValue !== selected.resource_name) {
                          setSelectedResourceId("")
                          setResourceName("")
                        }
                      }
                    }}
                    disabled={resourceOptionsLoading || resourceOptions.length === 0}
                    className="pl-8 pr-8"
                  />
                  {resourceSearchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setResourceSearchTerm("")
                        setSelectedResourceId("")
                        setResourceName("")
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Filtered Resource Results Panel */}
                {!resourceOptionsLoading && resourceOptions.length > 0 && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto bg-white">
                    {(() => {
                      const filteredResources = resourceOptions.filter((option) => {
                        if (!resourceSearchTerm.trim()) return true
                        const searchLower = resourceSearchTerm.toLowerCase()
                        return (
                          option.resource_name?.toLowerCase().includes(searchLower) ||
                          option.resource_id?.toLowerCase().includes(searchLower) ||
                          option.resource_type?.toLowerCase().includes(searchLower) ||
                          option.location?.toLowerCase().includes(searchLower)
                        )
                      }).slice(0, resourceSearchTerm.trim() ? undefined : 10) // Limit to 10 when no search term

                      if (filteredResources.length === 0) {
                        return (
                          <div className="p-4 text-sm text-muted-foreground text-center">
                            No resources found matching "{resourceSearchTerm}"
                          </div>
                        )
                      }

                      return (
                        <div className="p-1">
                          {!resourceSearchTerm.trim() && resourceOptions.length > 10 && (
                            <div className="p-2 text-xs text-muted-foreground text-center border-b">
                              Showing first 10 resources. Type to search for more...
                            </div>
                          )}
                          {filteredResources.map((option) => {
                            const isSelected = selectedResourceId === option.resource_id
                            return (
                              <div
                                key={option.resource_id}
                                onClick={() => {
                                  setSelectedResourceId(option.resource_id)
                                  setResourceName(option.resource_name ?? "")
                                  setResourceSearchTerm(option.resource_name ?? "")
                                }}
                                className={`
                                  p-3 rounded-md cursor-pointer transition-colors
                                  ${isSelected
                                    ? "bg-[#92278F]/10 border border-[#92278F]/30"
                                    : "hover:bg-muted/50 border border-transparent"
                                  }
                                `}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-[#25294B] truncate">
                                      {option.resource_name}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                      {option.resource_type && (
                                        <span className="truncate">{option.resource_type}</span>
                                      )}
                                      {option.resource_type && option.location && (
                                        <span>•</span>
                                      )}
                                      {option.location && (
                                        <span className="truncate">{option.location}</span>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      ID: {option.resource_id}
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#92278F] flex items-center justify-center">
                                      <svg
                                        className="w-3 h-3 text-white"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* Selected Resource Info */}
                {selectedResourceId && (
                  <div className="p-2 rounded-md bg-[#92278F]/5 border border-[#92278F]/20">
                    <p className="text-xs text-muted-foreground">
                      Selected: <span className="font-medium text-[#25294B]">{resourceName}</span>
                      <span className="text-muted-foreground ml-1">({selectedResourceId})</span>
                    </p>
                  </div>
                )}

                {/* Helper Text */}
                {!selectedResourceId && (
                  <p className="text-xs text-muted-foreground">
                    {resourceOptionsLoading
                      ? "Loading resources..."
                      : resourceOptions.length === 0
                      ? "No resources available. Please try again later."
                      : "Search and select a resource to continue."}
                  </p>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Issue Type</label>
              <Select
                value={issueType}
                onValueChange={(value) => {
                  const option = issueTypeOptions.find((item) => item.value === value)
                  setIssueType(option?.label ?? value)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select issue type" />
                </SelectTrigger>
                <SelectContent>
                  {issueTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm">Priority</label>
              <Select value={priority} onValueChange={(value) => setPriority(value as typeof priorityOptions[number]['value'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm">Description</label>
              <Textarea
                rows={4}
                placeholder="Add any additional details to help the supervisor assess the issue."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button
              className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white"
              onClick={handleCreateRequest}
              disabled={!resourceName || !selectedResourceId || !issueType}
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="sm:max-w-lg rounded-xl shadow-xl space-y-4">
          <DialogHeader className="space-y-1">
            <DialogTitle>Maintenance Request Summary</DialogTitle>
            <DialogDescription>Your maintenance request has been submitted successfully.</DialogDescription>
          </DialogHeader>
          {summaryData && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#58595B]">Resource:</span>
                <span className="font-medium text-[#25294B]">{summaryData.deviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#58595B]">Resource ID:</span>
                <span className="font-medium text-[#25294B]">{summaryData.assetTag}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#58595B]">Issue Type:</span>
                <span className="font-medium text-[#25294B]">{summaryData.issueType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#58595B]">Priority:</span>
                <span className="font-medium text-[#25294B]">{summaryData.priority}</span>
              </div>
              {summaryData.description && (
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Description:</span>
                  <span className="font-medium text-[#25294B] text-right max-w-xs">{summaryData.description}</span>
                </div>
              )}
              <div className="flex justify-between mt-4">
                <span className="text-[#58595B]">Status:</span>
                <Badge variant="outline" className={`text-xs ${statusBadgeVariants[summaryData.status]}`}>
                  {summaryData.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-[#58595B]">Submitted On:</span>
                <span className="font-medium text-[#25294B]">
                  {new Date(summaryData.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          )}
          <div className="flex justify-end mt-4">
            <Button
              className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
              onClick={() => {
                setSummaryOpen(false)
                setSummaryData(null)
              }}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AMSDashboardLayout>
  )
}


