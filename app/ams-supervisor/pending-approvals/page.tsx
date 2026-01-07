"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function PendingApprovalsPage() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to supervisor dashboard
    router.replace("/ams-supervisor")
  }, [router])

  return null
}
