"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { XSparkLogo } from "@/components/xspark-logo"
import { getCurrentUser, type User } from "@/lib/auth"
import { Users, Building2, LogOut, Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"

export default function SystemSelectorPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [navigatingToSystem, setNavigatingToSystem] = useState<string | null>(null)

  useEffect(() => {
    // Only access localStorage on the client side after hydration
    const currentUser = getCurrentUser()
    setUser(currentUser)
    setIsLoading(false)

    // Redirect to login if not authenticated
    if (!currentUser) {
      router.push("/login")
      return
    }
  }, [router])

  // Show loading state during initial hydration
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 md:p-6">
        <div className="text-center">
          <XSparkLogo className="h-12 md:h-16 w-auto mx-auto mb-6" />
          <Loader2 className="h-6 w-6 animate-spin text-[#92278F] mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  // If no user after loading, return null (redirect will happen in useEffect)
  if (!user) return null

  const handleSystemSelection = (systemPath: string) => {
    // Set loading state for the clicked system
    setNavigatingToSystem(systemPath)
    
    // Store the selected system for future logins
    localStorage.setItem("lastSelectedSystem", systemPath)
    
    // Navigate to the selected system
    router.push(systemPath)
  }

  const handleConfirmLogout = async () => {
    if (isLoggingOut) return

    setIsLoggingOut(true)

    try {
      // Attempt to invalidate Supabase session on the server
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }).catch(() => undefined)
    } finally {
      // Clear local session data regardless of API result
      try {
        localStorage.removeItem("xspark_session")
        localStorage.removeItem("xspark_user")
        localStorage.removeItem("xspark_employee")
        localStorage.removeItem("lastSelectedSystem")
      } catch {
        // ignore storage errors
      }

      // Clear in-memory user and redirect to login
      setUser(null)
      setIsLoggingOut(false)

      // Use replace to avoid back navigation returning to a protected page
      router.replace("/login")

      // Hard fallback navigation to ensure full reload if router fails
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          window.location.href = "/login"
        }, 50)
      }
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col p-4 md:p-6">
      {/* Header with logout button in far right corner */}
      <header className="w-full flex items-center justify-between mb-4 md:mb-6">
        <div className="flex-1"></div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 rounded-full border-[#E4E4E7] px-3 py-1.5 text-xs sm:text-sm font-medium text-[#4B4F68] hover:bg-[#F4F4F5]"
            >
              <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Log out</span>
              <span className="sm:hidden">Logout</span>
            </Button>
          </AlertDialogTrigger>
            <AlertDialogContent className="sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-bold text-[#1D1F2C]">
                  Logout Confirmation
                </AlertDialogTitle>
                <AlertDialogDescription className="text-base text-[#5F647A] pt-2">
                  Are you sure you want to do logout?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row gap-3 sm:justify-start pt-4">
                <AlertDialogAction
                  onClick={handleConfirmLogout}
                  disabled={isLoggingOut}
                  className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] hover:opacity-90 text-white flex-1 sm:flex-initial"
                >
                  {isLoggingOut ? "Logging out..." : "Confirm"}
                </AlertDialogAction>
                <AlertDialogCancel
                  disabled={isLoggingOut}
                  className="border-[#92278F] text-[#92278F] hover:bg-[#92278F]/10 flex-1 sm:flex-initial"
                >
                  Cancel
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
      </header>

      <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center flex-1">
        {/* Logo Section */}
        <div className="flex justify-center mb-8 md:mb-12">
          <XSparkLogo className="h-12 md:h-16 w-auto" />
        </div>

        {/* Main Heading */}
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-2xl md:text-3xl font-bold text-navy mb-4">Select a System to Continue</h1>
          <p className="text-muted-foreground text-base md:text-lg">
            Choose the system you want to access
          </p>
        </div>

        {/* System Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-2xl mx-auto items-stretch">
          {/* HR Management System */}
          <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/20 h-full">
            <CardContent className="p-6 md:p-8 text-center h-full flex flex-col">
              <div className="mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-navy mb-2 whitespace-nowrap">HR Management System</h2>
                <p className="text-muted-foreground text-sm mb-6 text-left">
                  Manage employees, leave requests, documents, and HR operations
                </p>
              </div>
              <Button 
                onClick={() => handleSystemSelection("/dashboard")}
                disabled={navigatingToSystem !== null}
                className="w-40 mx-auto mt-auto gradient-primary text-white hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {navigatingToSystem === "/dashboard" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  "Access HRMS"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Asset Management System */}
          <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/20 h-full">
            <CardContent className="p-6 md:p-8 text-center h-full flex flex-col">
              <div className="mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Building2 className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-navy mb-2 whitespace-nowrap">Asset Management System</h2>
                <p className="text-muted-foreground text-sm mb-6 text-left">
                  Track assets, manage inventory, and monitor equipment lifecycle
                </p>
              </div>
              <Button 
                onClick={() => handleSystemSelection("/ams-dashboard")}
                disabled={navigatingToSystem !== null}
                className="w-40 mx-auto mt-auto gradient-primary text-white hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {navigatingToSystem === "/ams-dashboard" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  "Access AMS"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            Welcome back, <span className="font-medium text-navy">{user.name}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
