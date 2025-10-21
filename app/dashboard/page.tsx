"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { getCurrentUser } from "@/lib/auth"
import { HighAlertNotes } from "@/components/high-alert-notes"
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

export default function DashboardPage() {
  const user = getCurrentUser()

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
                  <Button className="h-auto flex-col gap-2 py-6 bg-transparent" variant="outline">
                    <Calendar className="h-6 w-6 text-primary" />
                    <span>Request Leave</span>
                  </Button>
                  <Button className="h-auto flex-col gap-2 py-6 bg-transparent" variant="outline">
                    <Upload className="h-6 w-6 text-primary" />
                    <span>Upload Document</span>
                  </Button>
                  <Button className="h-auto flex-col gap-2 py-6 bg-transparent" variant="outline">
                    <FileText className="h-6 w-6 text-primary" />
                    <span>View Payslips</span>
                  </Button>
                  <Button className="h-auto flex-col gap-2 py-6 bg-transparent" variant="outline">
                    <MessageSquare className="h-6 w-6 text-primary" />
                    <span>Contact HR</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* High Alert Notes */}
            <HighAlertNotes />

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

        {/* HR Manager View */}
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
                      user: "Sarah Smith (HR Manager)",
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
    </DashboardLayout>
  )
}
