"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { XSparkLogo } from "@/components/xspark-logo"
import { getCurrentUser } from "@/lib/auth"
import { Users, Building2 } from "lucide-react"

export default function SystemSelectorPage() {
  const router = useRouter()
  const user = getCurrentUser()

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!user) {
      router.push("/login")
      return
    }
  }, [user, router])

  if (!user) return null

  const handleSystemSelection = (systemPath: string) => {
    // Store the selected system for future logins
    localStorage.setItem("lastSelectedSystem", systemPath)
    router.push(systemPath)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-4xl mx-auto">
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
                className="w-40 mx-auto mt-auto gradient-primary text-white hover:opacity-90 transition-opacity"
              >
                Access HRMS
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
                className="w-40 mx-auto mt-auto gradient-primary text-white hover:opacity-90 transition-opacity"
              >
                Access AMS
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
