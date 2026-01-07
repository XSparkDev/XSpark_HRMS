"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth"
import { Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

type HistoryItem = {
  id: string
  deviceId: string
  issue: string
  fixSummary: string
  technician: string
  completionDate: string
  completionTime: string
  status: "Repaired" | "Replaced" | "Not Fixed"
}

export default function MaintenanceHistoryPage() {
  const user = getCurrentUser()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [filters, setFilters] = useState({ device: "", technician: "", date: "" })

  if (!user) return null

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("maintenance_history") || "[]")
    setItems(stored)
  }, [])

  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      const byDevice = filters.device ? i.deviceId.toLowerCase().includes(filters.device.toLowerCase()) : true
      const byTech = filters.technician ? i.technician.toLowerCase().includes(filters.technician.toLowerCase()) : true
      const byDate = filters.date ? i.completionDate === filters.date : true
      return byDevice && byTech && byDate
    })
  }, [items, filters])

  const handleDelete = (id: string) => {
    const updated = items.filter((item) => item.id !== id)
    setItems(updated)
    localStorage.setItem("maintenance_history", JSON.stringify(updated))
  }

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-navy">Maintenance History</h1>
          <p className="text-muted-foreground mt-2">Completed maintenance tasks</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter by device, technician, or date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Device Name</Label>
                <Input placeholder="Search device" value={filters.device} onChange={(e) => setFilters({ ...filters, device: e.target.value })} />
              </div>
              <div>
                <Label>Technician</Label>
                <Input placeholder="Search technician" value={filters.technician} onChange={(e) => setFilters({ ...filters, technician: e.target.value })} />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold text-navy">Completed Tasks</h2>
          </div>
          <div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Fix Summary</TableHead>
                    <TableHead>Technician</TableHead>
                    <TableHead>Completion Date</TableHead>
                    <TableHead>Completion Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.deviceId}</TableCell>
                      <TableCell className="max-w-xs truncate">{i.issue}</TableCell>
                      <TableCell className="max-w-xs truncate">{i.fixSummary}</TableCell>
                      <TableCell>{i.technician}</TableCell>
                      <TableCell>{i.completionDate}</TableCell>
                      <TableCell>{i.completionTime}</TableCell>
                      <TableCell>{i.status}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(i.id)}
                          aria-label="Delete entry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </AMSDashboardLayout>
  )
}








