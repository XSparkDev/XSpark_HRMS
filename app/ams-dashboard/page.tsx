"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getCurrentUser } from "@/lib/auth"
import {
  Calendar,
  Monitor,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Package,
  Wrench,
  Users,
  Settings,
  MessageSquare,
  MapPin,
  ArrowRight,
  History,
  FileText,
  Shield,
} from "lucide-react"

export default function AMSDashboardPage() {
  const user = getCurrentUser()

  if (!user) return null

  const isEmployee = user.role === "employee"

  // Mock data for AMS
  const currentDevice = "PC Number 5"
  const upcomingEvents = [
    {
      date: "Oct 25",
      type: "Meeting",
      title: "Team Standup",
      time: "10:00 AM",
    },
    {
      date: "Oct 28", 
      type: "Device Return",
      title: "Laptop #LAP-001",
      time: "2:00 PM",
    },
    {
      date: "Oct 30",
      type: "Meeting",
      title: "Project Review",
      time: "11:30 AM",
    },
  ]

  const upcomingMeetings = [
    {
      date: "Oct 25, 2024",
      time: "10:00 AM",
      title: "Team Standup",
      location: "Conference Room A",
    },
    {
      date: "Oct 30, 2024",
      time: "11:30 AM", 
      title: "Project Review",
      location: "Boardroom",
    },
    {
      date: "Nov 2, 2024",
      time: "3:00 PM",
      title: "Client Meeting",
      location: "Meeting Room 3",
    },
  ]

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        {/* Welcome Card */}
        <Card className="gradient-primary text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Welcome back, {user.name}!</h1>
                <p className="text-white/90">
                  You're now on the Asset Management System.
                </p>
              </div>
              <Badge className="bg-white/20 text-white text-sm px-4 py-2">
                AMS
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-blue-100/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">Total Devices</CardTitle>
              <Monitor className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900">1,247</div>
              <p className="text-xs text-blue-600 mt-1">Active devices</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-green-100/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-700">Total Assets</CardTitle>
              <Building2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900">2,456</div>
              <p className="text-xs text-green-600 mt-1">All assets</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-purple-100/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-purple-700">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-900">156</div>
              <p className="text-xs text-purple-600 mt-1">Active users</p>
            </CardContent>
          </Card>
        </div>

        {/* Events Section */}
        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
            <CardDescription>Upcoming device returns and meeting bookings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingEvents.map((event, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      event.type === "Meeting" ? "bg-blue-100" : "bg-amber-100"
                    }`}>
                      {event.type === "Meeting" ? (
                        <Calendar className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Package className="h-4 w-4 text-amber-600" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.date} at {event.time}
                    </p>
                  </div>
                  <Badge variant={event.type === "Meeting" ? "default" : "secondary"} className="text-xs">
                    {event.type}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Device Currently Assigned Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Device Currently Assigned to You</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center">
                <Monitor className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-lg font-semibold text-navy">
                  You are currently using: {currentDevice}
                </p>
                <p className="text-sm text-muted-foreground">Assigned on Oct 15, 2024</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Meeting Bookings Card */}
        <Card>
          <CardHeader>
            <CardTitle>Meeting Bookings</CardTitle>
            <CardDescription>Your upcoming meetings and boardroom reservations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingMeetings.map((meeting, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex-1">
                    <p className="font-medium text-sm text-navy">{meeting.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {meeting.date} • {meeting.time} • {meeting.location}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Upcoming
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>


        {/* Non-Employee Views */}
        {!isEmployee && (
          <>
            {/* Junior HR View */}
            {user.role === "junior_hr" && (
              <>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Devices Assigned</CardTitle>
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-navy">42</div>
                      <p className="text-xs text-muted-foreground mt-1">Active devices</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Pending Returns</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-navy">8</div>
                      <p className="text-xs text-muted-foreground mt-1">Due this week</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Room Bookings</CardTitle>
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-navy">15</div>
                      <p className="text-xs text-muted-foreground mt-1">This week</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Maintenance Due</CardTitle>
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-navy">5</div>
                      <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Device Activity</CardTitle>
                    <CardDescription>Latest device assignments and returns</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        {
                          action: "Device Assigned",
                          device: "Laptop #LAP-015",
                          user: "Alice Brown",
                          time: "2 hours ago",
                          status: "success",
                        },
                        {
                          action: "Device Returned",
                          device: "Tablet #TAB-008",
                          user: "Michael Chen",
                          time: "1 day ago",
                          status: "success",
                        },
                        {
                          action: "Maintenance Required",
                          device: "Desktop #DESK-023",
                          user: "Sarah Johnson",
                          time: "3 days ago",
                          status: "warning",
                        },
                      ].map((activity, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                          {activity.status === "success" && (
                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          )}
                          {activity.status === "warning" && (
                            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-navy">{activity.action}</p>
                            <p className="text-xs text-muted-foreground">
                              {activity.device} • {activity.user}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Admin View */}
            {(user.role === "hr_manager" || user.role === "super_admin") && (
              <>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-navy">1,247</div>
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" />
                        +12 this month
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Devices in Use</CardTitle>
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-navy">892</div>
                      <p className="text-xs text-muted-foreground mt-1">71% utilization</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Maintenance Due</CardTitle>
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-navy">23</div>
                      <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Room Bookings</CardTitle>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-navy">156</div>
                      <p className="text-xs text-muted-foreground mt-1">This month</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Device Categories</CardTitle>
                      <CardDescription>Asset distribution by type</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {[
                          { category: "Laptops", count: 245, color: "bg-blue-500" },
                          { category: "Desktops", count: 189, color: "bg-green-500" },
                          { category: "Tablets", count: 98, color: "bg-purple-500" },
                          { category: "Monitors", count: 312, color: "bg-amber-500" },
                          { category: "Printers", count: 45, color: "bg-red-500" },
                          { category: "Other", count: 358, color: "bg-cyan-500" },
                        ].map((item, i) => (
                          <div key={i} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{item.category}</span>
                              <span className="text-muted-foreground">{item.count} devices</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full ${item.color}`} style={{ width: `${(item.count / 1247) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Activity</CardTitle>
                      <CardDescription>Latest asset management actions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[
                          { action: "Device Assigned", device: "Laptop #LAP-001", user: "John Smith", time: "2 min ago" },
                          { action: "Room Booked", room: "Conference Room A", user: "Alice Brown", time: "15 min ago" },
                          { action: "Maintenance Scheduled", device: "Printer #PRT-012", user: "System", time: "1 hour ago" },
                          { action: "Device Returned", device: "Tablet #TAB-003", user: "Michael Johnson", time: "2 hours ago" },
                        ].map((activity, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-sm text-navy">{activity.action}</p>
                              <p className="text-xs text-muted-foreground">
                                {activity.device || activity.room} • {activity.user}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {/* Super Admin View */}
            {user.role === "super_admin" && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>AMS System Overview</CardTitle>
                    <CardDescription>Complete asset management system metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Total Asset Value</p>
                        <p className="text-3xl font-bold text-navy">$2.4M</p>
                        <p className="text-xs text-green-600">+5% from last month</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Active Users</p>
                        <p className="text-3xl font-bold text-navy">142</p>
                        <p className="text-xs text-muted-foreground">Using AMS today</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">System Health</p>
                        <p className="text-3xl font-bold text-navy">98%</p>
                        <p className="text-xs text-green-600">Uptime this month</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Audit Logs</p>
                        <p className="text-3xl font-bold text-navy">1,247</p>
                        <p className="text-xs text-muted-foreground">Last 24 hours</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>System Administration</CardTitle>
                    <CardDescription>AMS management and configuration</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="font-semibold text-navy">Quick Actions</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <Button variant="outline" className="h-auto flex-col gap-2 py-4">
                            <Package className="h-5 w-5 text-primary" />
                            <span className="text-sm">Add Asset</span>
                          </Button>
                          <Button variant="outline" className="h-auto flex-col gap-2 py-4">
                            <Wrench className="h-5 w-5 text-primary" />
                            <span className="text-sm">Schedule Maintenance</span>
                          </Button>
                          <Button variant="outline" className="h-auto flex-col gap-2 py-4">
                            <Building2 className="h-5 w-5 text-primary" />
                            <span className="text-sm">Manage Rooms</span>
                          </Button>
                          <Button variant="outline" className="h-auto flex-col gap-2 py-4">
                            <Users className="h-5 w-5 text-primary" />
                            <span className="text-sm">User Management</span>
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h3 className="font-semibold text-navy">System Status</h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-medium text-green-800">Database</span>
                            </div>
                            <span className="text-xs text-green-600">Online</span>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-medium text-green-800">API Services</span>
                            </div>
                            <span className="text-xs text-green-600">Online</span>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-amber-600" />
                              <span className="text-sm font-medium text-amber-800">Backup System</span>
                            </div>
                            <span className="text-xs text-amber-600">Scheduled</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </AMSDashboardLayout>
  )
}