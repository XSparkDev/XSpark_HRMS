-- ============================================================================
-- Migration: Add new columns to maintenance_requests table
-- ============================================================================
-- This migration adds support for the new asset-based maintenance request model
-- Adds: asset_type, asset_id, issue_category, asset_usability, attachments
-- ============================================================================

-- Add asset_type column (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'maintenance_requests' 
        AND column_name = 'asset_type'
    ) THEN
        ALTER TABLE public.maintenance_requests
        ADD COLUMN asset_type text;
        
        -- Migrate existing device_id records to asset_type = 'device'
        UPDATE public.maintenance_requests
        SET asset_type = 'device'
        WHERE device_id IS NOT NULL;
        
        -- Migrate existing room_id records to asset_type = 'room'
        UPDATE public.maintenance_requests
        SET asset_type = 'room'
        WHERE room_id IS NOT NULL
          AND asset_type IS NULL;
    END IF;
END $$;

-- Add asset_id column (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'maintenance_requests' 
        AND column_name = 'asset_id'
    ) THEN
        ALTER TABLE public.maintenance_requests
        ADD COLUMN asset_id uuid;
        
        -- Migrate existing device_id records to asset_id
        UPDATE public.maintenance_requests
        SET asset_id = device_id
        WHERE device_id IS NOT NULL
          AND asset_id IS NULL;
        
        -- Migrate existing room_id records to asset_id
        UPDATE public.maintenance_requests
        SET asset_id = room_id
        WHERE room_id IS NOT NULL
          AND asset_id IS NULL;
    END IF;
END $$;

-- Add issue_category column (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'maintenance_requests' 
        AND column_name = 'issue_category'
    ) THEN
        ALTER TABLE public.maintenance_requests
        ADD COLUMN issue_category text;
    END IF;
END $$;

-- Add asset_usability column (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'maintenance_requests' 
        AND column_name = 'asset_usability'
    ) THEN
        ALTER TABLE public.maintenance_requests
        ADD COLUMN asset_usability text;
        
        -- Add check constraint for valid values
        ALTER TABLE public.maintenance_requests
        ADD CONSTRAINT chk_asset_usability 
        CHECK (asset_usability IS NULL OR asset_usability IN ('usable', 'not_usable', 'partially_usable'));
    END IF;
END $$;

-- Add attachments column (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'maintenance_requests' 
        AND column_name = 'attachments'
    ) THEN
        ALTER TABLE public.maintenance_requests
        ADD COLUMN attachments text; -- JSON array of attachment URLs/paths
    END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_asset_type ON public.maintenance_requests(asset_type);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_asset_id ON public.maintenance_requests(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_issue_category ON public.maintenance_requests(issue_category);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_asset_usability ON public.maintenance_requests(asset_usability);

-- Add comment to table
COMMENT ON COLUMN public.maintenance_requests.asset_type IS 'Type of asset: device, resource, or room';
COMMENT ON COLUMN public.maintenance_requests.asset_id IS 'UUID or string ID of the asset (references devices.device_id, resources.resource_id, or rooms.id)';
COMMENT ON COLUMN public.maintenance_requests.issue_category IS 'Category of the maintenance issue (hardware, software, facilities, etc.)';
COMMENT ON COLUMN public.maintenance_requests.asset_usability IS 'Current usability status: usable, partially_usable, or not_usable';
COMMENT ON COLUMN public.maintenance_requests.attachments IS 'JSON array of attachment file URLs/paths';

