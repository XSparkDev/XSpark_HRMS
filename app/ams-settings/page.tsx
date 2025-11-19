"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MessageSquare, LifeBuoy, AlertTriangle, EllipsisVertical } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getCurrentUser } from "@/lib/auth"
import { getUserFeedbackEntries, getUserQueryEntries } from "@/lib/storage/contact-messages"

export default function SupportSettingsPage() {
  const user = getCurrentUser()
  const userKey = user?.id || user?.email || "guest"
  const [feedbackEntries, setFeedbackEntries] = useState(() => getUserFeedbackEntries(userKey))
  const [queryEntries, setQueryEntries] = useState(() => getUserQueryEntries(userKey))
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [queriesModalOpen, setQueriesModalOpen] = useState(false)

  useEffect(() => {
    setFeedbackEntries(getUserFeedbackEntries(userKey))
  }, [userKey, feedbackModalOpen])

  useEffect(() => {
    setQueryEntries(getUserQueryEntries(userKey))
  }, [userKey, queriesModalOpen])

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-navy">Support Settings</h1>
          <p className="text-muted-foreground mt-2">
            Reach out for help, browse documentation, or let us know when something is wrong.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border border-[#808285]/20 bg-gradient-to-br from-white via-[#92278F]/5 to-[#BE1E2D]/10">
            <CardHeader className="space-y-2 relative">
              <CardTitle className="flex items-center gap-2 text-[#25294B]">
                <MessageSquare className="h-5 w-5 text-[#92278F]" />
                Contact IT / Support
              </CardTitle>
              <CardDescription>Chat to IT or log a support request.</CardDescription>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-[#58595B] hover:text-[#25294B]">
                    <EllipsisVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setFeedbackModalOpen(true)}>
                    Feedbacks Submitted
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setQueriesModalOpen(true)}>
                    Queries Submitted
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-[#58595B]">
                Need help with your assets, room bookings, or system access? Reach the support team directly.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/ams-contact">
                  <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white">
                    Open Contact Portal
                  </Button>
                </Link>
                <Button variant="outline" onClick={() => window.open("mailto:support@xspark.co.za", "_blank")}>
                  Email Support
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[#808285]/20 bg-gradient-to-br from-white via-[#808285]/6 to-[#25294B]/8">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-[#25294B]">
                <LifeBuoy className="h-5 w-5 text-[#25294B]" />
                Help Center / FAQ
              </CardTitle>
              <CardDescription>Browse guides, policies, and answers to common questions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-[#58595B]">
                Learn how to book rooms, manage hardware, and troubleshoot issues with self-service resources.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => window.open("/help-center", "_blank")}>
                  Open Help Center
                </Button>
                <Button variant="ghost" className="text-[#92278F]" onClick={() => window.open("/faq", "_blank")}>
                  View FAQ
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border border-[#808285]/20 bg-gradient-to-br from-white via-[#BE1E2D]/6 to-[#92278F]/8">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-[#25294B]">
              <AlertTriangle className="h-5 w-5 text-[#BE1E2D]" />
              Report System Issues
            </CardTitle>
            <CardDescription>Let us know if something is broken or affecting your work.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[#58595B]">
              Experiencing downtimes, data glitches, or unexpected errors? Submit a detailed report and the support team will respond.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/ams-contact">
                <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white">
                  Report an Issue
                </Button>
              </Link>
              <Button variant="outline" onClick={() => window.open("/status", "_blank")}>
                View System Status
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen}>
        <DialogContent className="sm:max-w-lg space-y-4">
          <DialogHeader className="space-y-1">
            <DialogTitle>Feedbacks Submitted</DialogTitle>
            <DialogDescription>Your previously submitted feedback entries.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {feedbackEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">You haven't submitted any feedback yet.</p>
            ) : (
              feedbackEntries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-[#808285]/20 p-3">
                  <p className="text-sm text-[#25294B]">{entry.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={queriesModalOpen} onOpenChange={setQueriesModalOpen}>
        <DialogContent className="sm:max-w-lg space-y-4">
          <DialogHeader className="space-y-1">
            <DialogTitle>Queries Submitted</DialogTitle>
            <DialogDescription>Review your support queries sent to leadership.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {queryEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No queries submitted yet.</p>
            ) : (
              queryEntries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-[#808285]/20 p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>To: {entry.recipient}</span>
                    <span>{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-[#25294B]">{entry.message}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AMSDashboardLayout>
  )
}
