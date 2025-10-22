"use client"

import React, { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth"
import {
  Users,
  Package,
  ArrowRight,
  Building2,
} from "lucide-react"

export default function SystemSelectorPage() {
  const router = useRouter()
  const user = getCurrentUser()

  useEffect(() => {
    if (!user) {
      router.push("/login")
    }
  }, [user, router])

  if (!user) return null

  const handleHRMSClick = () => {
    router.push("/hrms/dashboard")
  }

  const handleAMSClick = () => {
    router.push("/ams/dashboard")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Welcome Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <Building2 className="h-12 w-12 text-slate-600 mr-3" />
            <h1 className="text-4xl font-bold text-slate-800">XSpark Platform</h1>
          </div>
          <h2 className="text-2xl font-semibold text-slate-700 mb-2">
            Welcome back, {user.name}!
          </h2>
          <p className="text-lg text-slate-600">
            Choose a system to get started
          </p>
        </div>

        {/* System Selection Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* HRMS Card */}
          <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-100 hover:from-blue-100 hover:to-indigo-200">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 p-4 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white w-20 h-20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Users className="h-10 w-10" />
              </div>
              <CardTitle className="text-2xl font-bold text-slate-800 mb-2">
                HR Management System
              </CardTitle>
              <CardDescription className="text-slate-600 text-lg">
                Manage & Edit HR data
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-slate-600 mb-6 leading-relaxed">
                Access employee records, leave management, document handling, 
                and all human resources operations in one centralized platform.
              </p>
              <Button 
                onClick={handleHRMSClick}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 group-hover:shadow-lg"
                size="lg"
              >
                Open HR System
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>

          {/* AMS Card */}
          <Card className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-gradient-to-br from-purple-50 to-pink-100 hover:from-purple-100 hover:to-pink-200">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 p-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 text-white w-20 h-20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Package className="h-10 w-10" />
              </div>
              <CardTitle className="text-2xl font-bold text-slate-800 mb-2">
                Asset Management System
              </CardTitle>
              <CardDescription className="text-slate-600 text-lg">
                View & Organize Company Assets
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-slate-600 mb-6 leading-relaxed">
                Track device inventory, manage borrowing requests, monitor asset 
                conditions, and maintain comprehensive asset records.
              </p>
              <Button 
                onClick={handleAMSClick}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 group-hover:shadow-lg"
                size="lg"
              >
                Open Asset System
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-slate-500 text-sm">
            Both systems are part of the integrated XSpark platform
          </p>
        </div>
      </div>
    </div>
  )
}
