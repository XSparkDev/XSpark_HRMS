"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { BORROW_REQUESTS_UPDATED_EVENT } from "@/lib/storage/device-history"
import { MAINTENANCE_REQUESTS_UPDATED_EVENT } from "@/lib/storage/maintenance-requests"
import {
  CheckCircle2,
  ClipboardList,
  Eye,
  Laptop,
  Monitor,
  RefreshCw,
  UserPlus,
  Wrench,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type BorrowRequest = {
  id: string
  employeeName: string
  employeeId: string
  deviceName: string
  assetTag: string
  borrowDate: string
  purpose: string
  status: string
}

type ReturnRequest = {
  id: string
  employeeName: string
  employeeId: string
  deviceName: string
  returnDate: string
  deviceCondition: string
  status: string
}

type MaintenanceTicket = {
  id: string
  deviceName: string
  issueType: string
  reportedBy: string
  date: string
  status: string
}

type DeviceStats = {
  total: number
  borrowed: number
  maintenance: number
}

export default function SupervisorDashboardPage() {
  const user = getCurrentUser()
  const { toast } = useToast()
  const [deviceStats, setDeviceStats] = useState<DeviceStats>({ total: 0, borrowed: 0, maintenance: 0 })
  const [borrowRequests, setBorrowRequests] = useState<BorrowRequest[]>([])
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([])
  const [maintenanceTickets, setMaintenanceTickets] = useState<MaintenanceTicket[]>([])
  const [loadingBorrow, setLoadingBorrow] = useState(true)

  const loadBorrowData = useCallback(() => {
    if (typeof window === "undefined") return
    setLoadingBorrow(true)
    try {
      const borrow = JSON.parse(localStorage.getItem("borrowRequests") || "[]") as BorrowRequest[]
      const returns = JSON.parse(localStorage.getItem("returnRequests") || "[]") as ReturnRequest[]
      setBorrowRequests(borrow)
      setReturnRequests(returns)
    } catch (error) {
      console.error("Failed to load borrow/return requests", error)
    } finally {
      setLoadingBorrow(false)
    }
  }, [])

  const loadMaintenanceTickets = useCallback(() => {
    if (typeof window === "undefined") return
    const collected: MaintenanceTicket[] = []
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("maintenance_requests_")) {
        try {
          const entries = JSON.parse(localStorage.getItem(key) || "[]")
          entries.forEach((entry: any) => {
            if (entry?.deviceName) {
              collected.push({
                id: entry.id || `${key}-${entry.deviceName}`,
                deviceName: entry.deviceName,
                issueType: entry.issueType || entry.category || "General",
                reportedBy: entry.reportedBy || entry.employeeName || "Team Member",
                date: entry.createdAt || entry.updatedAt || new Date().toISOString(),
                status: entry.status || "Pending",
              })
            }
          })
        } catch (error) {
          console.error("Failed to parse maintenance tickets", error)
        }
      }
    })
    setMaintenanceTickets(collected.filter((ticket) => ticket.status !== "Completed"))
  }, [])

  const fetchDeviceStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("devices").select("status")
      if (error) {
        console.error("Failed to fetch device stats", error)
        return
      }
      const statuses = data ?? []
      setDeviceStats({
        total: statuses.length,
        borrowed: statuses.filter((device) => device.status?.toLowerCase().includes("borrow")).length,
        maintenance: statuses.filter((device) => device.status?.toLowerCase().includes("maintenance")).length,
      })
    } catch (error) {
      console.error("Failed to fetch device stats", error)
    }
  }, [])

  useEffect(() => {
    loadBorrowData()
    loadMaintenanceTickets()
    fetchDeviceStats()

    const storageHandler = () => loadBorrowData()
    window.addEventListener("storage", storageHandler)
    window.addEventListener(BORROW_REQUESTS_UPDATED_EVENT, storageHandler as EventListener)

    const maintenanceHandler = () => loadMaintenanceTickets()
    window.addEventListener(MAINTENANCE_REQUESTS_UPDATED_EVENT, maintenanceHandler as EventListener)

    const interval = setInterval(loadBorrowData, 8000)

    return () => {
      window.removeEventListener("storage", storageHandler)
      window.removeEventListener(BORROW_REQUESTS_UPDATED_EVENT, storageHandler as EventListener)
      window.removeEventListener(MAINTENANCE_REQUESTS_UPDATED_EVENT, maintenanceHandler as EventListener)
      clearInterval(interval)
    }
  }, [fetchDeviceStats, loadBorrowData, loadMaintenanceTickets])

  const pendingBorrowRequests = useMemo(
    () => borrowRequests.filter((request) => request.status === "Pending Approval"),
    [borrowRequests],
  )

  const todayKey = new Date().toDateString()
  const devicesBorrowedToday = borrowRequests.filter(
    (request) => new Date(request.borrowDate).toDateString() === todayKey,
  ).length
  const devicesReturnedToday = returnRequests.filter(
    (request) => request.status === "Returned" && new Date(request.returnDate).toDateString() === todayKey,
  ).length
  const overdueDevices = borrowRequests.filter((request) => {
    if (!request.borrowDate) return false
    const borrowedAt = new Date(request.borrowDate)
    const diffDays = (Date.now() - borrowedAt.getTime()) / (1000 * 60 * 60 * 24)
    return request.status === "Borrowed" && diffDays > 7
  }).length

  const deviceOverviewCards = [
    {
      label: "Total Devices",
      value: deviceStats.total,
      badge: "Devices",
      gradient: "from-[#3B4370] via-[#4F5A86] to-[#5E6FAF]",
    },
    {
      label: "Borrowed Devices",
      value: deviceStats.borrowed,
      badge: "Borrowed",
      gradient: "from-[#92278F] via-[#A6206A] to-[#BE1E2D]",
    },
    {
      label: "Pending Borrow Requests",
      value: pendingBorrowRequests.length,
      badge: "Awaiting",
      gradient: "from-[#58595B] via-[#44454F] to-[#25294B]",
    },
    {
      label: "Under Maintenance",
      value: deviceStats.maintenance,
      badge: "Maintenance",
      gradient: "from-[#A14FB5] via-[#C26FDB] to-[#D6343A]",
    },
  ]

  const quickActions = [
    {
      label: "Approve Borrow Request",
      href: "/ams-supervisor/pending-approvals",
      icon: CheckCircle2,
      background: "from-[#FEE4F2] via-[#F8E8FF] to-[#F2F8FF]",
      iconColor: "#BE1E2D",
    },
    {
      label: "Assign Device",
      href: "/ams-devices",
      icon: UserPlus,
      background: "from-[#F3F0FF] via-[#E8F4FF] to-[#FDF3FF]",
      iconColor: "#3B4370",
    },
    {
      label: "View Device Availability",
      href: "/ams-dashboard",
      icon: Monitor,
      background: "from-[#EEF7FF] via-[#F2F2FF] to-[#FFF0F6]",
      iconColor: "#25294B",
    },
    {
      label: "Report Maintenance Issue",
      href: "/ams-maintenance",
      icon: Wrench,
      background: "from-[#FFF2EB] via-[#FFE7F1] to-[#F9ECFF]",
      iconColor: "#A14FB5",
    },
  ]

  const handleApprove = useCallback(
    (id: string, type: "borrow" | "return") => {
      if (typeof window === "undefined") return
      if (type === "borrow") {
        const next = borrowRequests.map((request) =>
          request.id === id ? { ...request, status: "Borrowed" } : request,
        )
        localStorage.setItem("borrowRequests", JSON.stringify(next))
        setBorrowRequests(next)
        toast({ title: "Request approved", description: "Borrow request approved successfully." })
      } else {
        const next = returnRequests.map((request) =>
          request.id === id ? { ...request, status: "Returned" } : request,
        )
        localStorage.setItem("returnRequests", JSON.stringify(next))
        setReturnRequests(next)
        toast({ title: "Return approved", description: "Return request approved successfully." })
      }
      loadBorrowData()
    },
    [borrowRequests, returnRequests, loadBorrowData, toast],
  )

  const handleReject = useCallback(
    (id: string, type: "borrow" | "return") => {
      if (typeof window === "undefined") return
      if (type === "borrow") {
        const next = borrowRequests.map((request) =>
          request.id === id ? { ...request, status: "Rejected" } : request,
        )
        localStorage.setItem("borrowRequests", JSON.stringify(next))
        setBorrowRequests(next)
      } else {
        const next = returnRequests.map((request) =>
          request.id === id ? { ...request, status: "Rejected" } : request,
        )
        localStorage.setItem("returnRequests", JSON.stringify(next))
        setReturnRequests(next)
      }
      toast({ title: "Request rejected", description: "The request has been rejected." })
      loadBorrowData()
    },
    [borrowRequests, returnRequests, loadBorrowData, toast],
  )

  if (!user || user.role !== "supervisor") {
    return null
  }

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <Card className="gradient-primary text-white border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-wide text-white/80">Supervisor Dashboard</p>
                <h2 className="text-3xl font-bold mb-1">{`Welcome back, ${user.name}!`}</h2>
                <p className="text-white/85">Monitor device usage, approvals, and maintenance activity.</p>
              </div>
              <Badge className="bg-white/15 text-white px-4 py-2 text-sm">Supervisor View</Badge>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {deviceOverviewCards.map((card) => (
            <Card
              key={card.label}
              className={`border-0 text-white shadow-lg bg-gradient-to-br ${card.gradient} rounded-2xl`}
            >
              <CardHeader className="pb-2">
                <CardDescription className="uppercase text-xs tracking-wide text-white/80">
                  {card.label}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-3xl font-semibold">{card.value}</p>
                <Badge className="bg-white/20 text-white text-xs border border-white/30">{card.badge}</Badge>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href}>
              <Card
                className={`border-0 bg-gradient-to-br ${action.background} shadow-sm transition hover:-translate-y-1 hover:shadow-md rounded-2xl`}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 shadow-sm"
                    style={{ color: action.iconColor }}
                  >
                    <action.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#25294B]">{action.label}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 border border-[#F3E4FF] bg-gradient-to-br from-white via-[#F9F4FF] to-[#FFF8F0] shadow-sm rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-[#25294B]">Pending Borrow Requests</CardTitle>
                <CardDescription className="text-[#58595B]">Requests awaiting your approval</CardDescription>
              </div>
              <Link href="/ams-supervisor/pending-approvals">
                <Button variant="outline" size="sm" className="gap-1">
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loadingBorrow ? (
                <p className="text-sm text-muted-foreground">Loading requests…</p>
              ) : pendingBorrowRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending borrow requests.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Requested Date</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingBorrowRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.employeeName}</TableCell>
                          <TableCell>{request.deviceName}</TableCell>
                          <TableCell>{new Date(request.borrowDate).toLocaleDateString()}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{request.purpose || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button size="sm" variant="outline" onClick={() => handleApprove(request.id, "borrow")}>
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleReject(request.id, "borrow")}
                            >
                              Reject
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

          <Card className="border border-[#F3E4FF] bg-gradient-to-br from-white via-[#F3F5FF] to-[#FFF4FA] shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="text-[#25294B]">Device Activity</CardTitle>
              <CardDescription className="text-[#58595B]">Snapshot of device movement today</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Devices borrowed today</p>
                  <p className="text-2xl font-semibold text-[#25294B]">{devicesBorrowedToday}</p>
                </div>
                <Laptop className="h-6 w-6 text-[#92278F]" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Devices returned today</p>
                  <p className="text-2xl font-semibold text-[#25294B]">{devicesReturnedToday}</p>
                </div>
                <ClipboardList className="h-6 w-6 text-[#BE1E2D]" />
              </div>
              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <p className="text-sm text-muted-foreground">Overdue devices</p>
                  <p className="text-2xl font-semibold text-[#25294B]">{overdueDevices}</p>
                </div>
                <Wrench className="h-6 w-6 text-[#F59E0B]" />
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="border border-[#E4E4E7]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Open Maintenance Tickets</CardTitle>
              <CardDescription>Track reported hardware issues</CardDescription>
            </div>
            <Link href="/ams-maintenance">
              <Button variant="outline" size="sm">
                <Eye className="mr-2 h-4 w-4" />
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {maintenanceTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open maintenance tickets.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Issue Type</TableHead>
                      <TableHead>Reported By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenanceTickets.slice(0, 6).map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-medium">{ticket.deviceName}</TableCell>
                        <TableCell>{ticket.issueType}</TableCell>
                        <TableCell>{ticket.reportedBy}</TableCell>
                        <TableCell>{new Date(ticket.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {ticket.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/ams-maintenance?ticket=${ticket.id}`}>View Details</Link>
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
    </AMSDashboardLayout>
  )
}
