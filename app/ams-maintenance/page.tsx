"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
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
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { getCurrentUser } from "@/lib/auth"
import { Trash2, Wrench, Search, Filter, MoreVertical, X, Upload, Image as ImageIcon, AlertCircle, Eye, Pencil, Paperclip, History, Users } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { MaintenanceHistoryDialog } from "@/components/maintenance-history-dialog"
import { AvailableTechniciansDialog } from "@/components/available-technicians-dialog"

const statusOptions = [
  { value: "all", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "resolved", label: "Resolved" },
] as const

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const

const issueCategoryOptions = [
  { value: "hardware", label: "Hardware malfunction" },
  { value: "battery", label: "Battery or power issue" },
  { value: "display", label: "Screen/display problem" },
  { value: "network", label: "Connectivity/network issue" },
  { value: "software", label: "Software/OS issue" },
  { value: "facilities", label: "Facilities/maintenance" },
  { value: "other", label: "Other" },
] as const

const assetUsabilityOptions = [
  { value: "usable", label: "Fully usable" },
  { value: "partially_usable", label: "Partially usable" },
  { value: "not_usable", label: "Not usable" },
] as const

type AssetType = "device" | "resource" | "room"

type MaintenanceRequest = {
  id: string
  reference_number?: string | null
  asset_type: AssetType
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

type DeviceOption = {
  device_id: string
  asset_tag: string | null
  model: string | null
  brand: string | null
  device_type: string | null
}

type ResourceOption = {
  resource_id: string
  resource_name: string
  resource_type?: string | null
  location?: string | null
}

type RoomOption = {
  id: string
  room_name: string
  room_code?: string | null
  location?: string | null
  floor?: string | null
}

const statusBadgeVariants: Record<string, string> = {
  submitted: "bg-[#92278F]/10 text-[#92278F] border-[#92278F]/30",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-200",
}

export default function AMSMaintenancePage() {
  const user = getCurrentUser()
  const { toast } = useToast()
  const userIdentity = user?.employeeId ?? user?.email ?? null
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<typeof statusOptions[number]['value']>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [assetNamesLookup, setAssetNamesLookup] = useState<Record<string, string>>({})
  
  // Modal state
  const [reportOpen, setReportOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [attachEvidenceOpen, setAttachEvidenceOpen] = useState(false)
  const [evidenceAttachments, setEvidenceAttachments] = useState<File[]>([])
  const [evidencePreviews, setEvidencePreviews] = useState<string[]>([])
  const [uploadingEvidence, setUploadingEvidence] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [techniciansDialogOpen, setTechniciansDialogOpen] = useState(false)
  
  // Edit form state
  const [editIssueTitle, setEditIssueTitle] = useState("")
  const [editIssueDescription, setEditIssueDescription] = useState("")
  const [editIssueCategory, setEditIssueCategory] = useState("")
  const [editPriority, setEditPriority] = useState<typeof priorityOptions[number]['value']>("medium")
  const [editAssetUsability, setEditAssetUsability] = useState<typeof assetUsabilityOptions[number]['value']>("usable")
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState(false)
  
  // Asset selection state
  const [assetType, setAssetType] = useState<AssetType>("device")
  const [assetSearchTerm, setAssetSearchTerm] = useState("")
  const [selectedAsset, setSelectedAsset] = useState<{
    type: AssetType
    id: string
    name: string
  } | null>(null)
  
  // Asset options
  const [deviceOptions, setDeviceOptions] = useState<DeviceOption[]>([])
  const [resourceOptions, setResourceOptions] = useState<ResourceOption[]>([])
  const [roomOptions, setRoomOptions] = useState<RoomOption[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  
  // Form fields
  const [issueTitle, setIssueTitle] = useState("")
  const [issueDescription, setIssueDescription] = useState("")
  const [issueCategory, setIssueCategory] = useState("")
  const [priority, setPriority] = useState<typeof priorityOptions[number]['value']>("medium")
  const [assetUsability, setAssetUsability] = useState<typeof assetUsabilityOptions[number]['value']>("usable")
  const [attachments, setAttachments] = useState<File[]>([])
  const [attachmentPreviews, setAttachmentPreviews] = useState<string[]>([])
  
  // Form validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!user) return null

  const isSupervisor = user.role === "supervisor"

  // Fetch maintenance requests from API - only for current user
  useEffect(() => {
    const fetchRequests = async () => {
      if (!userIdentity) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const params = new URLSearchParams({
          limit: "100",
          reportedBy: userIdentity,
        })
        const response = await fetch(`/api/maintenance-requests?${params.toString()}`, {
          cache: "no-store",
        })
        const json = await response.json()
        
        if (response.ok && json.success) {
          const fetchedRequests = json.data || []
          setRequests(fetchedRequests)
          
          // Fetch asset names for all requests
          const namesLookup: Record<string, string> = {}
          
          // Fetch asset names in parallel
          const fetchPromises = fetchedRequests.map(async (request: MaintenanceRequest) => {
            const lookupKey = `${request.asset_type}:${request.asset_id}`
            
            try {
              if (request.asset_type === 'device') {
                const deviceResponse = await fetch(`/api/devices/${encodeURIComponent(request.asset_id)}`, {
                  cache: "no-store",
                })
                const deviceJson = await deviceResponse.json()
                if (deviceResponse.ok && deviceJson.success && deviceJson.data) {
                  const device = deviceJson.data
                  const deviceName = device.model || device.brand || device.asset_tag || device.device_id || "Unknown Device"
                  return { lookupKey, name: deviceName }
                }
              } else if (request.asset_type === 'resource') {
                // Fetch all resources and find the matching one
                const resourceResponse = await fetch(`/api/resources?limit=200`, {
                  cache: "no-store",
                })
                const resourceJson = await resourceResponse.json()
                if (resourceResponse.ok && resourceJson.success && Array.isArray(resourceJson.data)) {
                  const resource = resourceJson.data.find((r: any) => r.resource_id === request.asset_id)
                  if (resource) {
                    return { lookupKey, name: resource.resource_name || resource.resource_id || "Unknown Resource" }
                  }
                }
              } else if (request.asset_type === 'room') {
                const roomResponse = await fetch(`/api/rooms?limit=200`, {
                  cache: "no-store",
                })
                const roomJson = await roomResponse.json()
                if (roomResponse.ok && roomJson.success && Array.isArray(roomJson.data)) {
                  const room = roomJson.data.find((r: any) => r.id === request.asset_id)
                  if (room) {
                    return { lookupKey, name: room.room_name || room.id || "Unknown Room" }
                  }
                }
              }
            } catch (error) {
              console.error(`Error fetching ${request.asset_type} name for ${request.asset_id}:`, error)
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
          console.error("Failed to fetch maintenance requests:", json.error)
          toast({
            variant: "destructive",
            title: "Error",
            description: json.error || "Failed to load maintenance requests",
          })
        }
      } catch (error) {
        console.error("Error fetching maintenance requests:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load maintenance requests",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchRequests()
  }, [toast, userIdentity])

  // Fetch assets based on asset type
  useEffect(() => {
    const fetchAssets = async () => {
      if (!reportOpen) return
      
      setAssetsLoading(true)
      try {
        switch (assetType) {
          case "device": {
            const response = await fetch("/api/devices?limit=200", { cache: "no-store" })
            const json = await response.json()
            if (response.ok && json.success) {
              setDeviceOptions(json.data || [])
            }
            break
          }
          case "resource": {
            const response = await fetch("/api/resources?limit=200", { cache: "no-store" })
            const json = await response.json()
            if (response.ok && json.success) {
              setResourceOptions(json.data || [])
            }
            break
          }
          case "room": {
            const response = await fetch("/api/rooms?limit=200", { cache: "no-store" })
            const json = await response.json()
            if (response.ok && json.success) {
              setRoomOptions(json.data || [])
            }
            break
          }
        }
      } catch (error) {
        console.error(`Error fetching ${assetType}s:`, error)
      } finally {
        setAssetsLoading(false)
      }
    }

    fetchAssets()
  }, [assetType, reportOpen])

  // Reset form when modal closes
  useEffect(() => {
    if (!reportOpen) {
      setAssetType("device")
      setAssetSearchTerm("")
      setSelectedAsset(null)
      setIssueTitle("")
      setIssueDescription("")
      setIssueCategory("")
      setPriority("medium")
      setAssetUsability("usable")
      setAttachments([])
      setAttachmentPreviews([])
      setErrors({})
    }
  }, [reportOpen])

  const filteredRequests = useMemo(() => {
    let filtered = requests

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(req => 
        req.asset_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.issue_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.issue_description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((req) => req.status === filterStatus)
    }

    return filtered
  }, [requests, filterStatus, searchTerm])

  // Get filtered assets based on search
  const filteredAssets = useMemo(() => {
    if (!assetSearchTerm.trim()) {
      switch (assetType) {
        case "device":
          return deviceOptions.slice(0, 10)
        case "resource":
          return resourceOptions.slice(0, 10)
        case "room":
          return roomOptions.slice(0, 10)
      }
    }

    const searchLower = assetSearchTerm.toLowerCase()
    switch (assetType) {
      case "device":
        return deviceOptions.filter(device => 
          device.asset_tag?.toLowerCase().includes(searchLower) ||
          device.model?.toLowerCase().includes(searchLower) ||
          device.brand?.toLowerCase().includes(searchLower) ||
          device.device_type?.toLowerCase().includes(searchLower)
        )
      case "resource":
        return resourceOptions.filter(resource =>
          resource.resource_name?.toLowerCase().includes(searchLower) ||
          resource.resource_id?.toLowerCase().includes(searchLower) ||
          resource.resource_type?.toLowerCase().includes(searchLower) ||
          resource.location?.toLowerCase().includes(searchLower)
        )
      case "room":
        return roomOptions.filter(room =>
          room.room_name?.toLowerCase().includes(searchLower) ||
          room.room_code?.toLowerCase().includes(searchLower) ||
          room.location?.toLowerCase().includes(searchLower) ||
          room.floor?.toLowerCase().includes(searchLower)
        )
    }
    return []
  }, [assetType, assetSearchTerm, deviceOptions, resourceOptions, roomOptions])

  // Handle asset selection
  const handleAssetSelect = (asset: DeviceOption | ResourceOption | RoomOption) => {
    if (assetType === "device") {
      const device = asset as DeviceOption
      setSelectedAsset({
        type: "device",
        id: device.device_id,
        name: device.model || device.brand || device.asset_tag || "Unknown Device",
      })
      setAssetSearchTerm(device.model || device.brand || device.asset_tag || "")
    } else if (assetType === "resource") {
      const resource = asset as ResourceOption
      setSelectedAsset({
        type: "resource",
        id: resource.resource_id,
        name: resource.resource_name,
      })
      setAssetSearchTerm(resource.resource_name)
    } else if (assetType === "room") {
      const room = asset as RoomOption
      setSelectedAsset({
        type: "room",
        id: room.id,
        name: room.room_name,
      })
      setAssetSearchTerm(room.room_name)
    }
  }

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return

    const files = Array.from(e.target.files)
    const maxFiles = 5
    const maxSize = 10 * 1024 * 1024 // 10MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']

    if (attachments.length + files.length > maxFiles) {
      toast({
        variant: "destructive",
        title: "Too many files",
        description: `Maximum ${maxFiles} files allowed`,
      })
      return
    }

    const validFiles: File[] = []
    const previews: string[] = []

    files.forEach(file => {
      if (file.size > maxSize) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: `${file.name} exceeds 10MB limit`,
        })
        return
      }

      if (!allowedTypes.includes(file.type)) {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: `${file.name} is not a valid image file`,
        })
        return
      }

      validFiles.push(file)
      previews.push(URL.createObjectURL(file))
    })

    setAttachments(prev => [...prev, ...validFiles])
    setAttachmentPreviews(prev => [...prev, ...previews])
  }

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
    URL.revokeObjectURL(attachmentPreviews[index])
    setAttachmentPreviews(prev => prev.filter((_, i) => i !== index))
  }

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!selectedAsset) {
      newErrors.asset = "Please select an asset"
    }

    if (!issueTitle.trim()) {
      newErrors.issueTitle = "Issue title is required"
    }

    if (!issueDescription.trim()) {
      newErrors.issueDescription = "Issue description is required"
    }

    if (!issueCategory) {
      newErrors.issueCategory = "Issue category is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm() || !selectedAsset || !userIdentity) return

    setSubmitting(true)
    try {
      // Upload attachments first
      const attachmentUrls: string[] = []
      if (attachments.length > 0) {
        // TODO: Implement file upload to storage
        // For now, we'll skip attachment uploads or use a placeholder
        // You'll need to implement file upload to your storage service
        console.log("Attachments to upload:", attachments.map(f => f.name))
      }

      // Prepare payload
      const payload = {
        asset_type: selectedAsset.type,
        asset_id: selectedAsset.id,
        reported_by: userIdentity,
        issue_title: issueTitle.trim(),
        issue_description: issueDescription.trim(),
        issue_category: issueCategory,
        priority: priority,
        status: "submitted",
        asset_usability: assetUsability,
        attachments: attachmentUrls.length > 0 ? attachmentUrls : null,
      }

      // Submit to API
      const response = await fetch("/api/maintenance-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error || "Failed to submit maintenance request")
      }

      toast({
        title: "Success",
        description: "Maintenance request submitted successfully",
      })

      // Refresh requests list - only for current user
      if (userIdentity) {
        const params = new URLSearchParams({
          limit: "100",
          reportedBy: userIdentity,
        })
        const refreshResponse = await fetch(`/api/maintenance-requests?${params.toString()}`, {
          cache: "no-store",
        })
        const refreshJson = await refreshResponse.json()
        if (refreshResponse.ok && refreshJson.success) {
          setRequests(refreshJson.data || [])
        }
      }

      // Close modal
      setReportOpen(false)
    } catch (error) {
      console.error("Error submitting maintenance request:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit maintenance request",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteRequest = async (id: string) => {
    if (!confirm("Are you sure you want to delete this maintenance request?")) return

    try {
      // TODO: Implement DELETE endpoint
      // For now, just remove from local state
      setRequests(prev => prev.filter(req => req.id !== id))
      toast({
        title: "Deleted",
        description: "Maintenance request deleted",
      })
    } catch (error) {
      console.error("Error deleting maintenance request:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete maintenance request",
      })
    }
  }

  const handleViewDetails = (request: MaintenanceRequest) => {
    setSelectedRequest(request)
    setViewDetailsOpen(true)
  }

  const handleEdit = (request: MaintenanceRequest) => {
    setSelectedRequest(request)
    setEditIssueTitle(request.issue_title || "")
    setEditIssueDescription(request.issue_description || "")
    setEditIssueCategory(request.issue_category || "")
    setEditPriority((request.priority as typeof priorityOptions[number]['value']) || "medium")
    setEditAssetUsability((request.asset_usability as typeof assetUsabilityOptions[number]['value']) || "usable")
    setEditErrors({})
    setEditOpen(true)
  }

  // Validate edit form
  const validateEditForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!editIssueTitle.trim()) {
      newErrors.issueTitle = "Issue title is required"
    }

    if (!editIssueDescription.trim()) {
      newErrors.issueDescription = "Issue description is required"
    }

    if (!editIssueCategory) {
      newErrors.issueCategory = "Issue category is required"
    }

    setEditErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle edit form submission
  const handleEditSubmit = async () => {
    if (!validateEditForm() || !selectedRequest) return

    setEditing(true)
    try {
      // TODO: Implement PATCH endpoint for updating maintenance requests
      // For now, just show success message
      toast({
        title: "Request updated",
        description: "Maintenance request has been updated successfully",
      })

      // Refresh requests list - only for current user
      if (userIdentity) {
        const params = new URLSearchParams({
          limit: "100",
          reportedBy: userIdentity,
        })
        const refreshResponse = await fetch(`/api/maintenance-requests?${params.toString()}`, {
          cache: "no-store",
        })
        const refreshJson = await refreshResponse.json()
        if (refreshResponse.ok && refreshJson.success) {
          setRequests(refreshJson.data || [])
        }
      }

      setEditOpen(false)
    } catch (error) {
      console.error("Error updating maintenance request:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update maintenance request",
      })
    } finally {
      setEditing(false)
    }
  }

  const handleAttachEvidence = (request: MaintenanceRequest) => {
    setSelectedRequest(request)
    setEvidenceAttachments([])
    setEvidencePreviews([])
    setAttachEvidenceOpen(true)
  }

  // Handle evidence file upload
  const handleEvidenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return

    const files = Array.from(e.target.files)
    const maxFiles = 5
    const maxSize = 10 * 1024 * 1024 // 10MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']

    if (evidenceAttachments.length + files.length > maxFiles) {
      toast({
        variant: "destructive",
        title: "Too many files",
        description: `Maximum ${maxFiles} files allowed`,
      })
      return
    }

    const validFiles: File[] = []
    const previews: string[] = []

    files.forEach(file => {
      if (file.size > maxSize) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: `${file.name} exceeds 10MB limit`,
        })
        return
      }

      if (!allowedTypes.includes(file.type)) {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: `${file.name} is not a valid image file`,
        })
        return
      }

      validFiles.push(file)
      previews.push(URL.createObjectURL(file))
    })

    setEvidenceAttachments(prev => [...prev, ...validFiles])
    setEvidencePreviews(prev => [...prev, ...previews])
  }

  // Remove evidence attachment
  const removeEvidenceAttachment = (index: number) => {
    URL.revokeObjectURL(evidencePreviews[index])
    setEvidenceAttachments(prev => prev.filter((_, i) => i !== index))
    setEvidencePreviews(prev => prev.filter((_, i) => i !== index))
  }

  // Handle evidence upload submission
  const handleEvidenceSubmit = async () => {
    if (!selectedRequest || evidenceAttachments.length === 0) {
      toast({
        variant: "destructive",
        title: "No files selected",
        description: "Please select at least one image to upload",
      })
      return
    }

    setUploadingEvidence(true)
    try {
      // TODO: Implement file upload to storage and update maintenance request
      console.log("Uploading evidence for request:", selectedRequest.id)
      console.log("Files:", evidenceAttachments.map(f => f.name))
      
      // For now, just show success message
      toast({
        title: "Evidence uploaded",
        description: `${evidenceAttachments.length} file(s) uploaded successfully`,
      })

      // Clear and close
      setEvidenceAttachments([])
      setEvidencePreviews([])
      setAttachEvidenceOpen(false)
    } catch (error) {
      console.error("Error uploading evidence:", error)
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Failed to upload evidence files. Please try again.",
      })
    } finally {
      setUploadingEvidence(false)
    }
  }

  // Get asset display name from lookup or fallback
  const getAssetDisplayName = (request: MaintenanceRequest) => {
    const lookupKey = `${request.asset_type}:${request.asset_id}`
    const fetchedName = assetNamesLookup[lookupKey]
    
    if (fetchedName) {
      return fetchedName
    }
    
    // Fallback: use asset_name if available, otherwise asset type
    if (request.asset_name) {
      return request.asset_name
    }
    
    return request.asset_type.charAt(0).toUpperCase() + request.asset_type.slice(1)
  }

  // Generate 6-digit reference number (100000-999999)
  const generateReferenceNumber = (request: MaintenanceRequest): string => {
    if (request.reference_number) {
      return request.reference_number
    }
    // Generate a consistent 6-digit number based on request ID hash
    const hash = request.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return String(Math.abs(hash) % 900000 + 100000).padStart(6, '0')
  }

  // Determine outcome based on supervisor assignment
  const getOutcome = (request: MaintenanceRequest): string => {
    // If no supervisor has viewed/assigned the request, outcome is "unresolved"
    if (!request.assigned_to) {
      return "unresolved"
    }
    // If supervisor has viewed/assigned, return the actual outcome (fixed/replaced) or "unresolved" as default
    return request.outcome || "unresolved"
  }

  // Get current date for auto-fill
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-navy">Maintenance Requests</h1>
            <p className="text-muted-foreground mt-2">Submit and track maintenance requests for your assets</p>
          </div>
          <div className="flex gap-2">
            {isSupervisor && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setTechniciansDialogOpen(true)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Available Technicians
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setHistoryDialogOpen(true)}
                >
                  <History className="h-4 w-4 mr-2" />
                  Maintenance History
                </Button>
              </>
            )}
          <Button
            className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
            onClick={() => setReportOpen(true)}
          >
            <Wrench className="h-4 w-4 mr-2" />
            Report Issue
          </Button>
          </div>
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
            {loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Loading maintenance requests...
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No maintenance requests yet. Report an issue to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100">
                    <TableHead>Reference Number</TableHead>
                    <TableHead>Asset Type</TableHead>
                    <TableHead>Date Reported</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <span className="font-medium font-mono">{generateReferenceNumber(request)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">{request.asset_type}</span>
                      </TableCell>
                      <TableCell>
                        {request.reported_at ? new Date(request.reported_at).toLocaleDateString() : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${statusBadgeVariants[request.status] || ""}`}>
                          {request.status?.replace("_", " ") || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">{getOutcome(request)}</span>
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
                                handleViewDetails(request)
                              }}
                              className="text-slate-700 hover:bg-slate-50"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.preventDefault()
                                handleEdit(request)
                              }}
                              className="text-slate-700 hover:bg-slate-50"
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.preventDefault()
                                handleAttachEvidence(request)
                              }}
                              className="text-slate-700 hover:bg-slate-50"
                            >
                              <Paperclip className="h-4 w-4 mr-2" />
                              Attach Evidence
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.preventDefault()
                                if (!['submitted', 'in_progress', 'completed'].includes(request.status)) {
                                handleDeleteRequest(request.id)
                                }
                              }}
                              disabled={['submitted', 'in_progress', 'completed'].includes(request.status)}
                              className="text-[#BE1E2D] hover:bg-[#BE1E2D]/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
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

      {/* Report Issue Modal */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report Maintenance Issue</DialogTitle>
            <DialogDescription>
              Submit a maintenance request for an asset. All required fields must be completed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Asset Type Selection */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Asset Type <span className="text-red-500">*</span></Label>
              <Select value={assetType} onValueChange={(value) => {
                setAssetType(value as AssetType)
                setSelectedAsset(null)
                setAssetSearchTerm("")
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="device">Device</SelectItem>
                  <SelectItem value="resource">Resource</SelectItem>
                  <SelectItem value="room">Room</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Asset Selection */}
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Select {assetType.charAt(0).toUpperCase() + assetType.slice(1)} <span className="text-red-500">*</span>
              </Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder={`Search ${assetType}s...`}
                    value={assetSearchTerm}
                    onChange={(e) => setAssetSearchTerm(e.target.value)}
                    className="pl-8 pr-8"
                    disabled={assetsLoading}
                  />
                  {assetSearchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssetSearchTerm("")
                        setSelectedAsset(null)
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Asset Results */}
                {!assetsLoading && filteredAssets.length > 0 && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto bg-white">
                    <div className="p-1">
                      {filteredAssets.map((asset) => {
                        const isSelected = selectedAsset?.id === (assetType === "device" ? (asset as DeviceOption).device_id : assetType === "resource" ? (asset as ResourceOption).resource_id : (asset as RoomOption).id)
                        return (
                          <div
                            key={assetType === "device" ? (asset as DeviceOption).device_id : assetType === "resource" ? (asset as ResourceOption).resource_id : (asset as RoomOption).id}
                            onClick={() => handleAssetSelect(asset)}
                            className={`p-3 rounded-md cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-[#92278F]/10 border border-[#92278F]/30"
                                : "hover:bg-muted/50 border border-transparent"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                {assetType === "device" && (
                                  <>
                                    <div className="font-medium text-sm text-[#25294B] truncate">
                                      {(asset as DeviceOption).model || (asset as DeviceOption).brand || (asset as DeviceOption).asset_tag || "Unknown Device"}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {(asset as DeviceOption).asset_tag && `Tag: ${(asset as DeviceOption).asset_tag}`}
                                      {(asset as DeviceOption).device_type && ` • ${(asset as DeviceOption).device_type}`}
                                    </div>
                                  </>
                                )}
                                {assetType === "resource" && (
                                  <>
                                    <div className="font-medium text-sm text-[#25294B] truncate">
                                      {(asset as ResourceOption).resource_name}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      ID: {(asset as ResourceOption).resource_id}
                                      {(asset as ResourceOption).resource_type && ` • ${(asset as ResourceOption).resource_type}`}
                                    </div>
                                  </>
                                )}
                                {assetType === "room" && (
                                  <>
                                    <div className="font-medium text-sm text-[#25294B] truncate">
                                      {(asset as RoomOption).room_name}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {(asset as RoomOption).room_code && `Code: ${(asset as RoomOption).room_code}`}
                                      {(asset as RoomOption).location && ` • ${(asset as RoomOption).location}`}
                                    </div>
                                  </>
                                )}
                              </div>
                              {isSelected && (
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#92278F] flex items-center justify-center">
                                  <svg className="w-3 h-3 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                    <path d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {selectedAsset && (
                  <div className="p-2 rounded-md bg-[#92278F]/5 border border-[#92278F]/20">
                    <p className="text-xs text-muted-foreground">
                      Selected: <span className="font-medium text-[#25294B]">{selectedAsset.name}</span>
                    </p>
                  </div>
                )}

                {errors.asset && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.asset}
                  </p>
                )}
              </div>
            </div>

            {/* Auto-filled Fields (Read-only) */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <Label className="text-xs text-muted-foreground">Asset Type</Label>
                <Input value={selectedAsset ? selectedAsset.type.charAt(0).toUpperCase() + selectedAsset.type.slice(1) : ""} readOnly className="bg-background" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Asset Name</Label>
                <Input value={selectedAsset?.name || ""} readOnly className="bg-background" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Asset ID</Label>
                <Input value={selectedAsset?.id || ""} readOnly className="bg-background" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Reported By</Label>
                <Input value={user?.name || userIdentity || ""} readOnly className="bg-background" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Date Reported</Label>
                <Input value={currentDate} readOnly className="bg-background" />
              </div>
            </div>

            {/* Issue Title */}
            <div>
              <Label className="text-sm font-medium">
                Issue Title <span className="text-red-500">*</span>
              </Label>
              <Input
                value={issueTitle}
                onChange={(e) => {
                  setIssueTitle(e.target.value)
                  if (errors.issueTitle) setErrors(prev => ({ ...prev, issueTitle: "" }))
                }}
                placeholder="Brief description of the issue"
                className={errors.issueTitle ? "border-red-500" : ""}
              />
              {errors.issueTitle && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.issueTitle}
                </p>
              )}
            </div>

            {/* Issue Description */}
            <div>
              <Label className="text-sm font-medium">
                Issue Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={issueDescription}
                onChange={(e) => {
                  setIssueDescription(e.target.value)
                  if (errors.issueDescription) setErrors(prev => ({ ...prev, issueDescription: "" }))
                }}
                placeholder="Provide detailed information about the issue..."
                rows={4}
                className={errors.issueDescription ? "border-red-500" : ""}
              />
              {errors.issueDescription && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.issueDescription}
                </p>
              )}
            </div>

            {/* Issue Category */}
            <div>
              <Label className="text-sm font-medium">
                Issue Category <span className="text-red-500">*</span>
              </Label>
              <Select
                value={issueCategory}
                onValueChange={(value) => {
                  setIssueCategory(value)
                  if (errors.issueCategory) setErrors(prev => ({ ...prev, issueCategory: "" }))
                }}
              >
                <SelectTrigger className={errors.issueCategory ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select issue category" />
                </SelectTrigger>
                <SelectContent>
                  {issueCategoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.issueCategory && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.issueCategory}
                </p>
              )}
            </div>

            {/* Priority Level */}
            <div>
              <Label className="text-sm font-medium">Priority Level</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as typeof priorityOptions[number]['value'])}>
                <SelectTrigger>
                  <SelectValue />
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

            {/* Asset Usability */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Asset Usability</Label>
              <RadioGroup value={assetUsability} onValueChange={(value) => setAssetUsability(value as typeof assetUsabilityOptions[number]['value'])}>
                {assetUsabilityOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Label htmlFor={option.value} className="font-normal cursor-pointer">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Attachments */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Attachments (Optional)</Label>
              <div className="space-y-2">
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    id="attachment-upload"
                  />
                  <label
                    htmlFor="attachment-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Click to upload photos or drag and drop
                    </span>
                    <span className="text-xs text-muted-foreground">
                      PNG, JPG, GIF up to 10MB (max 5 files)
                    </span>
                  </label>
                </div>

                {/* Attachment Previews */}
                {attachmentPreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {attachmentPreviews.map((preview, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={preview}
                          alt={`Attachment ${index + 1}`}
                          className="w-full h-24 object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                          {attachments[index]?.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setReportOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
              onClick={handleSubmit}
              disabled={submitting || !selectedAsset || !issueTitle.trim() || !issueDescription.trim() || !issueCategory}
            >
              {submitting ? "Submitting..." : "Submit Issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog - Summary with exit icon only */}
      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Maintenance Request Details</DialogTitle>
            <DialogDescription>Summary of the maintenance request</DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Reference Number</Label>
                  <p className="font-medium font-mono">{generateReferenceNumber(selectedRequest)}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Asset ID</Label>
                  <p className="font-medium">{selectedRequest.asset_id}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Date Reported</Label>
                  <p className="font-medium">
                    {selectedRequest.reported_at ? new Date(selectedRequest.reported_at).toLocaleDateString() : "N/A"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Status</Label>
                  <Badge variant="outline" className={`text-xs mt-1 ${statusBadgeVariants[selectedRequest.status] || ""}`}>
                    {selectedRequest.status?.replace("_", " ") || "Unknown"}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Outcome</Label>
                  <p className="font-medium capitalize">{getOutcome(selectedRequest)}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Asset</Label>
                  <p className="font-medium">{getAssetDisplayName(selectedRequest)}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Asset Type</Label>
                  <p className="font-medium capitalize">{selectedRequest.asset_type}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Issue Title</Label>
                  <p className="font-medium">{selectedRequest.issue_title}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Category</Label>
                  <p className="font-medium capitalize">{selectedRequest.issue_category || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Priority</Label>
                  <Badge variant="secondary" className="text-xs capitalize mt-1">
                    {selectedRequest.priority}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Asset Usability</Label>
                  <p className="font-medium capitalize">{selectedRequest.asset_usability?.replace("_", " ") || "N/A"}</p>
                </div>
              </div>
              {selectedRequest.issue_description && (
                <div>
                  <Label className="text-sm text-muted-foreground">Description</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{selectedRequest.issue_description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog 
        open={editOpen} 
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditErrors({})
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Maintenance Request</DialogTitle>
            <DialogDescription>Update the maintenance request details</DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 mt-4">
              {/* Read-only Asset Information */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">Asset</Label>
                  <Input value={getAssetDisplayName(selectedRequest)} readOnly className="bg-background" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Asset Type</Label>
                  <Input value={selectedRequest.asset_type.charAt(0).toUpperCase() + selectedRequest.asset_type.slice(1)} readOnly className="bg-background" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Reported By</Label>
                  <Input value={selectedRequest.reported_by || ""} readOnly className="bg-background" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Reported On</Label>
                  <Input value={selectedRequest.reported_at ? new Date(selectedRequest.reported_at).toLocaleDateString() : "N/A"} readOnly className="bg-background" />
                </div>
              </div>

              {/* Issue Title */}
              <div>
                <Label className="text-sm font-medium">
                  Issue Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={editIssueTitle}
                  onChange={(e) => {
                    setEditIssueTitle(e.target.value)
                    if (editErrors.issueTitle) setEditErrors(prev => ({ ...prev, issueTitle: "" }))
                  }}
                  placeholder="Brief description of the issue"
                  className={editErrors.issueTitle ? "border-red-500" : ""}
                />
                {editErrors.issueTitle && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {editErrors.issueTitle}
                  </p>
                )}
              </div>

              {/* Issue Description */}
              <div>
                <Label className="text-sm font-medium">
                  Issue Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  value={editIssueDescription}
                  onChange={(e) => {
                    setEditIssueDescription(e.target.value)
                    if (editErrors.issueDescription) setEditErrors(prev => ({ ...prev, issueDescription: "" }))
                  }}
                  placeholder="Provide detailed information about the issue..."
                  rows={4}
                  className={editErrors.issueDescription ? "border-red-500" : ""}
                />
                {editErrors.issueDescription && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {editErrors.issueDescription}
                  </p>
                )}
              </div>

              {/* Issue Category */}
              <div>
                <Label className="text-sm font-medium">
                  Issue Category <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={editIssueCategory}
                  onValueChange={(value) => {
                    setEditIssueCategory(value)
                    if (editErrors.issueCategory) setEditErrors(prev => ({ ...prev, issueCategory: "" }))
                  }}
                >
                  <SelectTrigger className={editErrors.issueCategory ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select issue category" />
                  </SelectTrigger>
                  <SelectContent>
                    {issueCategoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editErrors.issueCategory && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {editErrors.issueCategory}
                  </p>
                )}
              </div>

              {/* Priority Level */}
              <div>
                <Label className="text-sm font-medium">Priority Level</Label>
                <Select value={editPriority} onValueChange={(value) => setEditPriority(value as typeof priorityOptions[number]['value'])}>
                  <SelectTrigger>
                    <SelectValue />
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

              {/* Asset Usability */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Asset Usability</Label>
                <RadioGroup value={editAssetUsability} onValueChange={(value) => setEditAssetUsability(value as typeof assetUsabilityOptions[number]['value'])}>
                  {assetUsabilityOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={`edit-${option.value}`} />
                      <Label htmlFor={`edit-${option.value}`} className="font-normal cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editing}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
              onClick={handleEditSubmit}
              disabled={editing || !editIssueTitle.trim() || !editIssueDescription.trim() || !editIssueCategory}
            >
              {editing ? "Updating..." : "Update Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attach Evidence Dialog */}
      <Dialog 
        open={attachEvidenceOpen} 
        onOpenChange={(open) => {
          setAttachEvidenceOpen(open)
          if (!open) {
            // Clean up previews when dialog closes
            evidencePreviews.forEach(preview => URL.revokeObjectURL(preview))
            setEvidenceAttachments([])
            setEvidencePreviews([])
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Attach Evidence</DialogTitle>
            <DialogDescription>Upload evidence files for this maintenance request</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Upload Evidence (Optional)</Label>
              <div className="space-y-2">
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleEvidenceFileChange}
                    className="hidden"
                    id="evidence-upload"
                    disabled={uploadingEvidence}
                  />
                  <label
                    htmlFor="evidence-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Click to upload photos or drag and drop
                    </span>
                    <span className="text-xs text-muted-foreground">
                      PNG, JPG, GIF up to 10MB (max 5 files)
                    </span>
                  </label>
                </div>

                {/* Evidence Preview */}
                {evidencePreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {evidencePreviews.map((preview, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={preview}
                          alt={`Evidence ${index + 1}`}
                          className="w-full h-24 object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => removeEvidenceAttachment(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={uploadingEvidence}
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                          {evidenceAttachments[index]?.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setAttachEvidenceOpen(false)}
              disabled={uploadingEvidence}
            >
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
              onClick={handleEvidenceSubmit}
              disabled={uploadingEvidence || evidenceAttachments.length === 0}
            >
              {uploadingEvidence ? "Uploading..." : "Upload Evidence"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance History Dialog */}
      {isSupervisor && (
        <>
          <MaintenanceHistoryDialog
            open={historyDialogOpen}
            onOpenChange={setHistoryDialogOpen}
          />
          <AvailableTechniciansDialog
            open={techniciansDialogOpen}
            onOpenChange={setTechniciansDialogOpen}
          />
        </>
      )}
    </AMSDashboardLayout>
  )
}
