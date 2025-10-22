"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { getCurrentUser } from "@/lib/auth"

export interface Notification {
  id: string
  type: "info" | "success" | "warning" | "error"
  title: string
  message: string
  timestamp: Date
  read: boolean
  category: "asset" | "leave" | "document" | "system"
  actionUrl?: string
  userId?: string
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const user = getCurrentUser()

  // Load notifications from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined" && user) {
      const savedNotifications = localStorage.getItem(`notifications_${user.employeeId}`)
      if (savedNotifications) {
        try {
          const parsed = JSON.parse(savedNotifications)
          setNotifications(parsed.map((n: any) => ({
            ...n,
            timestamp: new Date(n.timestamp)
          })))
        } catch (error) {
          console.error("Error loading notifications:", error)
        }
      }
    }
  }, [user])

  // Save notifications to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined" && user) {
      localStorage.setItem(`notifications_${user.employeeId}`, JSON.stringify(notifications))
    }
  }, [notifications, user])

  const addNotification = (notification: Omit<Notification, "id" | "timestamp" | "read">) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
    }
    
    setNotifications(prev => [newNotification, ...prev])
    
    // Auto-remove after 7 days
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotification.id))
    }, 7 * 24 * 60 * 60 * 1000)
  }

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    )
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearAll = () => {
    setNotifications([])
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearAll,
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider")
  }
  return context
}

// Asset Management specific notification helpers
export function useAssetNotifications() {
  const { addNotification } = useNotifications()

  const notifyBorrowRequest = (deviceName: string, employeeName: string) => {
    addNotification({
      type: "info",
      title: "New Borrow Request",
      message: `${employeeName} requested to borrow ${deviceName}`,
      category: "asset",
      actionUrl: "/assets/all-devices",
    })
  }

  const notifyReturnRequest = (deviceName: string, employeeName: string) => {
    addNotification({
      type: "info",
      title: "Return Request",
      message: `${employeeName} wants to return ${deviceName}`,
      category: "asset",
      actionUrl: "/assets/all-devices",
    })
  }

  const notifyBorrowApproved = (deviceName: string) => {
    addNotification({
      type: "success",
      title: "Borrow Request Approved",
      message: `Your request to borrow ${deviceName} has been approved`,
      category: "asset",
      actionUrl: "/assets/borrow",
    })
  }

  const notifyBorrowRejected = (deviceName: string, reason?: string) => {
    addNotification({
      type: "error",
      title: "Borrow Request Rejected",
      message: `Your request to borrow ${deviceName} was rejected${reason ? `: ${reason}` : ""}`,
      category: "asset",
      actionUrl: "/assets/borrow",
    })
  }

  const notifyReturnApproved = (deviceName: string) => {
    addNotification({
      type: "success",
      title: "Return Approved",
      message: `Your return of ${deviceName} has been approved`,
      category: "asset",
      actionUrl: "/assets/return",
    })
  }

  const notifyMaintenanceDue = (deviceName: string, daysUntilDue: number) => {
    addNotification({
      type: "warning",
      title: "Maintenance Due",
      message: `${deviceName} maintenance is due in ${daysUntilDue} days`,
      category: "asset",
      actionUrl: "/assets/status",
    })
  }

  const notifyDamageReport = (deviceName: string, reportedBy: string) => {
    addNotification({
      type: "error",
      title: "Damage Report",
      message: `${reportedBy} reported damage to ${deviceName}`,
      category: "asset",
      actionUrl: "/assets/reports",
    })
  }

  return {
    notifyBorrowRequest,
    notifyReturnRequest,
    notifyBorrowApproved,
    notifyBorrowRejected,
    notifyReturnApproved,
    notifyMaintenanceDue,
    notifyDamageReport,
  }
}
