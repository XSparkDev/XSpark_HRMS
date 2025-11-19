-- ============================================================================
-- DEVICES DATABASE SCHEMA
-- ============================================================================
-- This script creates the devices table schema for the Asset Management System
-- This must be created before running assigned-devices-schema.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLE: devices
-- ============================================================================
-- Purpose: Stores all company devices/assets (laptops, phones, tablets, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS devices (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Device Identification
    asset_tag VARCHAR(100) UNIQUE,              -- Asset tag (e.g., "DEV-001")
    serial_number VARCHAR(100) UNIQUE,          -- Serial number from manufacturer
    
    -- Device Information
    device_type VARCHAR(50) NOT NULL,           -- laptop, desktop, phone, tablet, monitor, etc.
    brand VARCHAR(100),                         -- Apple, Dell, HP, etc.
    model VARCHAR(100),                         -- MacBook Pro 14, XPS 13, etc.
    specs JSONB,                                -- Additional specifications (RAM, storage, etc.)
    
    -- Purchase & Warranty
    purchase_date DATE,                         -- Date of purchase
    warranty_expiry DATE,                       -- Warranty expiration date
    purchase_price DECIMAL(10, 2),              -- Purchase price
    
    -- Status & Condition
    condition VARCHAR(50) DEFAULT 'Good',       -- excellent, good, fair, poor, damaged, unusable
    status VARCHAR(50) DEFAULT 'available',     -- available, assigned, borrowed, maintenance, retired
    assigned_to UUID,                           -- References employees(id) - currently assigned employee
    
    -- Location
    location VARCHAR(255),                      -- Physical location/office
    
    -- Notes
    notes TEXT,                                 -- Additional notes about the device
    
    -- Soft Delete
    deleted_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_devices_assigned_to 
        FOREIGN KEY (assigned_to) 
        REFERENCES employees(id) 
        ON DELETE SET NULL,
    
    CONSTRAINT chk_device_status 
        CHECK (status IN ('available', 'assigned', 'borrowed', 'maintenance', 'retired', 'lost')),
    
    CONSTRAINT chk_asset_or_serial 
        CHECK (asset_tag IS NOT NULL OR serial_number IS NOT NULL)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_devices_asset_tag ON devices(asset_tag);
CREATE INDEX IF NOT EXISTS idx_devices_serial_number ON devices(serial_number);
CREATE INDEX IF NOT EXISTS idx_devices_device_type ON devices(device_type);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_assigned_to ON devices(assigned_to);
CREATE INDEX IF NOT EXISTS idx_devices_location ON devices(location);
CREATE INDEX IF NOT EXISTS idx_devices_condition ON devices(condition);
CREATE INDEX IF NOT EXISTS idx_devices_deleted ON devices(deleted_at) WHERE deleted_at IS NOT NULL;

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_devices_status_type ON devices(status, device_type);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_devices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION update_devices_updated_at();

COMMIT;

-- ============================================================================
-- DEVICES TABLE CREATION COMPLETE
-- ============================================================================







