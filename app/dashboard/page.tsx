"use client"

import { memo, useMemo, useRef, useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ContactHrModal } from "@/components/contact-hr-modal"
import { MyHrCases } from "@/components/my-hr-cases"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { getCurrentUser } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as DatePicker } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { addDays, format, formatDistanceToNow } from "date-fns"
import { calculateLeaveBalance, calculateWorkingDays, getLeaveTypeDisplayName } from "@/lib/validation/leave"
import { useToast } from "@/hooks/use-toast"
import {
  Calendar,
  FileText,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Upload,
  MessageSquare,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { SuperAdminDashboard } from "@/components/dashboard/super-admin-dashboard"
import { AdminDashboard } from "@/components/dashboard/admin-dashboard"
import { JuniorHRDashboard } from "@/components/dashboard/junior-hr-dashboard"
import { isEmployeeFullyVerified } from "@/lib/employee-verification"

// Lazy load heavy components
const Notes2HighAlert = dynamic(
  () => import("@/components/notes2-high-alert").then((mod) => ({ default: mod.Notes2HighAlert })),
  {
  loading: () => <div className="h-32" />,
    ssr: false,
  },
)

const Notes2Scheduled = dynamic(
  () => import("@/components/notes2-scheduled").then((mod) => ({ default: mod.Notes2Scheduled })),
  {
  loading: () => <div className="h-32" />,
    ssr: false,
  },
)

export default function DashboardPage() {
  const router = useRouter()
  const user = getCurrentUser()
  const { toast } = useToast()
  const [showContactHrModal, setShowContactHrModal] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [preferredName, setPreferredName] = useState<string | null>(null)
  const [availableBalances, setAvailableBalances] = useState<Record<string, number>>({})
  const [leaveBalances, setLeaveBalances] = useState<Record<string, { available: number; total: number }>>({})
  const [leaveRequests, setLeaveRequests] = useState<any[]>([])
  const [currentApprovedLeave, setCurrentApprovedLeave] = useState<any | null>(null)
  const [isEarlyReturnModalOpen, setIsEarlyReturnModalOpen] = useState(false)
  const [isSubmittingEarlyReturn, setIsSubmittingEarlyReturn] = useState(false)
  const [showVerificationPopup, setShowVerificationPopup] = useState(false)
  const [isRequestingVerification, setIsRequestingVerification] = useState(false)
  const leaveStripRef = useRef<HTMLDivElement | null>(null)

  // Leave modal local state
  const [leaveType, setLeaveType] = useState("annual")
  const [reason, setReason] = useState("")
  const [leaveFrom, setLeaveFrom] = useState<Date | undefined>(undefined)
  const [leaveTo, setLeaveTo] = useState<Date | undefined>(undefined)
  const [totalDays, setTotalDays] = useState(0)
  const [supportingFile, setSupportingFile] = useState<File | null>(null)
  const employeeIdForBalance = user?.id || ""

  useEffect(() => {
    if (leaveFrom && leaveTo) {
      setTotalDays(calculateWorkingDays(leaveFrom, leaveTo))
    } else {
      setTotalDays(0)
    }
  }, [leaveFrom, leaveTo])

  // Upload modal local state
  const [docTitle, setDocTitle] = useState("")
  const [docDescription, setDocDescription] = useState("")
  const [docFile, setDocFile] = useState<File | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  if (!user) return null

  const isEmployee = user.role === "employee"
  const isJuniorHR = user.role === "junior_hr"
  const isHRManager = user.role === "hr_manager" || user.role === "admin" || user.role === "hr_admin"
  const isSuperAdmin = user.role === "super_admin"

  const otherLeaveTypes = useMemo(() => {
    const baseKnown = ["maternity", "paternity", "unpaid", "other"]
    const fromApi = Object.keys(leaveBalances || {})
    const all = Array.from(new Set([...baseKnown, ...fromApi]))
    return all.filter((key) => !["annual", "sick", "family_responsibility"].includes(key))
  }, [leaveBalances])

  const scrollLeaveStrip = (direction: "left" | "right") => {
    const el = leaveStripRef.current
    if (!el) return
    const amount = Math.max(260, Math.floor(el.clientWidth * 0.75))
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" })
  }

  // Load preferred name from profile (same as dashboard layout header)
  useEffect(() => {
    const loadPreferredName = async () => {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        try {
          const storedSession = localStorage.getItem("xspark_session")
          if (storedSession) {
            const sessionParsed = JSON.parse(storedSession)
            if (sessionParsed?.access_token) {
              headers["Authorization"] = `Bearer ${sessionParsed.access_token}`
            }
          }
        } catch (error) {
          console.warn("Failed to parse session for preferred name fetch:", error)
        }

        const res = await fetch("/api/auth/me", { headers })
        const json = await res.json().catch(() => ({}))
        const profile = json?.data?.employee || null
        if (profile?.preferred_name) {
          setPreferredName(profile.preferred_name as string)
        }
        if (user?.role === "employee") {
          setShowVerificationPopup(!isEmployeeFullyVerified(profile))
        }
      } catch (error) {
        console.warn("Failed to load preferred name for dashboard banner:", error)
      }
    }

    if (typeof window !== "undefined") {
      loadPreferredName()
    }
  }, [])

  // Fetch employee UUID from /api/auth/me (only for employees)
  useEffect(() => {
    if (!user?.id) return
    // Only fetch leave data for employees - admins/HR may not have employee records
    if (!isEmployee) return

    const fetchEmployeeData = async () => {
      try {
        // Get employee UUID from /api/auth/me
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        try {
          const storedSession = localStorage.getItem("xspark_session")
          if (storedSession) {
            const sessionParsed = JSON.parse(storedSession)
            if (sessionParsed?.access_token) {
              headers["Authorization"] = `Bearer ${sessionParsed.access_token}`
            }
          }
        } catch (error) {
          console.warn("Failed to parse session:", error)
        }

        const meRes = await fetch("/api/auth/me", { headers })
        
        if (!meRes.ok) {
          console.warn("Failed to fetch user data:", meRes.status, meRes.statusText)
          return
        }
        
        const meData = await meRes.json()
        
        if (!meData?.success) {
          console.warn("API returned unsuccessful response:", meData?.error || "Unknown error")
          return
        }
        
        const employeeId = meData?.data?.employee?.id

        if (!employeeId) {
          // Employee record might not exist yet (e.g., admin users without employee records)
          // This is not necessarily an error, so we'll just skip fetching leave data
          console.warn("Employee ID not found - user may not have an employee record yet")
          return
        }

        // Fetch total entitlements from /api/leave/balances (for total accrued + carried over)
        const balancesRes = await fetch(`/api/leave/balances?employee_id=${employeeId}`)
        let totalEntitlements: Record<string, number> = {}
        
        if (balancesRes.ok) {
          const balancesData = await balancesRes.json()
          if (balancesData?.success && Array.isArray(balancesData.data)) {
            // Process balances to get total entitlement (total_accrued + carried_over)
            balancesData.data.forEach((balance: any) => {
              const leaveTypeKey = balance.leave_types?.key
              if (leaveTypeKey) {
                const total = (balance.total_accrued || 0) + (balance.carried_over || 0)
                totalEntitlements[leaveTypeKey] = Math.max(0, total)
              }
            })
          }
        }

        // Apply sensible default entitlements for employees who don't yet have records
        // These defaults are only used when the API doesn't return a value for that type.
        const defaultEntitlements: Record<string, number> = {
          annual: 15,                 // typical minimum per year
          sick: 30,                   // 30 days in a 36‑month cycle
          family_responsibility: 3,   // 3 days per year
        }
        const totalEntitlementsWithDefaults: Record<string, number> = {
          ...defaultEntitlements,
          ...totalEntitlements,
        }

        // Fetch available balances for all leave types (same as leave request form)
        const leaveTypes = ['annual', 'sick', 'family_responsibility', 'maternity', 'paternity', 'unpaid', 'other']
        const balancePromises = leaveTypes.map(async (leaveType) => {
          try {
            const res = await fetch(
              `/api/leave/requests/balances/available?employee_id=${employeeId}&leave_type=${leaveType}`
            )
            if (res.ok) {
              const json = await res.json()
              if (json.success && json.data?.available_balance !== undefined) {
                return { 
                  leaveType, 
                  available: json.data.available_balance,
                  total: totalEntitlementsWithDefaults[leaveType] || 0
                }
              }
            }
          } catch (error) {
            console.error(`Error fetching available balance for ${leaveType}:`, error)
          }
          return { 
            leaveType, 
            // If the API couldn't provide an available balance, assume the employee
            // still has their full entitlement available for that leave type.
            available: totalEntitlementsWithDefaults[leaveType] || 0,
            total: totalEntitlementsWithDefaults[leaveType] || 0
          }
        })

        const balanceResults = await Promise.all(balancePromises)
        const balancesMap: Record<string, number> = {}
        const balancesByType: Record<string, { available: number; total: number }> = {}
        
        balanceResults.forEach(({ leaveType, available, total }) => {
          balancesMap[leaveType] = available
          balancesByType[leaveType] = {
            available: Math.max(0, available),
            total: Math.max(0, total),
          }
        })
        
        setAvailableBalances(balancesMap)
        setLeaveBalances(balancesByType)

        // Fetch recent leave requests for notifications
        try {
          const requestsRes = await fetch(`/api/leave/requests?employee_id=${employeeId}&limit=5`, { headers })
          if (requestsRes.ok) {
            const requestsData = await requestsRes.json()
            console.log('Leave requests response:', requestsData)
            if (requestsData?.success && Array.isArray(requestsData.data)) {
              console.log('Setting leave requests:', requestsData.data.length, 'requests')
              setLeaveRequests(requestsData.data)
            } else {
              console.warn('Leave requests response format unexpected:', requestsData)
              setLeaveRequests([])
            }
          } else {
            console.error('Failed to fetch leave requests:', requestsRes.status, requestsRes.statusText)
            const errorData = await requestsRes.json().catch(() => ({}))
            console.error('Error details:', errorData)
            setLeaveRequests([])
          }
        } catch (error) {
          console.error('Error fetching leave requests:', error)
          setLeaveRequests([])
        }

        // Fetch approved leaves to detect "currently on leave" banner + early return state
        try {
          const approvedRes = await fetch(`/api/leave/requests?employee_id=${employeeId}&status=approved&limit=50`, { headers })
          if (approvedRes.ok) {
            const approvedData = await approvedRes.json().catch(() => ({}))
            const items = approvedData?.success && Array.isArray(approvedData.data) ? approvedData.data : []

            const today = new Date().toISOString().slice(0, 10)
            const current = items.find((r: any) => {
              const start = String(r.start_date || r.leave_day_from || "")
              const end = String(r.end_date || r.leave_day_to || "")
              return start && end && start <= today && today <= end
            })

            setCurrentApprovedLeave(current || null)
          }
        } catch (e) {
          console.warn("Failed to fetch approved leave requests:", e)
        }
      } catch (error) {
        console.error('Error fetching leave balances:', error)
      }
    }

    fetchEmployeeData()
  }, [user?.id])

  // Helper: progress bar color based on remaining percentage
  // Format: USED / TOTAL, so REMAINING = TOTAL - USED
  // Green: 67-100% remaining, Orange: 34-66% remaining, Red: 0-33% remaining
  const getRemainingColorClass = (available: number, total: number) => {
    const remaining = available // available = total - used, so remaining = available
    const remainingPct = total > 0 ? (remaining / total) * 100 : 0

    if (remainingPct >= 67) return "[&>div]:bg-green-500"
    if (remainingPct >= 34) return "[&>div]:bg-orange-500"
    return "[&>div]:bg-red-500"
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Card */}
        <Card className="gradient-primary text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-1">Welcome back, {user.name}!</h1>
                {preferredName && preferredName !== user.name && (
                  <p className="text-sm text-white/80 mb-1">
                    AKA <span className="font-semibold">{preferredName}</span>
                  </p>
                )}
                <p className="text-white/90">
                  {isEmployee && "Manage your profile, leave requests, and documents"}
                  {isJuniorHR && "Review pending requests and manage employee records"}
                  {isHRManager && "Oversee your team and approve pending actions"}
                  {isSuperAdmin && "Full system access and administrative controls"}
                </p>
              </div>
              <Badge className="bg-white/20 text-white text-sm px-4 py-2">
                {user.role.replace("_", " ").toUpperCase()}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Employee View */}
        {isEmployee && (
          <>
            {/* Currently on leave banner + Early Return */}
            {currentApprovedLeave && (
              <Card className="border-l-4 border-l-[#A6206A]">
                <CardContent className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Leave status</p>
                    <h3 className="text-lg font-semibold text-navy">You are currently on leave</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {getLeaveTypeDisplayName(currentApprovedLeave.leave_types?.key || currentApprovedLeave.leave_type || "leave")} •{" "}
                      {String(currentApprovedLeave.start_date || currentApprovedLeave.leave_day_from)} →{" "}
                      {String(currentApprovedLeave.end_date || currentApprovedLeave.leave_day_to)}
                    </p>

                    {currentApprovedLeave.early_return_status === "pending" && (
                      <p className="text-sm mt-2 text-muted-foreground">
                        Early return request submitted — awaiting approval.
                      </p>
                    )}
                    {currentApprovedLeave.early_return_status === "approved" && (
                      <p className="text-sm mt-2 text-green-700">
                        Your early return has been approved. Welcome back!
                      </p>
                    )}
                    {currentApprovedLeave.early_return_status === "rejected" && (
                      <p className="text-sm mt-2 text-red-700">
                        Your early return request was rejected.
                      </p>
                    )}
                  </div>

                  {(currentApprovedLeave.early_return_status === null ||
                    currentApprovedLeave.early_return_status === undefined ||
                    currentApprovedLeave.early_return_status === "rejected") && (
                    <Button
                      onClick={() => setIsEarlyReturnModalOpen(true)}
                      disabled={isSubmittingEarlyReturn}
                    >
                      I have returned early
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            <Dialog open={isEarlyReturnModalOpen} onOpenChange={setIsEarlyReturnModalOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Confirm Early Return</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to notify your admin that you have returned? Your return date will be recorded as today.
                </p>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsEarlyReturnModalOpen(false)} disabled={isSubmittingEarlyReturn}>
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!currentApprovedLeave?.id) return
                      setIsSubmittingEarlyReturn(true)
                      try {
                        const headers: Record<string, string> = { "Content-Type": "application/json" }
                        const storedSession = localStorage.getItem("xspark_session")
                        if (storedSession) {
                          const sessionParsed = JSON.parse(storedSession)
                          if (sessionParsed?.access_token) headers["Authorization"] = `Bearer ${sessionParsed.access_token}`
                        }

                        const today = new Date().toISOString().slice(0, 10)
                        const res = await fetch(`/api/leave/requests/${currentApprovedLeave.id}/request-early-return`, {
                          method: "POST",
                          headers,
                          body: JSON.stringify({ early_return_date: today }),
                        })
                        const json = await res.json().catch(() => ({}))
                        if (!res.ok || !json?.success) {
                          throw new Error(json?.error || "Failed to request early return")
                        }

                        toast({
                          title: "Early return requested",
                          description: "Early return request submitted — awaiting approval.",
                        })
                        setCurrentApprovedLeave(json.data)
                        setIsEarlyReturnModalOpen(false)
                      } catch (e) {
                        toast({
                          title: "Request failed",
                          description: e instanceof Error ? e.message : "Could not submit early return request.",
                          variant: "destructive",
                        })
                      } finally {
                        setIsSubmittingEarlyReturn(false)
                      }
                    }}
                    disabled={isSubmittingEarlyReturn}
                  >
                    Confirm
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Leave Balance */}
            <div className="flex flex-col lg:flex-row gap-6 items-stretch">
              <div className="grid md:grid-cols-3 gap-6 flex-1">
                <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Annual Leave</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {leaveBalances.annual ? (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-navy">
                            {Math.round(leaveBalances.annual.total - leaveBalances.annual.available)}
                          </span>
                          <span className="text-muted-foreground">
                            / {Math.round(leaveBalances.annual.total)} days
                          </span>
                        </div>
                        <Progress
                          value={leaveBalances.annual.total > 0 ? ((leaveBalances.annual.total - leaveBalances.annual.available) / leaveBalances.annual.total) * 100 : 0}
                          className={cn("h-2", getRemainingColorClass(leaveBalances.annual.available, leaveBalances.annual.total))}
                        />
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-navy">0</span>
                          <span className="text-muted-foreground">/ 0 days</span>
                        </div>
                        <Progress value={0} className="h-2" />
                      </>
                    )}
                  </div>
                </CardContent>
                </Card>

                <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Sick Leave</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {leaveBalances.sick ? (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-navy">
                            {Math.round(leaveBalances.sick.total - leaveBalances.sick.available)}
                          </span>
                          <span className="text-muted-foreground">
                            / {Math.round(leaveBalances.sick.total)} days
                          </span>
                        </div>
                        <Progress
                          value={leaveBalances.sick.total > 0 ? ((leaveBalances.sick.total - leaveBalances.sick.available) / leaveBalances.sick.total) * 100 : 0}
                          className={cn("h-2", getRemainingColorClass(leaveBalances.sick.available, leaveBalances.sick.total))}
                        />
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-navy">0</span>
                          <span className="text-muted-foreground">/ 0 days</span>
                        </div>
                        <Progress value={0} className="h-2" />
                      </>
                    )}
                  </div>
                </CardContent>
                </Card>

                <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Family Responsibility</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {leaveBalances.family_responsibility ? (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-navy">
                            {Math.round(leaveBalances.family_responsibility.total - leaveBalances.family_responsibility.available)}
                          </span>
                          <span className="text-muted-foreground">
                            / {Math.round(leaveBalances.family_responsibility.total)} days
                          </span>
                        </div>
                        <Progress
                          value={leaveBalances.family_responsibility.total > 0 ? ((leaveBalances.family_responsibility.total - leaveBalances.family_responsibility.available) / leaveBalances.family_responsibility.total) * 100 : 0}
                          className={cn("h-2", getRemainingColorClass(leaveBalances.family_responsibility.available, leaveBalances.family_responsibility.total))}
                        />
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-navy">0</span>
                          <span className="text-muted-foreground">/ 0 days</span>
                        </div>
                        <Progress value={0} className="h-2" />
                      </>
                    )}
                  </div>
                </CardContent>
                </Card>
              </div>

              {/* Other leave types (hidden until scroll/next) */}
              {otherLeaveTypes.length > 0 && (
                <div className="relative lg:w-[290px]">
                  <div className="absolute right-2 top-2 flex items-center gap-1 z-10">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 bg-background"
                      onClick={() => scrollLeaveStrip("left")}
                      aria-label="Previous leave type"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 bg-background"
                      onClick={() => scrollLeaveStrip("right")}
                      aria-label="Next leave type"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <div
                    ref={leaveStripRef}
                    className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 pr-1"
                    style={{ scrollbarWidth: "none" } as any}
                  >
                    {otherLeaveTypes.map((leaveKey) => {
                      const bal = leaveBalances[leaveKey] || { available: 0, total: 0 }
                      const available = Math.max(0, Math.round(bal.available || 0))
                      const total = Math.max(0, Math.round(bal.total || 0))
                      const display = getLeaveTypeDisplayName(leaveKey)

                      return (
                        <Card key={leaveKey} className="min-w-[260px] snap-start">
                          <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">{display}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-navy">{available}</span>
                                <span className="text-muted-foreground">/ {total} days</span>
                              </div>
                              <p className="text-sm text-muted-foreground">{available} days left</p>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* My HR Cases */}
            <MyHrCases />

            {/* Scheduled Notes */}
            <Notes2Scheduled />

            {/* High Alert Notes */}
            <Notes2HighAlert />

            {/* Recent Notifications */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Notifications</CardTitle>
                <CardDescription>Your leave request history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {leaveRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No leave requests yet</p>
                  ) : (
                    leaveRequests.map((request) => {
                      // Handle different response structures
                      const leaveTypeKey = request.leave_types?.key || request.leave_type?.key || request.leave_type || 'unknown'
                      const leaveTypeName = getLeaveTypeDisplayName(leaveTypeKey)
                      const startDate = request.start_date || request.leave_day_from
                      const endDate = request.end_date || request.leave_day_to
                      const status = request.status || 'pending'
                      
                      // Format date range
                      let dateRange = ""
                      if (startDate && endDate) {
                        try {
                          const start = format(new Date(startDate), "MMM d")
                          const end = format(new Date(endDate), "MMM d, yyyy")
                          dateRange = `${start} - ${end}`
                        } catch (e) {
                          dateRange = "Invalid dates"
                        }
                      } else {
                        dateRange = "Date range not available"
                      }

                      // Format time ago
                      let timeAgo = ""
                      try {
                        const createdAt = request.created_at || request.submitted_at
                        if (createdAt) {
                          timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true })
                        }
                      } catch (e) {
                        timeAgo = ""
                      }

                      // Determine icon and message based on status
                      let icon, message, iconColor
                      if (status === 'approved') {
                        icon = CheckCircle2
                        iconColor = "text-green-500"
                        message = `Your ${leaveTypeName} request for ${dateRange} has been approved`
                      } else if (status === 'rejected' || status === 'cancelled') {
                        icon = XCircle
                        iconColor = "text-red-500"
                        message = `Your ${leaveTypeName} request for ${dateRange} has been ${status === 'cancelled' ? 'cancelled' : 'rejected'}`
                      } else {
                        icon = AlertCircle
                        iconColor = "text-amber-500"
                        message = `Your ${leaveTypeName} request for ${dateRange} is pending approval`
                      }

                      const IconComponent = icon

                      return (
                        <div key={request.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                          <IconComponent className={`h-5 w-5 ${iconColor} flex-shrink-0 mt-0.5`} />
                          <div className="flex-1">
                            <p className="text-sm">{message}</p>
                            {timeAgo && (
                              <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Junior HR View */}
        {isJuniorHR && <JuniorHRDashboard />}

        {/* Admin/HR Manager View */}
        {isHRManager && !isSuperAdmin && <AdminDashboard />}

        {/* Super Admin View */}
        {isSuperAdmin && <SuperAdminDashboard />}
      </div>

      {/* Contact HR Modal */}
      <ContactHrModal 
        open={showContactHrModal} 
        onClose={() => setShowContactHrModal(false)} 
      />

      {/* Quick Action: Request Leave Modal */}
      <Dialog open={showLeaveModal} onOpenChange={setShowLeaveModal}>
        <DialogContent className="max-w-2xl animate-in fade-in-0">
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-navy flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Leave Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Leave Type <span className="text-red-500">*</span></Label>
                  <Select value={leaveType} onValueChange={setLeaveType}>
                    <SelectTrigger className="uniform-input">
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        { value: "annual", label: "Annual Leave" },
                        { value: "sick", label: "Sick Leave" },
                        { value: "family_responsibility", label: "Family Responsibility Leave" },
                        { value: "maternity", label: "Maternity Leave" },
                        { value: "paternity", label: "Paternity Leave" },
                        { value: "unpaid", label: "Unpaid Leave" },
                        { value: "other", label: "Other" },
                      ].map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col space-y-1.5">
                  <Label>Available Balance ({getLeaveTypeDisplayName(leaveType)})</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={availableBalances[leaveType] !== undefined ? availableBalances[leaveType].toFixed(2) : calculateLeaveBalance(employeeIdForBalance, leaveType, undefined)} 
                      readOnly 
                      className="bg-gray-100" 
                    />
                    <Badge variant={(availableBalances[leaveType] !== undefined ? availableBalances[leaveType] : calculateLeaveBalance(employeeIdForBalance, leaveType, undefined)) > 0 ? "default" : "destructive"}>
                      {(availableBalances[leaveType] !== undefined ? availableBalances[leaveType] : calculateLeaveBalance(employeeIdForBalance, leaveType, undefined)) > 0 ? "Available" : "No Balance"}
                    </Badge>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label>Reason for Leave <span className="text-red-500">*</span></Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Briefly describe your reason for leave"
                    rows={3}
                  />
                </div>

                <div className="flex flex-col">
                  <Label>Start Date <span className="text-red-500">*</span></Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-between", !leaveFrom && "text-muted-foreground")}> 
                        {leaveFrom ? format(leaveFrom, "PPP") : <span>Pick a date</span>}
                        <Calendar className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <DatePicker
                        mode="single"
                        selected={leaveFrom}
                        onSelect={(d) => setLeaveFrom(d || undefined)}
                        disabled={(date) => date < addDays(new Date(), -1)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex flex-col">
                  <Label>End Date <span className="text-red-500">*</span></Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-between", !leaveTo && "text-muted-foreground")}>
                        {leaveTo ? format(leaveTo, "PPP") : <span>Pick a date</span>}
                        <Calendar className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <DatePicker
                        mode="single"
                        selected={leaveTo}
                        onSelect={(d) => setLeaveTo(d || undefined)}
                        disabled={(date) => date < (leaveFrom || addDays(new Date(), -1))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>Total Days (Working Days)</Label>
                  <Input value={totalDays} readOnly className="bg-gray-100" />
                </div>

                <div className="md:col-span-2">
                  <Label>Supporting Document (Optional)</Label>
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setSupportingFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">Upload supporting documents (JPG, PNG, PDF up to 10MB)</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button className="px-8" onClick={() => setShowLeaveModal(false)}>Submit Request</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Action: Upload Document Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-w-lg animate-in fade-in-0">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {uploadSuccess ? (
              <div className="text-center py-6">
                <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-2" />
                <p className="font-medium">Successfully uploaded</p>
              </div>
            ) : (
              <>
                <div>
                  <Label>Document Title <span className="text-red-500">*</span></Label>
                  <Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="e.g., Medical Certificate" />
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Textarea value={docDescription} onChange={(e) => setDocDescription(e.target.value)} rows={3} placeholder="Add a short description" />
                </div>
                <div>
                  <Label>Upload File <span className="text-red-500">*</span></Label>
                  <Input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">PDF, JPG, PNG up to 10MB</p>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      if (!docTitle || !docFile) return
                      if (docFile.size > 10 * 1024 * 1024) return
                      setUploadSuccess(true)
                    }}
                  >
                    Upload
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showVerificationPopup} onOpenChange={setShowVerificationPopup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete your verification</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Your profile is not fully verified yet. Please complete the required verification steps to unlock Notes,
              Leave Requests, and Documents.
            </p>
            <p>Go to your profile and ensure your ID, bank, and work permit verification are completed.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowVerificationPopup(false)}>
              Remind me later
            </Button>
            <Button
              disabled={isRequestingVerification}
              onClick={async () => {
                if (isRequestingVerification) return
                setIsRequestingVerification(true)

                try {
                  const storedSession = localStorage.getItem("xspark_session")
                  if (!storedSession) {
                    throw new Error("Session expired. Please login again.")
                  }

                  const sessionParsed = JSON.parse(storedSession)
                  const accessToken = sessionParsed?.access_token
                  if (!accessToken) {
                    throw new Error("Session expired. Please login again.")
                  }

                  const res = await fetch("/api/verification/request", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${accessToken}`,
                    },
                  })

                  const json = await res.json().catch(() => ({}))
                  if (!res.ok || !json?.success) {
                    throw new Error(json?.error || "Failed to send verification request.")
                  }

                  toast({
                    title: "Success",
                    description: "Verification request sent successfully.",
                  })
                  setShowVerificationPopup(false)
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Failed to request verification."
                  toast({
                    title: "Request failed",
                    description: message,
                    variant: "destructive",
                  })
                } finally {
                  setIsRequestingVerification(false)
                }
              }}
            >
              {isRequestingVerification ? "Requesting..." : "Request verification"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
