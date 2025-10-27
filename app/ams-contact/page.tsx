"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { getCurrentUser } from "@/lib/auth"
import { Search, Plus, Mail, Phone, Building2, User, Edit, Trash2 } from "lucide-react"
import { useState } from "react"

export default function ContactManagementPage() {
  const user = getCurrentUser()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterRelationship, setFilterRelationship] = useState("all")

  if (!user) return null

  // Mock contact data matching the image
  const contacts = [
    {
      id: 1,
      name: "Witness Chauke",
      jobTitle: "Support Technician",
      email: "Witness@xspark.co.za",
      phone: "087 265 5236",
      department: "IT Support",
      role: "Supervisor",
      roleColor: "bg-blue-100 text-blue-800",
      description: "Primary contact for device maintenance and technical issues",
      addedDate: "15/01/2024",
      initials: "WC"
    },
    {
      id: 2,
      name: "Sapho Maqhwazima",
      jobTitle: "Director",
      email: "Sapho@xspark.co.za",
      phone: "087 265 5236",
      department: "Technology",
      role: "Director",
      roleColor: "bg-purple-100 text-purple-800",
      description: "Contact",
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
      description: "Contact for bug-related issues",
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
      description: "Contact",
      addedDate: "05/11/2025",
      initials: "KC"
    }
  ]

  const relationships = [
    { value: "all", label: "All Relationships" },
    { value: "supervisor", label: "Supervisor" },
    { value: "manager", label: "Manager" },
    { value: "colleague", label: "Colleague" },
    { value: "vendor", label: "Vendor" }
  ]

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.jobTitle.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesFilter = filterRelationship === "all" || 
                         contact.role.toLowerCase() === filterRelationship.toLowerCase()
    
    return matchesSearch && matchesFilter
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

        {/* Search and Filter Bar */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
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

          {!isEmployee && (
            <Button className="bg-pink-500 hover:bg-pink-600 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          )}
        </div>

        {/* Contact Cards Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredContacts.map((contact) => (
            <Card key={contact.id} className="group hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                {/* Action Icons - Only show for non-employees */}
                {!isEmployee && (
                  <div className="flex justify-end gap-2 mb-4">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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