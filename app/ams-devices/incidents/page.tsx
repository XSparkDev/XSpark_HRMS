"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { getCurrentUser } from "@/lib/auth"
import { ArrowLeft, AlertTriangle, Plus, Eye, CheckCircle2, Package } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"

type Incident = {
  incident_id: string
  resource_id: string
  reported_by: string
  incident_type: "Damage" | "Malfunction" | "Lost" | "Other"
  description: string
  severity: "Low" | "Medium" | "High" | "Critical" | null
  status: "Open" | "In Progress" | "Resolved" | "Closed" | null
  resolved_by: string | null
  resolved_at: string | null
  resolution_notes: string | null
  created_at: string
  updated_at: string
}

export default function DeviceIncidentsPage() {
  const user = getCurrentUser()
  const [showAddModal, setShowAddModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [incidents, setIncidents] = useState<Incident[]>([])
  
  const [formData, setFormData] = useState({
    resource_id: "",
    incident_type: "" as Incident["incident_type"] | "",
    description: "",
    severity: "" as Incident["severity"] | "",
  })

  if (!user) return null

  // Load incidents from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("device_incidents")
    if (stored) {
      setIncidents(JSON.parse(stored))
    }
  }, [])

  const handleAddIncident = () => {
    const newIncident: Incident = {
      incident_id: `INC-${Date.now()}`,
      resource_id: formData.resource_id,
      reported_by: user.id || "",
      incident_type: formData.incident_type as Incident["incident_type"],
      description: formData.description,
      severity: formData.severity as Incident["severity"] || null,
      status: "Open",
      resolved_by: null,
      resolved_at: null,
      resolution_notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const updated = [...incidents, newIncident]
    setIncidents(updated)
    localStorage.setItem("device_incidents", JSON.stringify(updated))
    setFormData({ resource_id: "", incident_type: "", description: "", severity: "" })
    setShowAddModal(false)
  }

  const handleViewIncident = (incident: Incident) => {
    setSelectedIncident(incident)
    setShowViewModal(true)
  }

  const handleResolveIncident = (incident: Incident) => {
    setSelectedIncident(incident)
    setShowResolveModal(true)
  }

  const handleResolveSubmit = () => {
    if (!selectedIncident) return
    const updated = incidents.map((inc) =>
      inc.incident_id === selectedIncident.incident_id
        ? {
            ...inc,
            status: "Resolved" as const,
            resolved_by: user.id || "",
            resolved_at: new Date().toISOString(),
            resolution_notes: "Resolved by supervisor",
          }
        : inc
    )
    setIncidents(updated)
    localStorage.setItem("device_incidents", JSON.stringify(updated))
    setShowResolveModal(false)
    setSelectedIncident(null)
  }

  const getSeverityBadge = (severity: Incident["severity"]) => {
    if (!severity) return <Badge variant="outline">Not Set</Badge>
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      Low: "default",
      Medium: "secondary",
      High: "destructive",
      Critical: "destructive",
    }
    return <Badge variant={variants[severity] || "outline"}>{severity}</Badge>
  }

  const getStatusBadge = (status: Incident["status"]) => {
    if (!status) return <Badge variant="outline">Open</Badge>
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      Open: "outline",
      "In Progress": "secondary",
      Resolved: "default",
      Closed: "outline",
    }
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>
  }

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-navy">Device Incidents</h1>
            <p className="text-muted-foreground mt-2">Report and manage device incidents</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setShowAddModal(true)} className="gradient-primary text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Incident
            </Button>
            {selectedIncident && (
              <>
                <Button onClick={() => handleViewIncident(selectedIncident)} variant="outline">
                  <Eye className="h-4 w-4 mr-2" />
                  View Incident
                </Button>
                <Button onClick={() => handleResolveIncident(selectedIncident)} variant="default">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Resolve Incident
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Incidents Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Incident Records
            </CardTitle>
            <CardDescription>All reported device incidents</CardDescription>
          </CardHeader>
          <CardContent>
            {incidents.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Incident ID</TableHead>
                      <TableHead>Resource ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {incidents.map((incident) => (
                    <TableRow key={incident.incident_id}>
                      <TableCell className="font-mono text-sm">{incident.incident_id}</TableCell>
                      <TableCell>{incident.resource_id}</TableCell>
                      <TableCell>{incident.incident_type}</TableCell>
                      <TableCell className="max-w-xs truncate">{incident.description}</TableCell>
                      <TableCell>{getSeverityBadge(incident.severity)}</TableCell>
                      <TableCell>{getStatusBadge(incident.status)}</TableCell>
                      <TableCell>{new Date(incident.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleViewIncident(incident)}>
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          {incident.status !== "Resolved" && incident.status !== "Closed" && (
                            <Button size="sm" onClick={() => handleResolveIncident(incident)}>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Resolve
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-navy mb-2">No Incidents Found</h3>
                <p className="text-muted-foreground mb-4">No incidents have been reported yet.</p>
                <Button onClick={() => setShowAddModal(true)} className="gradient-primary text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Incident
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Incident Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Incident</DialogTitle>
              <DialogDescription>Report a new device incident</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Resource ID *</Label>
                <Input
                  value={formData.resource_id}
                  onChange={(e) => setFormData({ ...formData, resource_id: e.target.value })}
                  placeholder="Enter resource/device ID"
                />
              </div>
              <div>
                <Label>Incident Type *</Label>
                <Select value={formData.incident_type} onValueChange={(v) => setFormData({ ...formData, incident_type: v as Incident["incident_type"] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Damage">Damage</SelectItem>
                    <SelectItem value="Malfunction">Malfunction</SelectItem>
                    <SelectItem value="Lost">Lost</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the incident..."
                  rows={4}
                />
              </div>
              <div>
                <Label>Severity (Optional)</Label>
                <Select value={formData.severity} onValueChange={(v) => setFormData({ ...formData, severity: v as Incident["severity"] })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddIncident} className="gradient-primary text-white" disabled={!formData.resource_id || !formData.incident_type || !formData.description}>
                  Add Incident
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Incident Modal */}
        {showViewModal && selectedIncident && (
          <Card>
            <CardHeader>
              <CardTitle>View Incident</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Incident ID</Label>
                  <p className="font-mono text-sm">{selectedIncident.incident_id}</p>
                </div>
                <div>
                  <Label>Resource ID</Label>
                  <p>{selectedIncident.resource_id}</p>
                </div>
                <div>
                  <Label>Type</Label>
                  <p>{selectedIncident.incident_type}</p>
                </div>
                <div>
                  <Label>Severity</Label>
                  <div>{getSeverityBadge(selectedIncident.severity)}</div>
                </div>
                <div>
                  <Label>Status</Label>
                  <div>{getStatusBadge(selectedIncident.status)}</div>
                </div>
                <div>
                  <Label>Created</Label>
                  <p>{new Date(selectedIncident.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <p className="text-sm">{selectedIncident.description}</p>
              </div>
              {selectedIncident.resolution_notes && (
                <div>
                  <Label>Resolution Notes</Label>
                  <p className="text-sm">{selectedIncident.resolution_notes}</p>
                </div>
              )}
              <Button variant="outline" onClick={() => setShowViewModal(false)}>
                Close
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Resolve Incident Modal */}
        {showResolveModal && selectedIncident && (
          <Card>
            <CardHeader>
              <CardTitle>Resolve Incident</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Incident ID</Label>
                <p className="font-mono text-sm">{selectedIncident.incident_id}</p>
              </div>
              <div>
                <Label>Resolution Notes</Label>
                <Textarea placeholder="Add resolution notes..." rows={4} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleResolveSubmit} className="gradient-primary text-white">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Resolve Incident
                </Button>
                <Button variant="outline" onClick={() => setShowResolveModal(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AMSDashboardLayout>
  )
}
