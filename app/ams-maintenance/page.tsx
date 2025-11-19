"use client"

import { useEffect, useMemo, useState } from "react"
import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { Trash2, Wrench } from "lucide-react"
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

type DeviceOption = {
  id: string
  name: string
  assetTag: string
  type?: string | null
  status?: string | null
}

const statusBadgeVariants: Record<MaintenanceStatus, string> = {
  Pending: "bg-amber-100 text-amber-800 border-amber-200",
  "In Progress": "bg-blue-100 text-blue-800 border-blue-200",
  Completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
}

export default function AMSMaintenancePage() {
  const user = getCurrentUser()
  const userIdentity = user?.employeeId ?? user?.email ?? null
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [filterStatus, setFilterStatus] = useState<typeof statusOptions[number]['value']>("all")
  const [reportOpen, setReportOpen] = useState(false)
  const [employeeRecord, setEmployeeRecord] = useState<any>(null)
  const [deviceOptions, setDeviceOptions] = useState<DeviceOption[]>([])
  const [deviceOptionsLoading, setDeviceOptionsLoading] = useState(true)
  const [deviceOptionsError, setDeviceOptionsError] = useState<string | null>(null)
  const [selectedDeviceId, setSelectedDeviceId] = useState("")
  const [deviceName, setDeviceName] = useState("")
  const [assetTag, setAssetTag] = useState("")
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
    setDeviceOptionsLoading(true)
    setDeviceOptionsError(null)

    const loadDevices = async () => {
        const { data, error } = await supabase
          .from("devices")
          .select("id, asset_tag, device_type, brand, model, status")
          .is("deleted_at", null)
          .in("status", ["borrowed", "assigned"])
        .order("device_type", { ascending: true })

      if (!isMounted) return

      if (error) {
        console.error("Failed to load devices for maintenance reporting", error)
        setDeviceOptions([])
        setDeviceOptionsError("Unable to load devices. Please try again later.")
      } else {
        const options: DeviceOption[] = (data ?? []).map((device: any) => ({
          id: device.id,
          name: device.model || device.brand || (device.device_type ? device.device_type.toString() : "Device"),
          assetTag: device.asset_tag ?? "—",
          type: device.device_type ?? null,
          status: device.status ?? null,
        }))
        setDeviceOptions(options)
        setDeviceOptionsError(null)
      }
      setDeviceOptionsLoading(false)
    }

    loadDevices()

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
    if (filterStatus === "all") return requests
    return requests.filter((req) => req.status === filterStatus)
  }, [requests, filterStatus])

  const handleCreateRequest = () => {
    if (!selectedDeviceId || !issueType) return
    const selectedDevice = deviceOptions.find((device) => device.id === selectedDeviceId)
    const resolvedName = selectedDevice?.name ?? deviceName
    const resolvedAssetTag = selectedDevice?.assetTag ?? assetTag
    if (!resolvedName || !resolvedAssetTag) return
    const timestamp = new Date().toISOString()
    const newRequest: MaintenanceRequest = {
      id: crypto.randomUUID(),
      deviceName: resolvedName,
      assetTag: resolvedAssetTag,
      issueType,
      description,
      status: "Pending",
      priority,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    updateRequests((prev) => [newRequest, ...prev])
    setReportOpen(false)
    setDeviceName("")
    setAssetTag("")
    setSelectedDeviceId("")
    setIssueType("")
    setDescription("")
    setPriority("Medium")
    setUploadFileName(null)
    setUploadPrompt({ open: true, deviceName: resolvedName })
  }

  const handleDeleteRequest = (id: string) => {
    updateRequests((prev) => prev.filter((req) => req.id !== id))
  }

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-navy">Maintenance Requests</h1>
          <p className="text-muted-foreground mt-2">Submit and track maintenance requests for your devices</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Maintenance History</CardTitle>
              <CardDescription>All reported issues and their resolution status</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as typeof statusOptions[number]['value'])}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
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
                className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white"
                onClick={() => setReportOpen(true)}
              >
                Report Issue
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {filteredRequests.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No maintenance requests yet. Report an issue to get started.
              </div>
            ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-[#92278F]/10 to-[#BE1E2D]/10">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-navy">Device</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-navy">Issue</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-navy">Priority</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-navy">Reported On</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-navy">Status</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-navy">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-[#25294B]">{request.deviceName}</span>
                            <span className="text-xs text-muted-foreground">Asset {request.assetTag}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-sm">
                          <div className="text-sm text-[#25294B]">{request.issueType}</div>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete maintenance request"
                            onClick={() => handleDeleteRequest(request.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                  </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-lg rounded-xl shadow-xl">
          <DialogHeader className="space-y-2 mb-4">
            <DialogTitle>Report Maintenance Issue</DialogTitle>
            <DialogDescription>Submit a maintenance ticket for your device.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {deviceOptionsError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {deviceOptionsError}
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Device</label>
              <Select
                value={selectedDeviceId}
                onValueChange={(value) => {
                  setSelectedDeviceId(value)
                  const selected = deviceOptions.find((option) => option.id === value)
                  setDeviceName(selected?.name ?? "")
                  setAssetTag(selected?.assetTag ?? "")
                }}
                disabled={deviceOptionsLoading || deviceOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      deviceOptionsLoading
                        ? "Loading devices..."
                        : deviceOptions.length === 0
                        ? "No devices available"
                        : "Select a device"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {deviceOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name} ({option.assetTag})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {assetTag ? `Asset Tag: ${assetTag}` : 'Choose a device to continue.'}
              </p>
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
              disabled={!deviceName || !assetTag || !issueType}
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={uploadPrompt.open}
        onOpenChange={(open) => {
          setUploadPrompt((prev) => ({ ...prev, open }))
          if (!open) setUploadFileName(null)
        }}
      >
        <DialogContent className="sm:max-w-lg rounded-xl shadow-xl space-y-4">
          <DialogHeader className="space-y-1">
            <DialogTitle>Upload Device Media</DialogTitle>
            <DialogDescription>
              Add a supporting picture or video for {uploadPrompt.deviceName || "this device"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="file"
              accept="image/*,video/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                setUploadFileName(file ? file.name : null)
              }}
            />
            {uploadFileName && (
              <p className="text-xs text-muted-foreground">Selected: {uploadFileName}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadPrompt({ open: false })}>
              Skip
            </Button>
            <Button onClick={() => setUploadPrompt({ open: false })}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AMSDashboardLayout>
  )
}


