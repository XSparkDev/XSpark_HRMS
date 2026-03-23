-- =============================================================================
-- Migration: Add is_returned Column to borrows Table
-- =============================================================================
-- This migration adds the is_returned boolean column to properly track
-- returned devices in the borrow system.
-- =============================================================================

-- Add is_returned column with default value false
ALTER TABLE public.borrows
  ADD COLUMN IF NOT EXISTS is_returned boolean NOT NULL DEFAULT false;

-- Create index for efficient querying of active borrows
CREATE INDEX IF NOT EXISTS idx_borrows_is_returned ON public.borrows(is_returned) WHERE is_returned = false;
CREATE INDEX IF NOT EXISTS idx_borrows_active ON public.borrows(is_borrowed, is_returned) WHERE is_borrowed = true AND is_returned = false;

-- Add comment to column
COMMENT ON COLUMN public.borrows.is_returned IS 'Indicates if the device has been returned. When true, device is no longer borrowed.';

-- Update existing records: if return_date is set, mark as returned
UPDATE public.borrows
SET is_returned = true
WHERE return_date IS NOT NULL 
  AND is_returned = false;

-- Add comment to table
COMMENT ON TABLE public.borrows IS 'Device borrow records with full return tracking. Records are never deleted, only marked as returned.';
