"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser, logout } from "@/lib/auth"

export default function LandingPage() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const localUser = getCurrentUser()
      
      // If no user in localStorage, go straight to login
      if (!localUser) {
        router.replace("/login")
        return
      }

      // Validate session with server
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        })

        const data = await response.json()

        if (response.ok && data.success && data.data?.user) {
          // Session is valid, redirect to system selector
          router.replace("/system-selector")
        } else {
          // Session is invalid, clear localStorage and redirect to login
          logout()
          if (typeof window !== "undefined") {
            localStorage.removeItem("xspark_session")
            localStorage.removeItem("xspark_employee")
            localStorage.removeItem("lastSelectedSystem")
          }
          router.replace("/login")
        }
      } catch (error) {
        // If validation fails, clear session and redirect to login
        console.error("Session validation error:", error)
        logout()
        if (typeof window !== "undefined") {
          localStorage.removeItem("xspark_session")
          localStorage.removeItem("xspark_employee")
          localStorage.removeItem("lastSelectedSystem")
        }
        router.replace("/login")
      } finally {
        setIsChecking(false)
      }
    }

    checkAuth()
  }, [router])

  // Show nothing while checking or redirecting
  return null
}
