"use client"

import { useState } from "react"
import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MessageSquare, LifeBuoy, AlertTriangle, EllipsisVertical, Activity, Mail } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getCurrentUser } from "@/lib/auth"
import { getUserFeedbackEntries, getUserQueryEntries } from "@/lib/storage/contact-messages"
import Link from "next/link"

const contacts = [
  {
    name: "Witness Chauke",
    jobTitle: "Support Technician",
    email: "Witness@xspark.co.za",
    department: "IT Support",
  },
  {
    name: "Sapho Maqhwazima",
    jobTitle: "Chief Technology Officer",
    email: "Sapho@xspark.co.za",
    department: "Technology",
  },
  {
    name: "Pule Tshehla",
    jobTitle: "Software Developer",
    email: "Pule@xspark.co.za",
    department: "Computer System Engineering",
  },
  {
    name: "Khaya Cokoto",
    jobTitle: "Chief Executive Officer",
    email: "Khaya@xspark.co.za",
    department: "Technology",
  },
]

export default function SupportSettingsPage() {
  const user = getCurrentUser()
  const userKey = user?.id || user?.email || "guest"
  const [feedbackEntries, setFeedbackEntries] = useState(() => getUserFeedbackEntries(userKey))
  const [queryEntries, setQueryEntries] = useState(() => getUserQueryEntries(userKey))
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [queriesModalOpen, setQueriesModalOpen] = useState(false)
  const [contactModalOpen, setContactModalOpen] = useState(false)

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#25294B]">Support Settings</h1>
          <p className="text-muted-foreground mt-2">
            Reach out for help, browse documentation, or let us know when something is wrong.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Contact IT / Support Card */}
          <Card className="border border-[#808285]/20 bg-gradient-to-br from-white via-[#92278F]/5 to-[#BE1E2D]/10 flex flex-col">
            <CardHeader className="space-y-2 relative pb-4">
              <CardTitle className="flex items-center gap-2 text-[#25294B] text-lg">
                <MessageSquare className="h-5 w-5 text-[#92278F]" />
                Contact IT / Support
              </CardTitle>
              <CardDescription className="text-[#58595B]">
                Chat to IT or log a support request.
              </CardDescription>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-4 right-4 text-[#58595B] hover:text-[#25294B] hover:bg-[#92278F]/10 transition-colors"
                  >
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
            <CardContent className="flex-1 flex flex-col justify-end pt-4">
              <Button 
                onClick={() => setContactModalOpen(true)}
                className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90 active:opacity-80 transition-opacity w-full"
              >
                Contact
              </Button>
            </CardContent>
          </Card>

          {/* Help Center / FAQ Card */}
          <Card className="border border-[#808285]/20 bg-gradient-to-br from-white via-[#808285]/6 to-[#25294B]/8 flex flex-col">
            <CardHeader className="space-y-2 pb-4">
              <CardTitle className="flex items-center gap-2 text-[#25294B] text-lg">
                <LifeBuoy className="h-5 w-5 text-[#25294B]" />
                Help Center / FAQ
              </CardTitle>
              <CardDescription className="text-[#58595B]">
                Browse guides, policies, and answers to common questions.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-end pt-4">
              <Button 
                onClick={() => setContactModalOpen(true)}
                className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90 active:opacity-80 transition-opacity w-full"
              >
                Contact
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Report System Issues Card */}
        <Card className="border border-[#808285]/20 bg-gradient-to-br from-white via-[#BE1E2D]/6 to-[#92278F]/8 flex flex-col">
          <CardHeader className="space-y-2 pb-4">
            <CardTitle className="flex items-center gap-2 text-[#25294B] text-lg">
              <AlertTriangle className="h-5 w-5 text-[#BE1E2D]" />
              Report System Issues
            </CardTitle>
            <CardDescription className="text-[#58595B]">
              Let us know if something is broken or affecting your work.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end pt-4">
            <Button 
              onClick={() => setContactModalOpen(true)}
              className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90 active:opacity-80 transition-opacity w-full"
            >
              Contact
            </Button>
          </CardContent>
        </Card>

        {/* Activity / Audit Log Card */}
        <Card className="border border-[#808285]/20 bg-gradient-to-br from-white via-[#92278F]/6 to-[#BE1E2D]/10 flex flex-col">
          <CardHeader className="space-y-2 pb-4">
            <CardTitle className="flex items-center gap-2 text-[#25294B] text-lg">
              <Activity className="h-5 w-5 text-[#92278F]" />
              Activity / Audit Log
            </CardTitle>
            <CardDescription className="text-[#58595B]">
              View system activity history and audit logs.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end pt-4">
            <Button 
              asChild
              className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90 active:opacity-80 transition-opacity w-full"
            >
              <Link href="/ams-activity-log">View Activity Log</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Contact Modal */}
      <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent className="sm:max-w-lg space-y-4">
          <DialogHeader className="space-y-1">
            <DialogTitle>Contact Support</DialogTitle>
            <DialogDescription>Get in touch with our support team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {contacts.map((contact, index) => (
              <div key={index} className="rounded-lg border border-[#808285]/20 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-[#25294B]">{contact.name}</h3>
                    <p className="text-sm text-[#58595B]">{contact.jobTitle}</p>
                    <p className="text-xs text-[#58595B] mt-1">{contact.department}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="border-[#92278F]/30 hover:bg-[#92278F]/5 hover:border-[#92278F]/50 transition-colors"
                  >
                    <a href={`mailto:${contact.email}`}>
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedbacks Submitted Dialog */}
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

      {/* Queries Submitted Dialog */}
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