"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

type NoteVisibility = "personal" | "public"

interface EditNoteFormProps {
  note: {
    id: string
    title?: string | null
    content: string
    alert_level: "high" | "medium" | "low"
    visibility: NoteVisibility
    pinned: boolean
    tags?: string | null
    reminder_enabled?: boolean | null
    reminder_at?: string | null
  }
  onSave: (noteId: string, data: Partial<NewNoteInput>) => Promise<void>
  onCancel: () => void
}

interface NewNoteInput {
  title?: string
  content: string
  alert_level: "high" | "medium" | "low"
  visibility: NoteVisibility
  pinned?: boolean
  tags?: string
  reminder_enabled?: boolean
  reminder_at?: Date
}

export default function EditNoteForm({ note, onSave, onCancel }: EditNoteFormProps) {
  const [formData, setFormData] = useState<Partial<NewNoteInput>>({
    title: note.title ?? "",
    content: note.content,
    alert_level: note.alert_level,
    visibility: note.visibility,
    pinned: note.pinned,
    tags: note.tags ?? "",
    reminder_enabled: note.reminder_enabled ?? false,
    reminder_at: note.reminder_at ? new Date(note.reminder_at) : undefined,
  })

  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.content?.trim()) return

    setLoading(true)
    await onSave(note.id, {
      title: formData.title?.trim(),
      content: formData.content,
      alert_level: formData.alert_level || "low",
      visibility: formData.visibility || "personal",
      pinned: formData.pinned,
      tags: formData.tags,
      reminder_enabled: formData.reminder_enabled,
      reminder_at: formData.reminder_enabled && formData.reminder_at ? formData.reminder_at : undefined,
    })
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit-title">Title</Label>
        <Input
          id="edit-title"
          value={formData.title || ""}
          onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="Optional title for this note"
        />
      </div>

      <div>
        <Label htmlFor="edit-content">Note Content *</Label>
        <Textarea
          id="edit-content"
          value={formData.content}
          onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
          placeholder="Enter your note content..."
          rows={4}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="edit-alert-level">Alert Level</Label>
          <Select
            value={formData.alert_level ?? "low"}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, alert_level: value as any }))}
          >
            <SelectTrigger id="edit-alert-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="edit-visibility">Visibility</Label>
          <Select
            value={formData.visibility ?? "personal"}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, visibility: value as any }))}
          >
            <SelectTrigger id="edit-visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="personal">Personal</SelectItem>
              <SelectItem value="public">Public</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
        <Input
          id="edit-tags"
          value={formData.tags || ""}
          onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
          placeholder="e.g., training, performance, reminder"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="edit-reminder-enabled"
          checked={!!formData.reminder_enabled}
          onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, reminder_enabled: !!checked }))}
        />
        <Label htmlFor="edit-reminder-enabled">Set Reminder</Label>
      </div>

      {formData.reminder_enabled && (
        <div>
          <Label htmlFor="edit-reminder-at">Reminder Date</Label>
          <Input
            id="edit-reminder-at"
            type="datetime-local"
            value={formData.reminder_at ? formData.reminder_at.toISOString().slice(0, 16) : ""}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                reminder_at: e.target.value ? new Date(e.target.value) : undefined,
              }))
            }
          />
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id="edit-pinned"
          checked={!!formData.pinned}
          onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, pinned: !!checked }))}
        />
        <Label htmlFor="edit-pinned">Pin this note</Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  )
}


