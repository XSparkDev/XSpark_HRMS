-- Database schema for notes table with proper constraints
-- This replaces the existing notes table structure

-- Drop existing table if it exists (for migration)
-- DROP TABLE IF EXISTS notes CASCADE;

-- Create notes table with proper constraints
CREATE TABLE IF NOT EXISTS notes (
    note_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NULL, -- profile link (nullable for general notes)
    author_id UUID NOT NULL,
    author_role TEXT NOT NULL CHECK (author_role IN ('employee', 'manager', 'hr_admin', 'admin', 'super_admin')),
    content TEXT NOT NULL,
    alert_level TEXT NOT NULL DEFAULT 'low' CHECK (alert_level IN ('high', 'medium', 'low')),
    visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('public', 'personal')),
    attachments JSONB NULL DEFAULT '[]'::JSONB,
    reminder_at TIMESTAMPTZ NULL,
    pinned BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_by UUID NULL,
    deleted_at TIMESTAMPTZ NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notes_alert_level ON notes(alert_level);
CREATE INDEX IF NOT EXISTS idx_notes_visibility ON notes(visibility);
CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status);
CREATE INDEX IF NOT EXISTS idx_notes_author_id ON notes(author_id);
CREATE INDEX IF NOT EXISTS idx_notes_employee_id ON notes(employee_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);

-- Composite index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_notes_high_public_active ON notes(alert_level, visibility, status, created_at DESC) 
WHERE alert_level = 'high' AND visibility = 'public' AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_notes_high_personal_active ON notes(alert_level, visibility, status, author_id, created_at DESC) 
WHERE alert_level = 'high' AND visibility = 'personal' AND status = 'active';

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION update_notes_updated_at();

-- Create audit log table for notes actions
CREATE TABLE IF NOT EXISTS notes_audit_log (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES notes(note_id) ON DELETE CASCADE,
    actor_id UUID NOT NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('create', 'view', 'edit', 'delete', 'visibility_change')),
    previous_value JSONB NULL,
    new_value JSONB NULL,
    ip_address INET NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for audit log queries
CREATE INDEX IF NOT EXISTS idx_notes_audit_log_note_id ON notes_audit_log(note_id);
CREATE INDEX IF NOT EXISTS idx_notes_audit_log_actor_id ON notes_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_notes_audit_log_created_at ON notes_audit_log(created_at DESC);

-- Migration script to fix existing data
-- Run this if migrating from existing notes table
DO $$
BEGIN
    -- Ensure all existing notes have note_id
    UPDATE notes SET note_id = gen_random_uuid() WHERE note_id IS NULL;
    
    -- Handle duplicate note_id if any exist
    WITH duplicates AS (
        SELECT note_id, COUNT(*) as count
        FROM notes
        GROUP BY note_id
        HAVING COUNT(*) > 1
    )
    UPDATE notes 
    SET note_id = gen_random_uuid()
    WHERE note_id IN (
        SELECT note_id FROM duplicates
    ) AND created_at NOT IN (
        SELECT MAX(created_at) FROM notes 
        WHERE note_id IN (SELECT note_id FROM duplicates)
        GROUP BY note_id
    );
    
    -- Add unique constraint if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'notes_note_id_unique'
    ) THEN
        ALTER TABLE notes ADD CONSTRAINT notes_note_id_unique UNIQUE (note_id);
    END IF;
END $$;

-- Row Level Security (RLS) policies
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notes
CREATE POLICY "Users can view own notes" ON notes
    FOR SELECT USING (author_id = current_setting('app.current_user_id')::UUID);

-- Policy: Users can view public notes
CREATE POLICY "Users can view public notes" ON notes
    FOR SELECT USING (visibility = 'public' AND status = 'active');

-- Policy: HR/Admin can view all notes
CREATE POLICY "HR Admin can view all notes" ON notes
    FOR SELECT USING (
        current_setting('app.current_user_role') IN ('hr_admin', 'admin', 'super_admin')
    );

-- Policy: Users can create their own notes
CREATE POLICY "Users can create own notes" ON notes
    FOR INSERT WITH CHECK (author_id = current_setting('app.current_user_id')::UUID);

