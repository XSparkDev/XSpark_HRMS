-- Migration: add reminder support to notes2
-- This allows users to schedule notes with reminders

-- Add reminder columns to notes2 table
ALTER TABLE notes2
  ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for efficient queries on scheduled notes
CREATE INDEX IF NOT EXISTS idx_notes2_reminder_at ON notes2(reminder_at)
WHERE reminder_enabled = TRUE AND reminder_at IS NOT NULL;

-- Create composite index for dashboard queries (notes with reminders within 3 days)
CREATE INDEX IF NOT EXISTS idx_notes2_reminder_dashboard ON notes2(reminder_at, employee_id, created_at DESC)
WHERE reminder_enabled = TRUE 
  AND reminder_at IS NOT NULL 
  AND reminder_at >= NOW() 
  AND reminder_at <= NOW() + INTERVAL '3 days';
















