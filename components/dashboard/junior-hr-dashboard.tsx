"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
} from "lucide-react"
import { format } from "date-fns"

interface Task {
  id: string
  employee_name: string
  task_type: string
  due_date: string
  status: "pending" | "in_progress" | "completed"
}

interface Escalation {
  id: string
  request_type: string
  date_submitted: string
  status: "pending" | "approved" | "rejected"
}

export function JuniorHRDashboard() {
  const [loading, setLoading] = useState(true)
  const [acknowledged, setAcknowledged] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [escalations, setEscalations] = useState<Escalation[]>([])

  useEffect(() => {
    // Check if user has already acknowledged
    const acknowledged = localStorage.getItem("hr_confidentiality_acknowledged")
    if (acknowledged === "true") {
      setAcknowledged(true)
    }
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      // Fetch tasks and escalations
      // Mock data for now
      setTasks([
        {
          id: "1",
          employee_name: "John Doe",
          task_type: "Create Profile",
          due_date: new Date(Date.now() + 86400000).toISOString(),
          status: "pending",
        },
        {
          id: "2",
          employee_name: "Jane Smith",
          task_type: "Update Info",
          due_date: new Date(Date.now() + 172800000).toISOString(),
          status: "in_progress",
        },
        {
          id: "3",
          employee_name: "Bob Johnson",
          task_type: "Create Profile",
          due_date: new Date(Date.now() + 259200000).toISOString(),
          status: "pending",
        },
      ])

      setEscalations([
        {
          id: "1",
          request_type: "Permission Request",
          date_submitted: new Date(Date.now() - 86400000).toISOString(),
          status: "pending",
        },
        {
          id: "2",
          request_type: "Access Request",
          date_submitted: new Date(Date.now() - 172800000).toISOString(),
          status: "approved",
        },
        {
          id: "3",
          request_type: "Override Request",
          date_submitted: new Date(Date.now() - 259200000).toISOString(),
          status: "rejected",
        },
      ])
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAcknowledge = () => {
    localStorage.setItem("hr_confidentiality_acknowledged", "true")
    setAcknowledged(true)
  }

  const formatDateSafe = (dateString: string | undefined | null, formatStr: string): string => {
    if (!dateString) return "—"
    try {
      const date = new Date(dateString)
      if (Number.isNaN(date.getTime())) return "—"
      return format(date, formatStr)
    } catch {
      return "—"
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
      case "completed":
        return <Badge className="bg-green-500 text-white rounded-full">Approved</Badge>
      case "rejected":
        return <Badge className="bg-red-500 text-white rounded-full">Rejected</Badge>
      case "pending":
        return <Badge className="bg-yellow-500 text-white rounded-full">Pending</Badge>
      case "in_progress":
        return <Badge className="bg-blue-500 text-white rounded-full">In Progress</Badge>
      default:
        return <Badge className="bg-gray-500 text-white rounded-full">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Confidentiality Warning Banner */}
      {!acknowledged && (
        <Card className="bg-orange-50 border-orange-200 rounded-lg shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-900">
                  You have access to sensitive data. Unauthorized disclosure will result in termination.
                </p>
              </div>
              <Button
                onClick={handleAcknowledge}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md whitespace-nowrap"
              >
                I Acknowledge
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Tasks Card */}
      <Card className="bg-white rounded-lg shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-gray-800">My Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No tasks assigned</p>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900">{task.employee_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {task.task_type} • Due: {formatDateSafe(task.due_date, "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="ml-4">{getStatusBadge(task.status)}</div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Escalation Status Card */}
      <Card className="bg-white rounded-lg shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-gray-800">Requests Sent to Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {escalations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No escalations</p>
            ) : (
              escalations.map((escalation) => (
                <div key={escalation.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900">{escalation.request_type}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Submitted: {formatDateSafe(escalation.date_submitted, "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="ml-4">{getStatusBadge(escalation.status)}</div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  )
}

