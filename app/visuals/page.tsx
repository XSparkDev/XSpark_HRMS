"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { getCurrentUser, type User } from "@/lib/auth"
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Users, CalendarCheck, Laptop, DoorOpen, Wrench, Headset, FileWarning, Activity } from "lucide-react"

const COLORS = ["#a6206a", "#c9234a", "#808285", "#25294B", "#92278F", "#e31e24", "#4b5563", "#0ea5e9"]

interface VisualsSummary {
  generatedAt: string
  employees: {
    total: number
    verified: number
    unverified: number
    byRole: Array<{ name: string; value: number }>
    byStatus: Array<{ name: string; value: number }>
    headcountByMonth: Array<{ month: string; count: number }>
  }
  leave: {
    total: number
    onLeaveToday: number
    byStatus: Array<{ name: string; value: number }>
    byType: Array<{ name: string; value: number }>
    utilization: Array<{ name: string; accrued: number; used: number }>
  }
  devices: {
    total: number
    byStatus: Array<{ name: string; value: number }>
    byType: Array<{ name: string; value: number }>
  }
  bookings: {
    total: number
    thisWeek: number
    byStatus: Array<{ name: string; value: number }>
  }
  maintenance: {
    total: number
    byStatus: Array<{ name: string; value: number }>
    byPriority: Array<{ name: string; value: number }>
  }
  hrTickets: {
    total: number
    byStatus: Array<{ name: string; value: number }>
    byCategory: Array<{ name: string; value: number }>
  }
  contracts: {
    active: number
    expiringSoon: number
  }
  auditActivity: Array<{ day: string; count: number }>
}

function buildHeaders(user: User | null): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (user?.id) headers["x-user-id"] = user.id
  if (user?.role) headers["x-user-role"] = user.role
  if (user?.employeeId) headers["x-employee-id"] = user.employeeId
  else if (user?.id) headers["x-employee-id"] = user.id

  try {
    const storedSession = localStorage.getItem("xspark_session")
    if (storedSession) {
      const sessionParsed = JSON.parse(storedSession)
      if (sessionParsed?.access_token) {
        headers["Authorization"] = `Bearer ${sessionParsed.access_token}`
      }
    }
  } catch {}

  return headers
}

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
}: {
  icon: any
  label: string
  value: number | string
  sublabel?: string
}) {
  return (
    <Card>
      <CardContent className="p-6 flex items-center gap-4">
        <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-navy">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function VisualsPage() {
  const user = getCurrentUser()
  const [data, setData] = useState<VisualsSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError("")
      try {
        const res = await fetch("/api/visuals/summary", { headers: buildHeaders(user) })
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to load visuals")
        }
        setData(json.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load visuals")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-navy">Visuals</h1>
          <p className="text-muted-foreground mt-1">
            Company-wide activity across HR and Asset Management, at a glance.
          </p>
        </div>

        {isLoading && <p className="text-muted-foreground">Loading visuals...</p>}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Top-line stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Total Employees" value={data.employees.total} sublabel={`${data.employees.unverified} unverified`} />
              <StatCard icon={CalendarCheck} label="On Leave Today" value={data.leave.onLeaveToday} sublabel={`${data.leave.total} requests total`} />
              <StatCard icon={Laptop} label="Devices" value={data.devices.total} />
              <StatCard icon={DoorOpen} label="Bookings This Week" value={data.bookings.thisWeek} sublabel={`${data.bookings.total} total`} />
              <StatCard icon={Wrench} label="Maintenance Requests" value={data.maintenance.total} />
              <StatCard icon={Headset} label="HR Tickets" value={data.hrTickets.total} />
              <StatCard icon={FileWarning} label="Contracts Expiring Soon" value={data.contracts.expiringSoon} sublabel={`${data.contracts.active} active contracts`} />
              <StatCard icon={Activity} label="Audit Events (recent)" value={data.auditActivity.reduce((sum, d) => sum + d.count, 0)} />
            </div>

            {/* Employees */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Employees by Role</CardTitle>
                  <CardDescription>Headcount breakdown across the organisation</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={data.employees.byRole} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                        {data.employees.byRole.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Verification Status</CardTitle>
                  <CardDescription>ID + bank verification across all employees</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Verified", value: data.employees.verified },
                          { name: "Unverified", value: data.employees.unverified },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label
                      >
                        <Cell fill="#a6206a" />
                        <Cell fill="#e31e24" />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {data.employees.headcountByMonth.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Headcount Growth</CardTitle>
                  <CardDescription>New hires by month</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={data.employees.headcountByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#a6206a" strokeWidth={2} name="New Hires" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Leave */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Leave Requests by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.leave.byStatus}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#a6206a" name="Requests" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Leave Balance Utilization</CardTitle>
                  <CardDescription>Accrued vs. used, by leave type</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.leave.utilization}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="accrued" fill="#808285" name="Accrued" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="used" fill="#c9234a" name="Used" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Assets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Devices by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.devices.byStatus}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#25294B" name="Devices" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Maintenance Requests</CardTitle>
                  <CardDescription>By priority</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={data.maintenance.byPriority} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                        {data.maintenance.byPriority.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* HR Tickets & Audit Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>HR Tickets by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.hrTickets.byCategory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#92278F" name="Tickets" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Activity</CardTitle>
                  <CardDescription>Audit log events over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.auditActivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-10 text-center">No activity recorded yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={data.auditActivity}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="#e31e24" strokeWidth={2} name="Events" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
