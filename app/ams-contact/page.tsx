"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { getCurrentUser } from "@/lib/auth"
import { Search, Plus, Mail, Phone, Building2, User, Edit, Trash2, MessageSquare } from "lucide-react"
import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { addUserFeedbackEntry, addUserQueryEntry } from "@/lib/storage/contact-messages"

type ContactEntry = {
  id: string
  message: string
  createdAt: string
  recipient?: string
}

export default function ContactManagementPage() {
  const user = getCurrentUser()
  const [filterRelationship, setFilterRelationship] = useState("all")
  const [queryOpen, setQueryOpen] = useState(false)
  const [queryText, setQueryText] = useState("")
  const [queryRecipient, setQueryRecipient] = useState("Manager")
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState("")
  const [editOpen, setEditOpen] = useState(false)
  const [editContact, setEditContact] = useState<any>(null)
  if (!user) return null

  const userKey = user.id || user.email || "guest"

  // Mock contact data matching the image
  const [contacts, setContacts] = useState([
    {
      id: 1,
      name: "Witness Chauke",
      jobTitle: "Support Technician",
      email: "Witness@xspark.co.za",
      phone: "087 265 5236",
      department: "IT Support",
      role: "Supervisor",
      roleColor: "bg-blue-100 text-blue-800",
      description: "Responsible for providing technical assistance to users, troubleshooting hardware and software issues, maintaining system functionality, ensuring devices are properly tracked and updated in the system, and supporting the smooth operation of all technology assets.",
      addedDate: "15/01/2024",
      initials: "WC"
    },
    {
      id: 2,
      name: "Sapho Maqhwazima",
      jobTitle: "Chief Technology Officer",
      email: "Sapho@xspark.co.za",
      phone: "087 265 5236",
      department: "Technology",
      role: "Director",
      roleColor: "bg-purple-100 text-purple-800",
      description: "Responsible for defining the overall technology strategy, overseeing system architecture and design, ensuring data security, and guiding the development and integration of technologies to enhance system performance and align with organizational goals.",
      addedDate: "22/10/2025",
      initials: "SM"
    },
    {
      id: 3,
      name: "Pule Tshehla",
      jobTitle: "Software Developer",
      email: "Pule@xspark.co.za",
      phone: "087 265 5236",
      department: "Computer System Engineering",
      role: "Manager",
      roleColor: "bg-green-100 text-green-800",
      description: "Responsible for designing, developing, testing, and maintaining software features that manage and track assets, ensuring the system is efficient, secure, and user-friendly while integrating new technologies to improve functionality and performance.",
      addedDate: "05/11/2025",
      initials: "PT"
    },
    {
      id: 4,
      name: "Khaya Cokoto",
      jobTitle: "Chief Executive Officer",
      email: "Khaya@xspark.co.za",
      phone: "087 265 5236",
      department: "Technology",
      role: "Director",
      roleColor: "bg-purple-100 text-purple-800",
      description: "Responsible for providing overall leadership and strategic direction, making high-level decisions to ensure the system supports organizational goals, overseeing company operations and performance, and guiding teams to achieve efficiency, growth, and innovation.",
      addedDate: "05/11/2025",
      initials: "KC"
    }
  ])

  const relationships = [
    { value: "all", label: "All Relationships" },
    { value: "supervisor", label: "Supervisor" },
    { value: "manager", label: "Manager" },
    { value: "director", label: "Director" },
  ]

  const filteredContacts = contacts.filter(contact => {
    const matchesFilter = filterRelationship === "all" || 
                         contact.role.toLowerCase() === filterRelationship.toLowerCase()
    return matchesFilter
  })

  const isEmployee = user.role === "employee"

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-navy">Contact Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage contacts related to asset management
          </p>
        </div>

        {/* Filter Bar + Actions */}
        <div className="flex items-center gap-4">
          <Select value={filterRelationship} onValueChange={setFilterRelationship}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {relationships.map((rel) => (
                <SelectItem key={rel.value} value={rel.value}>
                  {rel.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white w-44">
                <MessageSquare className="h-4 w-4 mr-2" />
                Feedback
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-xl shadow-xl space-y-4">
              <DialogHeader className="space-y-2">
                <DialogTitle>Submit Feedback</DialogTitle>
                <DialogDescription>Your suggestions help us improve the system.</DialogDescription>
              </DialogHeader>
              <Textarea
                placeholder="Type your feedback..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={4}
              />
              <DialogFooter className="mt-4">
                <Button
                  onClick={() => {
                    if (!feedbackText.trim()) {
                      alert("Please enter feedback before submitting.")
                      return
                    }
                    const entry = {
                      id: `FDB-${Date.now()}`,
                      userId: userKey,
                      message: feedbackText.trim(),
                      createdAt: new Date().toISOString(),
                    }
                    addUserFeedbackEntry(entry)
                    setFeedbackEntries(getUserFeedbackEntries(userKey))
                    setFeedbackText("")
                    setFeedbackOpen(false)
                  }}
                  className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white"
                >
                  Send Feedback
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={queryOpen} onOpenChange={setQueryOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white w-44">
                <MessageSquare className="h-4 w-4 mr-2" />
                Submit a Query
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-xl shadow-xl space-y-4">
              <DialogHeader className="space-y-2">
                <DialogTitle>Submit a Query</DialogTitle>
                <DialogDescription>
                  Your message will be sent to your Manager or Supervisor.
                </DialogDescription>
              </DialogHeader>
              <div className="mb-3">
                <label className="text-sm">Send To</label>
                <Select value={queryRecipient} onValueChange={setQueryRecipient}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Supervisor">Supervisor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                placeholder="Type your message..."
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                rows={4}
              />
              <DialogFooter className="mt-4">
                <Button
                  onClick={() => {
                    if (!queryText.trim()) {
                      alert("Please enter a query before submitting.")
                      return
                    }
                    const entry = {
                      id: `QRY-${Date.now()}`,
                      userId: userKey,
                      message: queryText.trim(),
                      createdAt: new Date().toISOString(),
                      recipient: queryRecipient,
                    }
                    addUserQueryEntry(entry)
                    setQueryEntries(getUserQueryEntries(userKey))
                    setQueryText("")
                    setQueryOpen(false)
                  }}
                  className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white"
                >
                  Send Query
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Contact Cards Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredContacts.map((contact) => (
            <Card key={contact.id} className="group hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                {/* Action Icons - Only show for non-employees */}
                {!isEmployee && (
                  <div className="flex justify-end gap-2 mb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setEditContact(contact)
                        setEditOpen(true)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Avatar */}
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="h-12 w-12 bg-red-600">
                    <AvatarFallback className="bg-red-600 text-white font-semibold">
                      {contact.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-navy text-lg">{contact.name}</h3>
                    <p className="text-muted-foreground text-sm">{contact.jobTitle}</p>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-navy">{contact.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-navy">{contact.phone}</span>
                  </div>
                </div>

                {/* Role/Department */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-navy">{contact.department}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <Badge className={`${contact.roleColor} text-xs`}>
                      {contact.role}
                    </Badge>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground italic mb-4">
                  {contact.description}
                </p>

                {/* Added Date */}
                <div className="text-xs text-muted-foreground">
                  Added: {contact.addedDate}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Edit Contact Modal */}
        {!isEmployee && (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="space-y-4">
              <DialogHeader className="space-y-1">
                <DialogTitle>Edit Contact</DialogTitle>
                <DialogDescription>Update contact information</DialogDescription>
              </DialogHeader>
              {editContact && (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm">Name</label>
                      <Input
                        value={editContact.name}
                        onChange={(e) => setEditContact({ ...editContact, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm">Job Title</label>
                      <Input
                        value={editContact.jobTitle}
                        onChange={(e) => setEditContact({ ...editContact, jobTitle: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm">Email</label>
                      <Input
                        value={editContact.email}
                        onChange={(e) => setEditContact({ ...editContact, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm">Phone</label>
                      <Input
                        value={editContact.phone}
                        onChange={(e) => setEditContact({ ...editContact, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm">Department</label>
                      <Input
                        value={editContact.department}
                        onChange={(e) => setEditContact({ ...editContact, department: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm">Role</label>
                      <Select value={editContact.role} onValueChange={(v) => setEditContact({ ...editContact, role: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Supervisor">Supervisor</SelectItem>
                          <SelectItem value="Manager">Manager</SelectItem>
                          <SelectItem value="Director">Director</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm">Description</label>
                    <Textarea
                      value={editContact.description}
                      onChange={(e) => setEditContact({ ...editContact, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button
                  className="gradient-primary text-white"
                  onClick={() => {
                    setContacts((prev) => prev.map((c) => (c.id === editContact.id ? { ...c, ...editContact } : c)))
                    setEditOpen(false)
                  }}
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Empty State */}
        {filteredContacts.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No contacts found</h3>
                <p>Try adjusting your search or filter criteria.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AMSDashboardLayout>
  )
}