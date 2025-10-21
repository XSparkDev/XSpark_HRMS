-- ============================================================================
-- PHASE 1: FOUNDATION SETUP
-- ============================================================================
-- This phase sets up the basic environment and creates all ENUMs
-- Execute this first before any other phases
-- ============================================================================

-- Step 1.1: Environment Preparation
-- Verify PostgreSQL version and extensions
SELECT version();
SELECT * FROM pg_available_extensions WHERE name IN ('uuid-ossp', 'pgcrypto');

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Step 1.2: ENUM Creation
-- Create all ENUMs first (no dependencies)

-- Leave types
CREATE TYPE leave_type_enum AS ENUM (
    'sick',
    'annual',
    'unpaid',
    'maternity',
    'paternity',
    'family_responsibility',
    'other'
);

-- Leave request status
CREATE TYPE leave_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected'
);

-- Disciplinary action types
CREATE TYPE disciplinary_type_enum AS ENUM (
    'verbal',
    'written',
    'final'
);

-- Notification types
CREATE TYPE notification_type_enum AS ENUM (
    'internal',
    'external'
);

-- Audit log actions
CREATE TYPE audit_action_enum AS ENUM (
    'created',
    'updated',
    'approved',
    'rejected',
    'deleted',
    'archived',
    'restored',
    'escalated',
    'resolved'
);

-- Audit log severity
CREATE TYPE audit_severity_enum AS ENUM (
    'low',
    'high',
    'critical'
);

-- Employment status
CREATE TYPE employment_status_enum AS ENUM (
    'active',
    'suspended',
    'terminated',
    'probation',
    'absconded',
    'archived'
);

-- User roles
CREATE TYPE user_role_enum AS ENUM (
    'employee',
    'junior_hr',
    'hr_manager',
    'admin',
    'super_admin'
);

-- Gender options
CREATE TYPE gender_enum AS ENUM (
    'male',
    'female',
    'other',
    'prefer_not_to_say'
);

-- Sex options (biological, for ID verification)
CREATE TYPE sex_enum AS ENUM (
    'male',
    'female'
);

-- Payment method
CREATE TYPE payment_method_enum AS ENUM (
    'eft',
    'cash',
    'cheque'
);

-- AI chat intent
CREATE TYPE chat_intent_enum AS ENUM (
    'leave_inquiry',
    'payslip_request',
    'policy_question',
    'system_help',
    'general_query',
    'escalation'
);

-- ============================================================================
-- VALIDATION QUERIES
-- ============================================================================

-- Verify extensions were created
SELECT * FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto');

-- Verify all ENUMs were created
SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname;

-- Expected result: 12 ENUMs should be listed
-- leave_type_enum, leave_status_enum, disciplinary_type_enum,
-- notification_type_enum, audit_action_enum, audit_severity_enum,
-- employment_status_enum, user_role_enum, gender_enum,
-- sex_enum, payment_method_enum, chat_intent_enum

-- ============================================================================
-- SUCCESS CRITERIA
-- ============================================================================
-- ✅ PostgreSQL 15+ confirmed
-- ✅ Both extensions created successfully
-- ✅ All 12 ENUMs created without errors
-- ✅ No errors in extension creation
-- ============================================================================