-- Policy: Users can update their own notes
CREATE POLICY "Users can update own notes" ON notes
    FOR UPDATE USING (author_id = current_setting('app.current_user_id')::UUID);

-- Policy: HR/Admin can update any notes
CREATE POLICY "HR Admin can update any notes" ON notes
    FOR UPDATE USING (
        current_setting('app.current_user_role') IN ('hr_admin', 'admin', 'super_admin')
    );

-- Policy: Users can delete their own notes
CREATE POLICY "Users can delete own notes" ON notes
    FOR DELETE USING (author_id = current_setting('app.current_user_id')::UUID);

-- Policy: HR/Admin can delete any notes
CREATE POLICY "HR Admin can delete any notes" ON notes
    FOR DELETE USING (
        current_setting('app.current_user_role') IN ('hr_admin', 'admin', 'super_admin')
    );

-- Enable RLS on audit log
ALTER TABLE notes_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view audit logs for their own notes
CREATE POLICY "Users can view own audit logs" ON notes_audit_log
    FOR SELECT USING (
        note_id IN (
            SELECT note_id FROM notes 
            WHERE author_id = current_setting('app.current_user_id')::UUID
        )
    );

-- Policy: HR/Admin can view all audit logs
CREATE POLICY "HR Admin can view all audit logs" ON notes_audit_log
    FOR SELECT USING (
        current_setting('app.current_user_role') IN ('hr_admin', 'admin', 'super_admin')
    );

-- Insert audit log function
CREATE OR REPLACE FUNCTION insert_notes_audit_log(
    p_note_id UUID,
    p_actor_id UUID,
    p_actor_role TEXT,
    p_action TEXT,
    p_previous_value JSONB DEFAULT NULL,
    p_new_value JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    audit_id UUID;
BEGIN
    INSERT INTO notes_audit_log (
        note_id, actor_id, actor_role, action, 
        previous_value, new_value, ip_address, user_agent
    ) VALUES (
        p_note_id, p_actor_id, p_actor_role, p_action,
        p_previous_value, p_new_value, p_ip_address, p_user_agent
    ) RETURNING audit_id INTO audit_id;
    
    RETURN audit_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically log note changes
CREATE OR REPLACE FUNCTION log_note_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM insert_notes_audit_log(
            NEW.note_id,
            NEW.author_id,
            NEW.author_role,
            'create',
            NULL,
            row_to_json(NEW),
            NULL,
            NULL
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM insert_notes_audit_log(
            NEW.note_id,
            NEW.author_id,
            NEW.author_role,
            CASE 
                WHEN OLD.visibility != NEW.visibility THEN 'visibility_change'
                ELSE 'edit'
            END,
            row_to_json(OLD),
            row_to_json(NEW),
            NULL,
            NULL
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM insert_notes_audit_log(
            OLD.note_id,
            OLD.author_id,
            OLD.author_role,
            'delete',
            row_to_json(OLD),
            NULL,
            NULL,
            NULL
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_note_changes
    AFTER INSERT OR UPDATE OR DELETE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION log_note_changes();

-- Views for common queries
CREATE OR REPLACE VIEW global_high_alerts AS
SELECT 
    note_id,
    employee_id,
    author_id,
    author_role,
    content,
    alert_level,
    visibility,
    attachments,
    reminder_at,
    pinned,
    status,
    created_at,
    updated_at,
    deleted_by,
    deleted_at
FROM notes
WHERE alert_level = 'high' 
  AND visibility = 'public' 
  AND status = 'active'
ORDER BY created_at DESC
LIMIT 25;

CREATE OR REPLACE VIEW personal_high_alerts AS
SELECT 
    note_id,
    employee_id,
    author_id,
    author_role,
    content,
    alert_level,
    visibility,
    attachments,
    reminder_at,
    pinned,
    status,
    created_at,
    updated_at,
    deleted_by,
    deleted_at
FROM notes
WHERE alert_level = 'high' 
  AND visibility = 'personal' 
  AND status = 'active'
ORDER BY created_at DESC;
