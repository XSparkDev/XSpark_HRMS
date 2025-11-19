"use client"

import { memo, useMemo, useState, useEffect } from "react"
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
import { addDays, format } from "date-fns"
import { calculateLeaveBalance, calculateWorkingDays, getLeaveTypeDisplayName } from "@/lib/validation/leave"
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
} from "lucide-react"

// Lazy load heavy components
const Notes2HighAlert = dynamic(
  () => import("@/components/notes2-high-alert").then((mod) => ({ default: mod.Notes2HighAlert })),
  {
  loading: () => <div className="h-32" />,
    ssr: false,
  },
)

export default function DashboardPage() {
  const router = useRouter()
  const user = getCurrentUser()
  const [showContactHrModal, setShowContactHrModal] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)

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
  const isHRManager = user.role === "hr_manager" || user.role === "super_admin"
  const isSuperAdmin = user.role === "super_admin"

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Card */}
        <Card className="gradient-primary text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Welcome back, {user.name}!</h1>
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
            {/* Leave Balance */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Annual Leave</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-navy">12</span>
                      <span className="text-muted-foreground">/ 15 days</span>
                    </div>
                    <Progress value={80} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Sick Leave</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-navy">8</span>
                      <span className="text-muted-foreground">/ 10 days</span>
                    </div>
                    <Progress value={80} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Family Responsibility</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-navy">3</span>
                      <span className="text-muted-foreground">/ 3 days</span>
                    </div>
                    <Progress value={100} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks and shortcuts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <Button 
                    className="h-auto flex-col gap-2 py-6 bg-transparent" 
                    variant="outline"
                    onClick={() => { setShowUploadModal(false); setShowContactHrModal(false); setShowLeaveModal(true) }}
                  >
                    <Calendar className="h-6 w-6 text-primary" />
                    <span>Request Leave</span>
                  </Button>
                  <Button 
                    className="h-auto flex-col gap-2 py-6 bg-transparent" 
                    variant="outline"
                    onClick={() => { setShowLeaveModal(false); setShowContactHrModal(false); setShowUploadModal(true); setUploadSuccess(false) }}
                  >
                    <Upload className="h-6 w-6 text-primary" />
                    <span>Upload Document</span>
                  </Button>
                  <Button className="h-auto flex-col gap-2 py-6 bg-transparent" variant="outline">
                    <FileText className="h-6 w-6 text-primary" />
                    <span>View Payslips</span>
                  </Button>
                  <Button 
                    className="h-auto flex-col gap-2 py-6 bg-transparent" 
                    variant="outline"
                    onClick={() => setShowContactHrModal(true)}
                  >
                    <MessageSquare className="h-6 w-6 text-primary" />
                    <span>Contact HR</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* High Alert Notes */}
            <Notes2HighAlert />

            {/* My HR Cases */}
            <MyHrCases />

            {/* Recent Notifications */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Notifications</CardTitle>
                <CardDescription>Stay updated with important information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      type: "success",
                      message: "Your leave request for Dec 20-22 has been approved",
                      time: "2 hours ago",
                    },
                    { type: "info", message: "New payslip available for November 2024", time: "1 day ago" },
                    {
                      type: "warning",
                      message: "Please update your emergency contact information",
                      time: "3 days ago",
                    },
                  ].map((notification, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      {notification.type === "success" && (
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      )}
                      {notification.type === "info" && (
                        <FileText className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      )}
                      {notification.type === "warning" && (
                        <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Junior HR View */}
        {isJuniorHR && (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Pending Leave Requests</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-navy">8</div>
                  <p className="text-xs text-muted-foreground mt-1">Awaiting your review</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Documents to Verify</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-navy">5</div>
                  <p className="text-xs text-muted-foreground mt-1">Uploaded by employees</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-navy">42</div>
                  <p className="text-xs text-muted-foreground mt-1">In your department</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Approved Today</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-navy">12</div>
                  <p className="text-xs text-muted-foreground mt-1">Requests processed</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Pending Tasks</CardTitle>
                <CardDescription>Items requiring your attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    {
                      name: "Sarah Johnson",
                      type: "Leave Request",
                      details: "Annual Leave: Dec 15-20",
                      priority: "high",
                    },
                    {
                      name: "Michael Chen",
                      type: "Document Upload",
                      details: "Medical Certificate",
                      priority: "medium",
                    },
                    { name: "Emma Davis", type: "Leave Request", details: "Sick Leave: Dec 10", priority: "high" },
                  ].map((task, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{task.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.type} • {task.details}
                        </p>
                      </div>
                      <Badge variant={task.priority === "high" ? "destructive" : "secondary"}>{task.priority}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Admin View */}
        {isHRManager && (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-navy">156</div>
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    +8 this month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Pending Verifications</CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-navy">23</div>
                  <p className="text-xs text-muted-foreground mt-1">Across all departments</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Active Leave Requests</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-navy">15</div>
                  <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Documents Pending</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-navy">31</div>
                  <p className="text-xs text-muted-foreground mt-1">Need review</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Department Breakdown</CardTitle>
                  <CardDescription>Employee distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { dept: "Engineering", count: 45, color: "bg-blue-500" },
                      { dept: "Sales", count: 32, color: "bg-green-500" },
                      { dept: "Marketing", count: 28, color: "bg-purple-500" },
                      { dept: "Operations", count: 25, color: "bg-amber-500" },
                      { dept: "HR", count: 12, color: "bg-red-500" },
                      { dept: "Finance", count: 14, color: "bg-cyan-500" },
                    ].map((dept, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{dept.dept}</span>
                          <span className="text-muted-foreground">{dept.count} employees</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${dept.color}`} style={{ width: `${(dept.count / 156) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Approval Queue</CardTitle>
                  <CardDescription>Quick access to pending approvals</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { name: "John Smith", type: "Leave Request", date: "Dec 20-25", status: "pending" },
                      { name: "Alice Brown", type: "Document", date: "Contract Update", status: "pending" },
                      { name: "Robert Lee", type: "Leave Request", date: "Jan 5-10", status: "pending" },
                      { name: "Maria Garcia", type: "Profile Update", date: "Banking Details", status: "pending" },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.type} • {item.date}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="h-8 text-xs bg-transparent">
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Super Admin View */}
        {isSuperAdmin && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>System Health Dashboard</CardTitle>
                <CardDescription>Real-time system metrics and activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Active Users Today</p>
                    <p className="text-3xl font-bold text-navy">142</p>
                    <p className="text-xs text-green-600">+12% from yesterday</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Audit Log Entries</p>
                    <p className="text-3xl font-bold text-navy">1,247</p>
                    <p className="text-xs text-muted-foreground">Last 24 hours</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Storage Usage</p>
                    <p className="text-3xl font-bold text-navy">68%</p>
                    <Progress value={68} className="h-2 mt-2" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Failed Logins</p>
                    <p className="text-3xl font-bold text-navy">3</p>
                    <p className="text-xs text-amber-600">Requires attention</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Audit Activity</CardTitle>
                <CardDescription>Last 10 system actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    {
                      user: "Sarah Smith (Admin)",
                      action: "Approved leave request",
                      target: "John Doe",
                      time: "2 min ago",
                    },
                    { user: "Admin User", action: "Updated user role", target: "Jane Smith", time: "15 min ago" },
                    {
                      user: "Michael Johnson",
                      action: "Uploaded document",
                      target: "Contract.pdf",
                      time: "1 hour ago",
                    },
                    { user: "System", action: "Automated backup", target: "Database", time: "2 hours ago" },
                  ].map((log, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{log.user}</p>
                        <p className="text-muted-foreground text-xs">
                          {log.action} • {log.target}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{log.time}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
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
                    <Input value={calculateLeaveBalance(employeeIdForBalance, leaveType, undefined)} readOnly className="bg-gray-100" />
                    <Badge variant={calculateLeaveBalance(employeeIdForBalance, leaveType, undefined) > 0 ? "default" : "destructive"}>
                      {calculateLeaveBalance(employeeIdForBalance, leaveType, undefined) > 0 ? "Available" : "No Balance"}
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
    </DashboardLayout>
  )
}
