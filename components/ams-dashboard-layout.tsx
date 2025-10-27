"use client"

import { type ReactNode, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { XSparkLogo } from "@/components/xspark-logo"
import { getCurrentUser, logout, getRoleBadgeColor, getRoleDisplayName, hasPermission } from "@/lib/auth"
import {
  Home,
  Building2,
  Package,
  Wrench,
  Settings,
  LogOut,
  Bell,
  Search,
  Menu,
  X,
  MessageSquare,
  User,
  ClipboardList,
  Calendar,
  ArrowRightLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AMSDashboardLayoutProps {
  children: ReactNode
}

export function AMSDashboardLayout({ children }: AMSDashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const user = getCurrentUser()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (!user) {
    router.push("/login")
    return null
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const navigation = [
    { name: "Dashboard", href: "/ams-dashboard", icon: Home, permission: "*" },
    { name: "Device Management", href: "/ams-devices", icon: Package, permission: "*" },
    { name: "Room Bookings", href: "/ams-bookings", icon: Building2, permission: "*" },
    { name: "Calendar", href: "/ams-calendar", icon: Calendar, permission: "*" },
    { name: "Maintenance Requests", href: "/ams-maintenance", icon: Wrench, permission: "*" },
    { name: "Contact", href: "/ams-contact", icon: MessageSquare, permission: "*" },
    { name: "Settings", href: "/ams-settings", icon: Settings, permission: "*" },
  ]

  const filteredNavigation = navigation.filter((item) => {
    if (item.permission === "*") return true
    return hasPermission(user, item.permission)
  })

  // For Employee view, show only specific AMS navigation items
  const isEmployee = user.role === "employee"
  const employeeNavigation = [
    { name: "Dashboard", href: "/ams-dashboard", icon: Home, permission: "*" },
    { name: "Device Management", href: "/ams-devices", icon: Package, permission: "*" },
    { name: "Room Bookings", href: "/ams-bookings", icon: Building2, permission: "*" },
    { name: "Calendar", href: "/ams-calendar", icon: Calendar, permission: "*" },
    { name: "Maintenance Requests", href: "/ams-maintenance", icon: Wrench, permission: "*" },
    { name: "Contact", href: "/ams-contact", icon: MessageSquare, permission: "*" },
    { name: "Settings", href: "/ams-settings", icon: Settings, permission: "*" },
  ]

  const displayNavigation = isEmployee ? employeeNavigation : filteredNavigation

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="flex h-16 items-center gap-4 px-6">
          {/* Mobile menu button */}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          {/* Logo */}
          <Link href="/ams-dashboard" className="flex items-center">
            <XSparkLogo className="h-8 w-auto" />
          </Link>

          {/* System Name - Centered */}
          <div className="flex-1 flex justify-center">
            <h1 className="text-xl font-semibold text-navy">Asset Management System</h1>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            {/* System Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowRightLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Switch System</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Available Systems</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    HR Management System
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/ams-dashboard" className="cursor-pointer">
                    <Package className="mr-2 h-4 w-4" />
                    Asset Management System
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#E31E24]" />
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="gradient-primary text-white text-xs">
                      {user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-medium">{user.name}</span>
                    <Badge className={cn("text-xs", getRoleBadgeColor(user.role))}>{getRoleDisplayName(user.role)}</Badge>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 w-64 border-r bg-background transition-transform duration-300 md:translate-x-0 md:static",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <nav className="flex flex-col gap-2 p-4 pt-20 md:pt-4">
            {displayNavigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-gradient-to-r from-[#A6206A]/10 to-[#C9234A]/10 text-navy border-l-4 border-l-[#A6206A]"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>

      {/* AI Chatbot Widget */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="icon"
          className="h-14 w-14 rounded-full gradient-primary text-white shadow-lg hover:shadow-xl transition-all animate-pulse"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      </div>

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
