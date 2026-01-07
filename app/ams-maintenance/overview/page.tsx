"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Eye, Settings } from "lucide-react"

type Request = {
  id: string
  employeeId: string
  deviceId: string
  issueCategory: string
  description: string
  priority: string
  dateReported: string
  timeReported: string
  status: "Pending" | "In Progress" | "Completed" | "Cancelled"
  assignedTechnician?: string
}

export default function MaintenanceOverviewPage() {
  const user = getCurrentUser()
  const [requests, setRequests] = useState<Request[]>([])
  const [tab, setTab] = useState<"All" | "Pending" | "In Progress" | "Completed">("All")

  if (!user) return null

  useEffect(() => {
    const stored = localStorage.getItem("maintenance_requests")
    if (stored) setRequests(JSON.parse(stored))
  }, [])

  const statusBadge = (status: Request["status"]) => {
    const map: Record<Request["status"], string> = {
      Pending: "bg-[#92278F]/10 text-[#92278F]",
      "In Progress": "bg-blue-100 text-blue-800",
      Completed: "bg-green-100 text-green-800",
      Cancelled: "bg-gray-200 text-gray-700",
    }
    return <Badge className={map[status] || ""}>{status}</Badge>
  }

  const filtered = requests.filter((r) => (tab === "All" ? true : r.status === tab))

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-navy">Maintenance Requests Overview</h1>
          <p className="text-muted-foreground mt-2">View and manage all reported issues</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Requests</CardTitle>
            <CardDescription>Filter and manage requests</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList>
                <TabsTrigger value="All">All</TabsTrigger>
                <TabsTrigger value="Pending">Pending</TabsTrigger>
                <TabsTrigger value="In Progress">In Progress</TabsTrigger>
                <TabsTrigger value="Completed">Completed</TabsTrigger>
              </TabsList>
              <TabsContent value={tab} className="mt-4">
                {filtered.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Device</TableHead>
                          <TableHead>Issue</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Reported By</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Technician</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.deviceId}</TableCell>
                            <TableCell className="max-w-xs truncate">{r.issueCategory} — {r.description}</TableCell>
                            <TableCell>{statusBadge(r.status)}</TableCell>
                            <TableCell>{r.employeeId}</TableCell>
                            <TableCell>{new Date(r.dateReported).toLocaleDateString()}</TableCell>
                            <TableCell>{r.timeReported}</TableCell>
                            <TableCell>{r.assignedTechnician || "—"}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm"><Eye className="h-3 w-3 mr-1" /> View Details</Button>
                                <Button variant="default" size="sm"><Settings className="h-3 w-3 mr-1" /> Update Status</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No requests found.</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AMSDashboardLayout>
  )
}





















