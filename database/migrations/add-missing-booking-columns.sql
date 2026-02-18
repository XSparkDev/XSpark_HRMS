-- =============================================================================
-- Migration: Add Missing Columns to bookings Table
-- =============================================================================
-- This migration adds all columns that bookings-service.ts expects but are
-- missing from the current bookings table schema.
-- =============================================================================

ALTER TABLE public.bookings
  -- Status column (read by service, though updates are stripped)
  ADD COLUMN IF NOT EXISTS status text NULL,
  
  -- Check-in tracking (checked_in_at is separate from check_in_time)
  ADD COLUMN IF NOT EXISTS checked_in_at timestamp with time zone NULL,
  
  -- Approval workflow
  ADD COLUMN IF NOT EXISTS approved_by uuid NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone NULL,
  
  -- Rejection/Cancellation tracking
  ADD COLUMN IF NOT EXISTS rejection_reason text NULL,
  
  -- Timestamps (standard audit fields)
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NULL DEFAULT now(),
  
  -- Additional meeting metadata
  ADD COLUMN IF NOT EXISTS meeting_agenda text NULL,
  ADD COLUMN IF NOT EXISTS purpose text NULL,
  
  -- Optional date/time fields (for convenience, can be derived from start_time)
  ADD COLUMN IF NOT EXISTS date date NULL,
  ADD COLUMN IF NOT EXISTS booking_date date NULL,
  ADD COLUMN IF NOT EXISTS time text NULL;

-- Create indexes for commonly queried columns
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_booked_by ON public.bookings(booked_by);
CREATE INDEX IF NOT EXISTS idx_bookings_rejection_reason ON public.bookings(rejection_reason) WHERE rejection_reason IS NOT NULL;

-- Add comment to table
COMMENT ON TABLE public.bookings IS 'Room booking records with full workflow support (approval, cancellation, check-in)';

-- Add comments to new columns
COMMENT ON COLUMN public.bookings.status IS 'Booking status (read-only in service, cancellation uses rejection_reason)';
COMMENT ON COLUMN public.bookings.checked_in_at IS 'Timestamp when user checked in to the meeting';
COMMENT ON COLUMN public.bookings.approved_by IS 'UUID of user who approved the booking';
COMMENT ON COLUMN public.bookings.approved_at IS 'Timestamp when booking was approved';
COMMENT ON COLUMN public.bookings.rejection_reason IS 'Reason for rejection/cancellation (used to mark cancelled bookings)';
COMMENT ON COLUMN public.bookings.created_at IS 'Timestamp when booking was created';
COMMENT ON COLUMN public.bookings.updated_at IS 'Timestamp when booking was last updated';
COMMENT ON COLUMN public.bookings.meeting_agenda IS 'Detailed agenda for the meeting';
COMMENT ON COLUMN public.bookings.purpose IS 'Purpose of the meeting/booking';





