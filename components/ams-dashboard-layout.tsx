"use client"

import { type ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { XSparkLogo } from "@/components/xspark-logo"
import { AIChatWidget } from "@/components/ai-chat-widget"
import {
  getCurrentUser,
  logout,
  getRoleBadgeColor,
  getRoleDisplayName,
  type User,
} from "@/lib/auth"
import {
  Home,
  Package,
  Calendar,
  Settings,
  LogOut,
  Bell,
  Menu,
  MessageSquare,
  Wrench,
  ClipboardList,
  QrCode,
  AlertTriangle,
  CheckCircle2,
  Users,
  FileText,
  BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"

interface AMSDashboardLayoutProps {
  children: ReactNode
}

export function AMSDashboardLayout({ children }: AMSDashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | undefined>(undefined)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [employeeProfile, setEmployeeProfile] = useState<any>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<any | null>(null)
  const [notificationDetailsOpen, setNotificationDetailsOpen] = useState(false)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      router.replace("/login")
    }
    setUser(currentUser)
  }, [router])

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedEmployee = localStorage.getItem("xspark_employee")
    if (storedEmployee) {
      try {
        setEmployeeProfile(JSON.parse(storedEmployee))
      } catch (error) {
        console.error("Failed to parse stored employee profile", error)
      }
    }
  }, [])

  // Fetch notifications when dialog opens
  useEffect(() => {
    if (notificationsOpen && user) {
      fetchNotifications()
    }
  }, [notificationsOpen, user])

  const fetchNotifications = async () => {
    if (!user) {
      console.error("[Notifications] No user found")
      return
    }
    
    // Try multiple sources for employee ID
    const employeeId = 
      employeeProfile?.id || 
      employeeProfile?.employee_id || 
      user.id || 
      user.employeeId
    
    if (!employeeId) {
      console.error("[Notifications] No employee ID found. User:", user, "Employee Profile:", employeeProfile)
      return
    }

    console.log("[Notifications] Fetching notifications for employee ID:", employeeId)
    console.log("[Notifications] User object:", { id: user.id, employeeId: user.employeeId })
    console.log("[Notifications] Employee profile:", { id: employeeProfile?.id, employee_id: employeeProfile?.employee_id })

    setNotificationsLoading(true)
    try {
      const response = await fetch(`/api/notifications?employeeId=${employeeId}`)
      if (!response.ok) {
        const errorText = await response.text()
        console.error("[Notifications] API error:", response.status, errorText)
        throw new Error(`Failed to fetch notifications: ${response.status}`)
      }
      const result = await response.json()
      console.log("[Notifications] API response:", result)
      setNotifications(result.data || [])
      console.log("[Notifications] Set notifications:", result.data?.length || 0, "notifications")
    } catch (error) {
      console.error("[Notifications] Error fetching notifications:", error)
      setNotifications([])
    } finally {
      setNotificationsLoading(false)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
      })
      if (response.ok) {
        const { data } = await response.json()
        // Update local state
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, is_read: true, read_at: data.read_at } : n
          )
        )
        // Update selected notification if it's the one being marked as read
        if (selectedNotification?.id === notificationId) {
          setSelectedNotification({ ...selectedNotification, is_read: true, read_at: data.read_at })
        }
      }
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  }

  const handleNotificationClick = (notification: any) => {
    setSelectedNotification(notification)
    setNotificationDetailsOpen(true)
    // Mark as read if unread
    if (!notification.is_read) {
      handleMarkAsRead(notification.id)
    }
  }

  const handleMarkAllAsRead = async () => {
    const unreadNotifications = notifications.filter((n) => !n.is_read)
    for (const notification of unreadNotifications) {
      await handleMarkAsRead(notification.id)
    }
  }

  const formatNotificationDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
      return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes}m ago`
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else if (diffInHours < 48) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  if (user === undefined) return null
  if (user === null) return null

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const dashboardPath = user?.role === "supervisor" ? "/ams-supervisor" : "/ams-dashboard"
  const settingsPath = user?.role === "supervisor" ? "/settings/supervisor" : "/ams-settings"

  const baseNavigation = [
    { name: "Dashboard", href: dashboardPath, icon: Home },
    { name: "Device Management", href: "/ams-devices", icon: Package },
    { name: "Room Booking", href: "/ams-bookings", icon: Calendar },
    { name: "Maintenance Request", href: "/ams-maintenance", icon: Wrench },
    { name: "Settings", href: settingsPath, icon: Settings },
  ]

  const navigationTabs = baseNavigation

  const extractSurname = (value?: string | null) => {
    if (!value) return ""
    const parts = value.split(" ").filter(Boolean)
    return parts.length > 0 ? parts[parts.length - 1] : ""
  }

  const profileImage: string | null =
    employeeProfile?.profile_image_url ??
    employeeProfile?.profilePicture ??
    employeeProfile?.avatar_url ??
    employeeProfile?.avatar ??
    null

  const fullNames =
    (typeof employeeProfile?.full_name === "string" && employeeProfile.full_name) ||
    (typeof employeeProfile?.names === "string" && employeeProfile.names) ||
    user.name

  const nameParts = (fullNames || "")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)

  const firstName =
    (typeof employeeProfile?.first_name === "string" && employeeProfile.first_name) ||
    nameParts[0] ||
    user.name.split(" ")[0] ||
    ""

  const middleName =
    (typeof employeeProfile?.middle_name === "string" && employeeProfile.middle_name) ||
    (nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "")

  const surname =
    (typeof employeeProfile?.surname === "string" && employeeProfile.surname) ||
    (typeof employeeProfile?.last_name === "string" && employeeProfile.last_name) ||
    extractSurname(fullNames) ||
    extractSurname(user.name)

  const employeeIdDisplay =
    employeeProfile?.employee_number ??
    employeeProfile?.employeeId ??
    employeeProfile?.employee_id ??
    user.employeeId ??
    "—"

  const cellNumber =
    employeeProfile?.cell_number ??
    employeeProfile?.cellphone ??
    employeeProfile?.mobile ??
    employeeProfile?.phone ??
    "—"

  const jobTitle =
    employeeProfile?.job_title ??
    employeeProfile?.jobTitle ??
    employeeProfile?.title ??
    "—"

  const position =
    employeeProfile?.position ??
    employeeProfile?.designation ??
    getRoleDisplayName(user.role)

  const initials =
    user.name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("") || "U"

  const toggleSidebar = () => setSidebarOpen((prev) => !prev)
  const closeSidebar = () => setSidebarOpen(false)
  const sidebarId = "ams-dashboard-sidebar"

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center gap-4 px-4">
          {/* Logo + Burger */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Toggle navigation"
              onClick={toggleSidebar}
              aria-expanded={sidebarOpen}
              aria-controls={sidebarId}
              className="rounded-md border border-transparent p-2 transition hover:border-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
            >
              <Menu className="h-5 w-5 text-foreground" />
            </button>
            <button
              type="button"
              aria-label="Collapse navigation"
              onClick={closeSidebar}
              aria-expanded={sidebarOpen}
              aria-controls={sidebarId}
              className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#92278F]/50 focus-visible:ring-offset-2"
            >
              <XSparkLogo className="h-12 w-auto" />
            </button>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  aria-label="View notifications"
                  onClick={() => setNotificationsOpen(true)}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#E31E24]" />
                  )}
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[#E31E24] text-white text-xs flex items-center justify-center p-0">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-96 p-0 shadow-lg">
                {/* Header */}
                <div className="px-5 py-4 border-b bg-gradient-to-r from-[#92278F]/5 to-[#BE1E2D]/5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-base text-[#25294B]">Notifications</h3>
                    {unreadCount > 0 && (
                      <Badge variant="secondary" className="text-xs bg-[#92278F]/10 text-[#92278F] border-[#92278F]/20">
                        {unreadCount} unread
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Notifications List */}
                <ScrollArea className="h-[450px]">
                  {notificationsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#92278F] mx-auto mb-2"></div>
                        <p className="text-sm text-muted-foreground">Loading notifications...</p>
                      </div>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4">
                      <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">No notifications</p>
                      <p className="text-xs text-muted-foreground mt-1">You're all caught up!</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={cn(
                            "px-5 py-4 cursor-pointer transition-all duration-200",
                            "hover:bg-gradient-to-r hover:from-[#92278F]/5 hover:to-[#BE1E2D]/5",
                            !notification.is_read && "bg-gradient-to-r from-[#92278F]/8 to-[#BE1E2D]/8 border-l-2 border-[#92278F]"
                          )}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="flex items-start gap-3">
                            {/* Unread Indicator */}
                            {!notification.is_read && (
                              <div className="mt-1.5 flex-shrink-0">
                                <div className="h-2 w-2 rounded-full bg-[#92278F] animate-pulse" />
                              </div>
                            )}
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0 space-y-2">
                              {/* Title */}
                              <div className="flex items-start justify-between gap-2">
                                <p className={cn(
                                  "text-sm leading-5",
                                  !notification.is_read ? "font-semibold text-[#25294B]" : "font-medium text-[#25294B]/90"
                                )}>
                                  {notification.title}
                                </p>
                              </div>
                              
                              {/* Message Preview */}
                              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                                {notification.message}
                              </p>
                              
                              {/* Timestamp */}
                              <div className="flex items-center gap-2 pt-1">
                                <p className="text-xs text-muted-foreground/80">
                                  {formatNotificationDate(notification.created_at)}
                                </p>
                                {notification.notification_type && (
                                  <>
                                    <span className="text-muted-foreground/40">•</span>
                                    <Badge variant="outline" className="text-xs h-5 px-1.5 py-0 border-muted-foreground/20 text-muted-foreground/70">
                                      {notification.notification_type}
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* Footer */}
                {notifications.length > 0 && unreadCount > 0 && (
                  <div className="px-4 py-3 border-t bg-muted/30">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-muted-foreground hover:text-foreground"
                      onClick={handleMarkAllAsRead}
                    >
                      Mark all as read
                    </Button>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Profile Trigger */}
            <Button variant="ghost" className="gap-2" onClick={() => setProfileDialogOpen(true)}>
              <Avatar className="h-8 w-8">
                {profileImage ? <AvatarImage src={profileImage} alt={user.name} /> : null}
                <AvatarFallback className="gradient-primary text-white text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-sm font-medium">{user.name}</span>
                <Badge className={cn("text-xs", getRoleBadgeColor(user.role))}>{getRoleDisplayName(user.role)}</Badge>
              </div>
            </Button>
          </div>
        </div>
      </header>

      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="sm:max-w-sm rounded-xl shadow-xl">
          <DialogHeader>
            <DialogTitle>Your Profile</DialogTitle>
            <DialogDescription>Quick view of your AMS account information.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            <Avatar className="h-20 w-20">
              {profileImage ? <AvatarImage src={profileImage} alt={user.name} /> : null}
              <AvatarFallback className="gradient-primary text-white text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <p className="text-base font-semibold text-[#25294B]">{fullNames || user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-1 inline-flex">
                <Badge className={cn("text-xs", getRoleBadgeColor(user.role))}>{getRoleDisplayName(user.role)}</Badge>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">First Name</span>
              <span className="font-medium text-[#25294B]">{firstName || "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Middle Name</span>
              <span className="font-medium text-[#25294B]">{middleName || "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Surname</span>
              <span className="font-medium text-[#25294B]">{surname || "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Employee ID</span>
              <span className="font-medium text-[#25294B]">{employeeIdDisplay}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Cell Number</span>
              <span className="font-medium text-[#25294B]">{cellNumber}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Job Title</span>
              <span className="font-medium text-[#25294B]">{jobTitle || "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Position</span>
              <span className="font-medium text-[#25294B]">{position}</span>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>
              Close
              </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notification Details Dialog */}
      <Dialog open={notificationDetailsOpen} onOpenChange={setNotificationDetailsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#25294B]">
              {selectedNotification?.title || "Notification Details"}
            </DialogTitle>
            {selectedNotification && (
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>{formatNotificationDate(selectedNotification.created_at)}</span>
                {selectedNotification.notification_type && (
                  <>
                    <span>•</span>
                    <Badge variant="outline" className="text-xs">
                      {selectedNotification.notification_type}
                    </Badge>
                  </>
                )}
              </div>
            )}
          </DialogHeader>
          
          {selectedNotification && (
            <div className="space-y-4 py-4">
              {/* Full Message */}
              <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedNotification.message}
                </p>
              </div>

              {/* Additional Details */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-border/30">
                  <span className="text-muted-foreground">Date & Time</span>
                  <span className="font-medium text-foreground">
                    {new Date(selectedNotification.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {selectedNotification.notification_type && (
                  <div className="flex items-center justify-between py-2 border-b border-border/30">
                    <span className="text-muted-foreground">Type</span>
                    <Badge variant="outline" className="text-xs">
                      {selectedNotification.notification_type}
                    </Badge>
                  </div>
                )}
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Status</span>
                  <Badge 
                    variant={selectedNotification.is_read ? "secondary" : "default"}
                    className={cn(
                      "text-xs",
                      !selectedNotification.is_read && "bg-[#92278F]/10 text-[#92278F] border-[#92278F]/20"
                    )}
                  >
                    {selectedNotification.is_read ? "Read" : "Unread"}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setNotificationDetailsOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative min-h-screen">
        {/* Sidebar */}
        <aside
          id={sidebarId}
          className={cn(
            "fixed inset-y-0 left-0 z-30 w-72 border-r border-[#E4E4E7] bg-background/98 shadow-lg transition-transform duration-300",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "md:translate-x-0",
          )}
        >
          <nav className="flex h-full flex-col gap-3 px-6 pt-24 pb-6 overflow-y-auto">
            {navigationTabs.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex min-h-[52px] items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-gradient-to-r from-[#A6206A]/10 to-[#C9234A]/10 text-[#25294B] border border-[#A6206A]/25 shadow-sm"
                      : "text-muted-foreground hover:text-[#25294B] hover:bg-muted/60",
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
            <div className="mt-auto border-t border-[#E4E4E7] pt-4 space-y-2">
              <Link
                href="/dashboard"
                className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-[#25294B] hover:bg-muted/60"
                onClick={() => setSidebarOpen(false)}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center text-[#92278F]">⇄</span>
                <span>Switch System</span>
              </Link>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-[#BE1E2D] hover:bg-red-50"
                onClick={() => {
                  setSidebarOpen(false)
                  handleLogout()
                }}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="min-h-screen p-6 pt-[5.5rem] transition-[padding] duration-300 md:pl-[21rem] md:pt-12">
          {children}
        </main>
      </div>

      {/* AI Chat Widget */}
      <AIChatWidget />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}


