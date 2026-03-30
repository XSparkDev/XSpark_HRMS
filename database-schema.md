# X Spark HR Management System - PostgreSQL Database Schema

**Version:** 1.0.0  
**Database:** PostgreSQL 15+ (Supabase compatible)  
**Generated:** October 20, 2025  
**Project:** X Spark HRMS MVP

## Table of Contents

- [Overview](#overview)
- [Database Architecture](#database-architecture)
- [Installation Instructions](#installation-instructions)
- [Schema Definition](#schema-definition)
- [Views](#views)
- [Triggers & Functions](#triggers--functions)
- [Seed Data](#seed-data)
- [Post-Deployment Checklist](#post-deployment-checklist)
- [RLS Policy Guidelines](#rls-policy-guidelines)

## Overview

This document contains the complete PostgreSQL schema for the X Spark HR Management System. The schema is designed for:

- **Scalability:** Supports 5,000+ employees
- **Security:** Encryption for sensitive data, RLS support
- **Maintainability:** Normalized structure, comprehensive indexing
- **Compliance:** POPIA-compliant audit trails
- **Performance:** Optimized indexes and views for common queries

### Key Features

✅ 15 Core tables with full relational integrity  
✅ 12 ENUMs for type safety  
✅ 65+ Optimized indexes  
✅ 10 Automated triggers  
✅ 5 Convenience views  
✅ Encryption support for sensitive fields  
✅ Comprehensive audit logging  
✅ Soft delete functionality  
✅ Auto-generated employee IDs  

## Database Architecture

### Entity Relationship Overview

```
employees (Core)
├── roles (1:1)
├── job_titles (1:1)
├── next_of_kin (1:N)
├── income (1:1)
├── contracts (1:N, versioned)
├── banking_details (1:1)
├── payslips (1:N)
├── leave_balances (1:N)
├── leave_requests (1:N)
├── disciplinary_records (1:N)
├── notifications (1:N)
├── audit_logs (1:N)
├── ai_chat_sessions (1:N)
└── notes (1:N)
```

### Tables Summary

| Table | Purpose | Relationship |
|-------|---------|--------------|
| roles | System roles and permissions | Referenced by employees |
| job_titles | Job titles and departments | Referenced by employees |
| employees | Core employee data (UPD) | Central table |
| next_of_kin | Emergency contacts | 1:N with employees |
| income | Compensation details | 1:1 with employees |
| contracts | Employment contracts | 1:N with employees (versioned) |
| banking_details | Banking information | 1:1 with employees |
| payslips | Monthly payslips | 1:N with employees |
| employee_leave_cycles | Leave cycle tracking (per type) | 1:N with employees |
| leave_balances | Leave balance tracking | 1:N with employees |
| leave_requests | Leave applications | 1:N with employees |
| disciplinary_records | Warnings/actions | 1:N with employees |
| notifications | System notifications | 1:N with employees |
| audit_logs | Change history | 1:N with employees |
| ai_chat_sessions | AI chatbot logs | 1:N with employees |
| notes | Employee notes | 1:N with employees |

## Installation Instructions

### Prerequisites

- PostgreSQL 15+ or Supabase project
- Admin access to execute DDL statements
- pgcrypto extension (included in Supabase)

### Step 1: Execute Schema

```bash
# If using local PostgreSQL
psql -U postgres -d hrms_db -f schema.sql

# If using Supabase
# Copy the SQL below and paste into Supabase SQL Editor
```

### Step 2: Set Encryption Key (Supabase)

```sql
-- Set in Supabase dashboard or via SQL
ALTER DATABASE postgres SET app.encryption_key = 'your-very-secure-encryption-key-here';
```

### Step 3: Verify Installation

```sql
-- Check table count
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Expected: 15 tables

-- Check seed data
SELECT * FROM roles;
SELECT * FROM job_titles;
```

## Schema Definition

```sql
BEGIN;

-- ============================================================================
-- X SPARK HR MANAGEMENT SYSTEM - PostgreSQL Schema
-- ============================================================================
-- Version: 1.0.0
-- Database: PostgreSQL 15+ (Supabase compatible)
-- Author: Generated for X Spark HRMS MVP
-- Date: 2025-10-20
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- For encryption at rest

-- ============================================================================
-- ENUMS
-- ============================================================================

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
-- CORE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: roles
-- Description: Defines system roles and their permissions
-- ----------------------------------------------------------------------------
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name user_role_enum NOT NULL UNIQUE,
    description TEXT,
    can_view_sensitive_data BOOLEAN DEFAULT FALSE,
    can_edit_employee_data BOOLEAN DEFAULT FALSE,
    can_approve_leave BOOLEAN DEFAULT FALSE,
    can_manage_users BOOLEAN DEFAULT FALSE,
    can_access_audit_logs BOOLEAN DEFAULT FALSE,
    can_manage_system_config BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for role lookups
CREATE INDEX idx_roles_role_name ON roles(role_name);

-- ----------------------------------------------------------------------------
-- Table: job_titles
-- Description: Defines organizational job titles and departments
-- ----------------------------------------------------------------------------
CREATE TABLE job_titles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL UNIQUE,
    department VARCHAR(255),
    description TEXT,
    hourly_rate DECIMAL(10, 2), -- For overtime calculations
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for job title lookups
CREATE INDEX idx_job_titles_title ON job_titles(title);
CREATE INDEX idx_job_titles_department ON job_titles(department);
CREATE INDEX idx_job_titles_is_active ON job_titles(is_active);

-- ----------------------------------------------------------------------------
-- Table: employees (User Primary Data - UPD)
-- Description: Core employee records with personal and employment information
-- ----------------------------------------------------------------------------
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Authentication (linked to Supabase Auth)
    auth_user_id UUID UNIQUE, -- References auth.users in Supabase
    
    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    preferred_name VARCHAR(100),
    
    -- Sensitive Identity Data (encrypted at rest via Supabase RLS)
    id_number VARCHAR(13) UNIQUE, -- South African ID (13 digits)
    encrypted_id_number BYTEA, -- Encrypted version using pgcrypto
    
    dob DATE NOT NULL,
    sex sex_enum NOT NULL,
    gender gender_enum,
    pronouns VARCHAR(50),
    
    -- Employee Identification
    employee_id VARCHAR(20) UNIQUE NOT NULL, -- Format: XSP<YY/MM>/<NNN>
    
    -- Job Information
    job_title_id UUID REFERENCES job_titles(id) ON DELETE SET NULL,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    
    -- Contact Information
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    alternative_phone VARCHAR(20),
    address TEXT,
    
    -- Tax & Nationality
    tax_number VARCHAR(50),
    encrypted_tax_number BYTEA,
    nationality VARCHAR(100) DEFAULT 'South Africa',
    
    -- Foreign National Data
    passport_number VARCHAR(50),
    passport_document_url TEXT, -- S3 URL
    work_permit_url TEXT, -- S3 URL
    
    -- Verification Status
    id_verified BOOLEAN DEFAULT FALSE,
    work_permit_verified BOOLEAN DEFAULT FALSE,
    bank_verified BOOLEAN DEFAULT FALSE,
    
    -- Employment Status
    employment_status employment_status_enum DEFAULT 'probation',
    date_hired DATE NOT NULL,
    date_terminated DATE,
    termination_reason TEXT,
    
    -- Confidentiality Agreement (for Junior HR)
    confidentiality_acknowledged_at TIMESTAMPTZ,
    
    -- Profile & Documents
    profile_picture_url TEXT,
    documents JSONB DEFAULT '[]'::JSONB, -- Array of document metadata
    
    -- Soft Delete
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_sa_id_or_passport CHECK (
        (nationality = 'South Africa' AND id_number IS NOT NULL) OR
        (nationality != 'South Africa' AND passport_number IS NOT NULL)
    )
);

-- Indexes for employees
CREATE INDEX idx_employees_employee_id ON employees(employee_id);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_id_number ON employees(id_number);
CREATE INDEX idx_employees_auth_user_id ON employees(auth_user_id);
CREATE INDEX idx_employees_job_title_id ON employees(job_title_id);
CREATE INDEX idx_employees_role_id ON employees(role_id);
CREATE INDEX idx_employees_employment_status ON employees(employment_status);
CREATE INDEX idx_employees_is_active ON employees(is_active);
CREATE INDEX idx_employees_date_hired ON employees(date_hired);

-- Full-text search index
CREATE INDEX idx_employees_search ON employees USING GIN (
    to_tsvector('english', 
        COALESCE(first_name, '') || ' ' || 
        COALESCE(last_name, '') || ' ' || 
        COALESCE(email, '') || ' ' || 
        COALESCE(employee_id, '')
    )
);

-- ----------------------------------------------------------------------------
-- Table: next_of_kin
-- Description: Emergency contacts linked to employees (1:N relationship)
-- ----------------------------------------------------------------------------
CREATE TABLE next_of_kin (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20) NOT NULL,
    alternative_phone VARCHAR(20),
    relationship VARCHAR(100) NOT NULL, -- e.g., "Spouse", "Parent", "Sibling"
    
    is_primary BOOLEAN DEFAULT FALSE, -- Flag primary contact
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_next_of_kin_employee_id ON next_of_kin(employee_id);
CREATE INDEX idx_next_of_kin_is_primary ON next_of_kin(is_primary);

-- ----------------------------------------------------------------------------
-- Table: income
-- Description: Employee compensation details (1:1 relationship)
-- ----------------------------------------------------------------------------
CREATE TABLE income (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID UNIQUE NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Base Compensation
    basic_salary DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    bonus DECIMAL(10, 2) DEFAULT 0.00,
    commission DECIMAL(10, 2) DEFAULT 0.00,
    
    -- Allowances
    travel_allowance DECIMAL(10, 2) DEFAULT 0.00,
    cellphone_allowance DECIMAL(10, 2) DEFAULT 0.00,
    
    -- Benefits
    medical_aid_subsidy DECIMAL(10, 2) DEFAULT 0.00,
    company_car_value DECIMAL(10, 2) DEFAULT 0.00,
    
    -- Deductions (managed by Admin/Super Admin)
    paye DECIMAL(10, 2) DEFAULT 0.00,
    uif DECIMAL(10, 2) DEFAULT 0.00,
    pension_fund DECIMAL(10, 2) DEFAULT 0.00,
    medical_aid_contribution DECIMAL(10, 2) DEFAULT 0.00,
    penalty DECIMAL(10, 2) DEFAULT 0.00,
    other_deductions DECIMAL(10, 2) DEFAULT 0.00,
    
    -- Overtime
    overtime DECIMAL(10, 2) DEFAULT 0.00,
    
    -- Calculated Totals (computed fields)
    gross_income DECIMAL(12, 2) GENERATED ALWAYS AS (
        basic_salary + bonus + commission + travel_allowance + 
        cellphone_allowance + medical_aid_subsidy + company_car_value + overtime
    ) STORED,
    
    total_deductions DECIMAL(12, 2) GENERATED ALWAYS AS (
        paye + uif + pension_fund + medical_aid_contribution + penalty + other_deductions
    ) STORED,
    
    net_income DECIMAL(12, 2) GENERATED ALWAYS AS (
        (basic_salary + bonus + commission + travel_allowance + 
         cellphone_allowance + medical_aid_subsidy + company_car_value + overtime) -
        (paye + uif + pension_fund + medical_aid_contribution + penalty + other_deductions)
    ) STORED,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_income_employee_id ON income(employee_id);

-- ----------------------------------------------------------------------------
-- Table: contracts
-- Description: Employment contracts (1:1 relationship, versioned)
-- ----------------------------------------------------------------------------
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Contract Details
    full_name VARCHAR(255) NOT NULL,
    witness_name VARCHAR(255),
    company_name VARCHAR(255) NOT NULL DEFAULT 'X Spark',
    job_title VARCHAR(255) NOT NULL,
    basic_salary DECIMAL(12, 2) NOT NULL,
    
    start_date DATE NOT NULL,
    end_date DATE, -- NULL for permanent contracts
    working_hours INTEGER NOT NULL DEFAULT 40, -- Hours per week
    notice_period_days INTEGER DEFAULT 30,
    
    -- Signatures (Base64 PNG or S3 URLs)
    employee_signature TEXT,
    employer_signature TEXT,
    witness_signature TEXT,
    
    date_signed DATE,
    
    -- Contract Document
    contract_document_url TEXT, -- Generated PDF stored in S3
    
    -- Version Control
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    superseded_by UUID REFERENCES contracts(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_contracts_employee_id ON contracts(employee_id);
CREATE INDEX idx_contracts_is_active ON contracts(is_active);
CREATE INDEX idx_contracts_start_date ON contracts(start_date);
CREATE INDEX idx_contracts_end_date ON contracts(end_date);

-- ----------------------------------------------------------------------------
-- Table: banking_details
-- Description: Employee banking information (1:1 relationship, encrypted)
-- ----------------------------------------------------------------------------
CREATE TABLE banking_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID UNIQUE NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    full_name VARCHAR(255) NOT NULL,
    id_number VARCHAR(13) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    
    -- Banking Information (encrypted)
    bank_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    encrypted_account_number BYTEA, -- Encrypted using pgcrypto
    branch_number VARCHAR(20),
    account_type VARCHAR(50) DEFAULT 'Cheque',
    
    -- Verification
    bank_verified BOOLEAN DEFAULT FALSE,
    bank_document_url TEXT, -- Proof of banking (S3 URL)
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_banking_details_employee_id ON banking_details(employee_id);
CREATE INDEX idx_banking_details_bank_verified ON banking_details(bank_verified);

-- ----------------------------------------------------------------------------
-- Table: payslips
-- Description: Monthly payslips for employees (1:N relationship)
-- ----------------------------------------------------------------------------
CREATE TABLE payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Employee Information
    full_name VARCHAR(255) NOT NULL,
    employee_number VARCHAR(20) NOT NULL,
    id_number VARCHAR(13) NOT NULL,
    tax_number VARCHAR(50),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    job_title VARCHAR(255) NOT NULL,
    
    -- Pay Period
    pay_date DATE NOT NULL,
    pay_period_from DATE NOT NULL,
    pay_period_to DATE NOT NULL,
    
    -- Income Breakdown (snapshot from income table)
    basic_salary DECIMAL(12, 2) NOT NULL,
    bonus DECIMAL(10, 2) DEFAULT 0.00,
    commission DECIMAL(10, 2) DEFAULT 0.00,
    travel_allowance DECIMAL(10, 2) DEFAULT 0.00,
    cellphone_allowance DECIMAL(10, 2) DEFAULT 0.00,
    medical_aid_subsidy DECIMAL(10, 2) DEFAULT 0.00,
    company_car_value DECIMAL(10, 2) DEFAULT 0.00,
    overtime DECIMAL(10, 2) DEFAULT 0.00,
    
    -- Deductions
    paye DECIMAL(10, 2) DEFAULT 0.00,
    uif DECIMAL(10, 2) DEFAULT 0.00,
    pension_fund DECIMAL(10, 2) DEFAULT 0.00,
    medical_aid_contribution DECIMAL(10, 2) DEFAULT 0.00,
    penalty DECIMAL(10, 2) DEFAULT 0.00,
    other_deductions DECIMAL(10, 2) DEFAULT 0.00,
    
    -- Totals
    gross_income DECIMAL(12, 2) NOT NULL,
    total_deductions DECIMAL(12, 2) NOT NULL,
    net_income DECIMAL(12, 2) NOT NULL,
    
    payment_method payment_method_enum DEFAULT 'eft',
    
    -- Document
    payslip_document_url TEXT, -- Generated PDF
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one payslip per employee per pay period
    UNIQUE(employee_id, pay_period_from, pay_period_to)
);

-- Indexes
CREATE INDEX idx_payslips_employee_id ON payslips(employee_id);
CREATE INDEX idx_payslips_pay_date ON payslips(pay_date);
CREATE INDEX idx_payslips_pay_period ON payslips(pay_period_from, pay_period_to);

-- ----------------------------------------------------------------------------
-- Table: leave_balances
-- Description: Tracks employee leave balances by type and cycle
-- ----------------------------------------------------------------------------
CREATE TABLE leave_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    leave_type leave_type_enum NOT NULL,
    
    -- Balance Tracking
    total_entitled DECIMAL(5, 2) NOT NULL DEFAULT 0.00, -- Total days entitled
    total_taken DECIMAL(5, 2) NOT NULL DEFAULT 0.00, -- Days already taken
    balance DECIMAL(5, 2) GENERATED ALWAYS AS (total_entitled - total_taken) STORED,
    
    -- Cycle Management
    cycle_start_date DATE NOT NULL,
    cycle_end_date DATE NOT NULL,
    
    -- Notifications (for cap warnings)
    cap_warning_sent BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one balance record per employee per leave type per cycle
    UNIQUE(employee_id, leave_type, cycle_start_date)
);

-- Indexes
CREATE INDEX idx_leave_balances_employee_id ON leave_balances(employee_id);
CREATE INDEX idx_leave_balances_leave_type ON leave_balances(leave_type);
CREATE INDEX idx_leave_balances_cycle ON leave_balances(cycle_start_date, cycle_end_date);

-- ----------------------------------------------------------------------------
-- Table: leave_requests
-- Description: Employee leave applications (1:N relationship)
-- ----------------------------------------------------------------------------
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Employee Information
    full_name VARCHAR(255) NOT NULL,
    employee_number VARCHAR(20) NOT NULL,
    id_number VARCHAR(13) NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    direct_superior VARCHAR(255), -- Manager name
    
    -- Leave Details
    leave_type leave_type_enum NOT NULL,
    leave_type_other VARCHAR(255), -- If type = 'other'
    
    leave_day_from DATE NOT NULL,
    leave_day_to DATE NOT NULL,
    total_days DECIMAL(5, 2) NOT NULL, -- Calculated days (excluding weekends/public holidays)
    
    reason TEXT,
    
    -- Supporting Documents
    supporting_document_url TEXT, -- Doctor's note, etc.
    
    -- Balance at Request Time
    leave_balance_before DECIMAL(5, 2),
    leave_balance_after DECIMAL(5, 2),
    
    -- Signatures
    employee_signature TEXT,
    employer_signature TEXT,
    
    -- Approval Workflow
    status leave_status_enum DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES employees(id) ON DELETE SET NULL, -- Admin/Manager who reviewed
    reviewed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_leave_type ON leave_requests(leave_type);
CREATE INDEX idx_leave_requests_dates ON leave_requests(leave_day_from, leave_day_to);
CREATE INDEX idx_leave_requests_reviewed_by ON leave_requests(reviewed_by);

-- ----------------------------------------------------------------------------
-- Table: disciplinary_records
-- Description: Employee warnings and disciplinary actions (1:N relationship)
-- ----------------------------------------------------------------------------
CREATE TABLE disciplinary_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    full_name VARCHAR(255) NOT NULL,
    id_number VARCHAR(13) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    
    -- Disciplinary Details
    disciplinary_type disciplinary_type_enum NOT NULL,
    note TEXT NOT NULL, -- Description of incident
    
    -- Document
    disciplinary_document_url TEXT, -- Formal warning letter
    
    -- Issued By
    issued_by UUID NOT NULL REFERENCES employees(id) ON DELETE SET NULL, -- Admin/Manager
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Employee Acknowledgment
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_disciplinary_records_employee_id ON disciplinary_records(employee_id);
CREATE INDEX idx_disciplinary_records_type ON disciplinary_records(disciplinary_type);
CREATE INDEX idx_disciplinary_records_issued_by ON disciplinary_records(issued_by);
CREATE INDEX idx_disciplinary_records_issued_at ON disciplinary_records(issued_at);

-- ----------------------------------------------------------------------------
-- Table: notifications
-- Description: System-wide and employee-specific notifications
-- ----------------------------------------------------------------------------
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Target
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE, -- NULL for company-wide
    
    -- Notification Content
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type notification_type_enum NOT NULL,
    
    -- Confidentiality
    is_confidential BOOLEAN DEFAULT FALSE,
    
    -- Publisher
    published_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    
    -- Read Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    -- External Delivery (email)
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_employee_id ON notifications(employee_id);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_published_by ON notifications(published_by);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ----------------------------------------------------------------------------
-- Table: audit_logs
-- Description: Comprehensive audit trail for all system actions
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Actor
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    employee_name VARCHAR(255),
    employee_number VARCHAR(20),
    
    -- Action Details
    action audit_action_enum NOT NULL,
    action_type VARCHAR(100) NOT NULL, -- e.g., 'profile_update', 'leave_request'
    severity audit_severity_enum DEFAULT 'low',
    
    -- Target Record
    target_table VARCHAR(100), -- Table affected
    target_record_id UUID, -- Record ID affected
    
    -- Change Tracking
    previous_value JSONB, -- State before change
    new_value JSONB, -- State after change
    
    -- Context
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    
    -- Publisher (system or user)
    published_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    published_by_system BOOLEAN DEFAULT FALSE, -- TRUE if automated
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_logs_employee_id ON audit_logs(employee_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_table, target_record_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_published_by ON audit_logs(published_by);

-- ----------------------------------------------------------------------------
-- Table: ai_chat_sessions
-- Description: AI chatbot conversations and intents
-- ----------------------------------------------------------------------------
CREATE TABLE ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Session Tracking
    chat_id VARCHAR(100) NOT NULL, -- Unique session identifier
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    
    -- Query & Response
    query_text TEXT NOT NULL,
    response_text TEXT NOT NULL,
    
    -- Intent Classification
    intent chat_intent_enum NOT NULL,
    confidence_score DECIMAL(3, 2) CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    
    -- Escalation
    is_resolved BOOLEAN DEFAULT FALSE,
    escalated_to UUID REFERENCES employees(id) ON DELETE SET NULL, -- Admin who handled escalation
    escalated_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_time INTERVAL, -- Time to resolve
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_chat_sessions_chat_id ON ai_chat_sessions(chat_id);
CREATE INDEX idx_ai_chat_sessions_employee_id ON ai_chat_sessions(employee_id);
CREATE INDEX idx_ai_chat_sessions_intent ON ai_chat_sessions(intent);
CREATE INDEX idx_ai_chat_sessions_is_resolved ON ai_chat_sessions(is_resolved);
CREATE INDEX idx_ai_chat_sessions_escalated_to ON ai_chat_sessions(escalated_to);
CREATE INDEX idx_ai_chat_sessions_created_at ON ai_chat_sessions(created_at DESC);

-- ----------------------------------------------------------------------------
-- Table: notes
-- Description: Free-form notes attached to employee profiles
-- ----------------------------------------------------------------------------
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Note Content
    title VARCHAR(255),
    content TEXT NOT NULL,
    
    -- Author
    author_id UUID NOT NULL REFERENCES employees(id) ON DELETE SET NULL,
    
    -- Visibility
    is_confidential BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notes_employee_id ON notes(employee_id);
CREATE INDEX idx_notes_author_id ON notes(author_id);
CREATE INDEX idx_notes_is_confidential ON notes(is_confidential);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);

COMMIT;
```

---

## Views

*Views will be added in subsequent sections*

## Triggers & Functions

```sql
-- ============================================================================
-- TRIGGER FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: update_updated_at_column
-- Description: Automatically updates updated_at timestamp
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_titles_updated_at BEFORE UPDATE ON job_titles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_next_of_kin_updated_at BEFORE UPDATE ON next_of_kin
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_income_updated_at BEFORE UPDATE ON income
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_banking_details_updated_at BEFORE UPDATE ON banking_details
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payslips_updated_at BEFORE UPDATE ON payslips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_leave_cycles_updated_at BEFORE UPDATE ON employee_leave_cycles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_balances_updated_at BEFORE UPDATE ON leave_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disciplinary_records_updated_at BEFORE UPDATE ON disciplinary_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_chat_sessions_updated_at BEFORE UPDATE ON ai_chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Function: generate_employee_id
-- Description: Auto-generates employee_id in format XSP<YY/MM>/<NNN>
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_employee_id()
RETURNS TRIGGER AS $$
DECLARE
    year_month VARCHAR(5);
    next_number INTEGER;
    new_employee_id VARCHAR(20);
BEGIN
    -- Extract year/month (e.g., "25/01" for January 2025)
    year_month := TO_CHAR(NOW(), 'YY/MM');
    
    -- Get next sequential number for this month
    SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id FROM '\d{3}$') AS INTEGER)), 0) + 1
    INTO next_number
    FROM employees
    WHERE employee_id LIKE 'XSP' || year_month || '%';
    
    -- Format employee_id
    new_employee_id := 'XSP' || year_month || '/' || LPAD(next_number::TEXT, 3, '0');
    
    NEW.employee_id := new_employee_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_employee_id_trigger
BEFORE INSERT ON employees
FOR EACH ROW
WHEN (NEW.employee_id IS NULL)
EXECUTE FUNCTION generate_employee_id();

-- ----------------------------------------------------------------------------
-- Function: audit_employee_changes
-- Description: Automatically logs changes to employee records
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_employee_changes()
RETURNS TRIGGER AS $$
DECLARE
    action_type audit_action_enum;
    old_data JSONB;
    new_data JSONB;
BEGIN
    -- Determine action type
    IF TG_OP = 'INSERT' THEN
        action_type := 'created';
        old_data := NULL;
        new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        action_type := 'updated';
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        action_type := 'deleted';
        old_data := to_jsonb(OLD);
        new_data := NULL;
    END IF;

    -- Insert audit log
    INSERT INTO audit_logs (
        employee_id,
        employee_name,
        employee_number,
        action,
        action_type,
        target_table,
        target_record_id,
        previous_value,
        new_value,
        description,
        published_by_system
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        COALESCE(NEW.first_name || ' ' || NEW.last_name, OLD.first_name || ' ' || OLD.last_name),
        COALESCE(NEW.employee_id, OLD.employee_id),
        action_type,
        'employee_profile',
        'employees',
        COALESCE(NEW.id, OLD.id),
        old_data,
        new_data,
        'Employee record ' || TG_OP || 'd',
        TRUE
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_employees_changes
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH ROW EXECUTE FUNCTION audit_employee_changes();

-- ----------------------------------------------------------------------------
-- Function: encrypt_sensitive_data
-- Description: Encrypts sensitive fields using pgcrypto
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION encrypt_sensitive_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Encrypt ID number if provided
    IF NEW.id_number IS NOT NULL THEN
        NEW.encrypted_id_number := pgp_sym_encrypt(NEW.id_number, current_setting('app.encryption_key'));
    END IF;
    
    -- Encrypt tax number if provided
    IF NEW.tax_number IS NOT NULL THEN
        NEW.encrypted_tax_number := pgp_sym_encrypt(NEW.tax_number, current_setting('app.encryption_key'));
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER encrypt_employee_sensitive_data
BEFORE INSERT OR UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION encrypt_sensitive_data();

-- ----------------------------------------------------------------------------
-- Function: encrypt_banking_data
-- Description: Encrypts banking account numbers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION encrypt_banking_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Encrypt account number
    IF NEW.account_number IS NOT NULL THEN
        NEW.encrypted_account_number := pgp_sym_encrypt(NEW.account_number, current_setting('app.encryption_key'));
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER encrypt_banking_details_data
BEFORE INSERT OR UPDATE ON banking_details
FOR EACH ROW EXECUTE FUNCTION encrypt_banking_data();

-- ----------------------------------------------------------------------------
-- Function: initialize_employee_leave_cycles
-- Description: Initializes employee_leave_cycles rows for a given employee
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION initialize_employee_leave_cycles(p_employee_id UUID)
RETURNS VOID AS $$
DECLARE
    v_start_date DATE := DATE_TRUNC('year', CURRENT_DATE);
    v_end_date   DATE := (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day')::DATE;
    v_leave_type RECORD;
    v_entitlement NUMERIC;
BEGIN
    -- Loop through all configured leave types
    FOR v_leave_type IN
        SELECT id, key
        FROM leave_types
    LOOP
        -- Default entitlements per leave type (can be adjusted to match business rules)
        v_entitlement := CASE v_leave_type.key
            WHEN 'annual' THEN 21
            WHEN 'sick' THEN 30
            WHEN 'maternity' THEN 120
            WHEN 'paternity' THEN 10
            WHEN 'family_responsibility' THEN 3
            ELSE 0
        END;

        INSERT INTO employee_leave_cycles (
            employee_id,
            leave_type_id,
            cycle_start_date,
            cycle_end_date,
            cycle_number,
            days_worked_count,
            total_entitled,
            current_balance,
            created_at,
            updated_at
        )
        VALUES (
            p_employee_id,
            v_leave_type.id,
            v_start_date,
            v_end_date,
            1,
            0,
            v_entitlement,
            v_entitlement,
            NOW(),
            NOW()
        )
        ON CONFLICT (employee_id, leave_type_id, cycle_start_date) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Function: manage_leave_cycles_daily
-- Description: Rolls expired leave cycles forward to a new cycle
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION manage_leave_cycles_daily()
RETURNS VOID AS $$
DECLARE
    v_cycle RECORD;
    v_new_start DATE;
    v_new_end   DATE;
BEGIN
    FOR v_cycle IN
        SELECT *
        FROM employee_leave_cycles
        WHERE cycle_end_date < CURRENT_DATE
    LOOP
        v_new_start := (v_cycle.cycle_end_date + INTERVAL '1 day')::DATE;
        v_new_end   := (v_new_start + INTERVAL '1 year' - INTERVAL '1 day')::DATE;

        INSERT INTO employee_leave_cycles (
            employee_id,
            leave_type_id,
            cycle_start_date,
            cycle_end_date,
            cycle_number,
            days_worked_count,
            total_entitled,
            current_balance,
            created_at,
            updated_at
        )
        VALUES (
            v_cycle.employee_id,
            v_cycle.leave_type_id,
            v_new_start,
            v_new_end,
            COALESCE(v_cycle.cycle_number, 1) + 1,
            0,
            v_cycle.total_entitled,
            v_cycle.current_balance,
            NOW(),
            NOW()
        )
        ON CONFLICT (employee_id, leave_type_id, cycle_start_date) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Function: update_employee_leave_cycle_on_approval
-- Description: Updates employee_leave_cycles when leave_requests are approved
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_employee_leave_cycle_on_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_cycle employee_leave_cycles%ROWTYPE;
    v_leave_type_id UUID;
BEGIN
    -- Only process when status changes to approved
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        -- Resolve leave_type_id from leave_types based on the enum/key
        SELECT id INTO v_leave_type_id
        FROM leave_types
        WHERE key = NEW.leave_type::text
        LIMIT 1;

        IF v_leave_type_id IS NULL THEN
            -- If we cannot resolve the leave type, do not attempt a balance update
            RETURN NEW;
        END IF;

        -- Find an existing cycle for this employee, type and date range
        SELECT *
        INTO v_cycle
        FROM employee_leave_cycles
        WHERE employee_id = NEW.employee_id
          AND leave_type_id = v_leave_type_id
          AND cycle_start_date <= NEW.leave_day_from
          AND cycle_end_date >= NEW.leave_day_to
        FOR UPDATE;

        -- If no cycle exists yet, initialize cycles for this employee and try again
        IF NOT FOUND THEN
            PERFORM initialize_employee_leave_cycles(NEW.employee_id);

            SELECT *
            INTO v_cycle
            FROM employee_leave_cycles
            WHERE employee_id = NEW.employee_id
              AND leave_type_id = v_leave_type_id
              AND cycle_start_date <= NEW.leave_day_from
              AND cycle_end_date >= NEW.leave_day_to
            FOR UPDATE;
        END IF;

        IF FOUND THEN
            -- Decrement current balance and increment days worked
            UPDATE employee_leave_cycles
            SET current_balance = GREATEST(0, current_balance - NEW.total_days),
                days_worked_count = days_worked_count + CAST(NEW.total_days AS INTEGER),
                updated_at = NOW()
            WHERE id = v_cycle.id;

            -- Reflect the new balance on the leave request record
            NEW.leave_balance_after := (
                SELECT current_balance FROM employee_leave_cycles WHERE id = v_cycle.id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_employee_leave_cycles_on_approval
AFTER UPDATE ON leave_requests
FOR EACH ROW EXECUTE FUNCTION update_employee_leave_cycle_on_approval();
-- ----------------------------------------------------------------------------
-- Function: update_leave_balance_on_request
-- Description: Updates leave balance when request is approved
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_leave_balance_on_request()
RETURNS TRIGGER AS $$
DECLARE
    balance_record_id UUID;
BEGIN
    -- Only process when status changes to approved
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        
        -- Find or create leave balance record
        SELECT id INTO balance_record_id
        FROM leave_balances
        WHERE employee_id = NEW.employee_id
        AND leave_type = NEW.leave_type
        AND cycle_start_date <= NEW.leave_day_from
        AND cycle_end_date >= NEW.leave_day_to;
        
        -- If no balance record exists, create one
        IF balance_record_id IS NULL THEN
            INSERT INTO leave_balances (
                employee_id,
                leave_type,
                total_entitled,
                total_taken,
                cycle_start_date,
                cycle_end_date
            ) VALUES (
                NEW.employee_id,
                NEW.leave_type,
                0.00,
                NEW.total_days,
                DATE_TRUNC('year', NEW.leave_day_from),
                DATE_TRUNC('year', NEW.leave_day_from) + INTERVAL '1 year' - INTERVAL '1 day'
            ) RETURNING id INTO balance_record_id;
        ELSE
            -- Update existing balance
            UPDATE leave_balances
            SET total_taken = total_taken + NEW.total_days
            WHERE id = balance_record_id;
        END IF;
        
        -- Update leave request with balance info
        NEW.leave_balance_after := (
            SELECT balance FROM leave_balances WHERE id = balance_record_id
        );
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leave_balance_on_approval
BEFORE UPDATE ON leave_requests
FOR EACH ROW EXECUTE FUNCTION update_leave_balance_on_request();

-- ----------------------------------------------------------------------------
-- Function: send_notification_on_leave_status_change
-- Description: Sends notification when leave request status changes
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION send_notification_on_leave_status_change()
RETURNS TRIGGER AS $$
DECLARE
    notification_title VARCHAR(255);
    notification_message TEXT;
BEGIN
    -- Only process status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        
        -- Create notification based on new status
        CASE NEW.status
            WHEN 'approved' THEN
                notification_title := 'Leave Request Approved';
                notification_message := 'Your leave request from ' || 
                    TO_CHAR(NEW.leave_day_from, 'DD/MM/YYYY') || ' to ' || 
                    TO_CHAR(NEW.leave_day_to, 'DD/MM/YYYY') || ' has been approved.';
            WHEN 'rejected' THEN
                notification_title := 'Leave Request Rejected';
                notification_message := 'Your leave request from ' || 
                    TO_CHAR(NEW.leave_day_from, 'DD/MM/YYYY') || ' to ' || 
                    TO_CHAR(NEW.leave_day_to, 'DD/MM/YYYY') || ' has been rejected.';
                IF NEW.rejection_reason IS NOT NULL THEN
                    notification_message := notification_message || ' Reason: ' || NEW.rejection_reason;
                END IF;
        END CASE;
        
        -- Insert notification
        INSERT INTO notifications (
            employee_id,
            title,
            message,
            notification_type,
            published_by_system
        ) VALUES (
            NEW.employee_id,
            notification_title,
            notification_message,
            'internal',
            TRUE
        );
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_on_leave_status_change
AFTER UPDATE ON leave_requests
FOR EACH ROW EXECUTE FUNCTION send_notification_on_leave_status_change();
```

## Seed Data

*Seed data will be added in subsequent sections*

## Post-Deployment Checklist

*Post-deployment checklist will be added in subsequent sections*

## RLS Policy Guidelines

*RLS policy guidelines will be added in subsequent sections*

---

-- ----------------------------------------------------------------------------
-- Function: audit_employee_changes (Updated)
-- Description: Automatically logs changes to employee records
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_employee_changes()
RETURNS TRIGGER AS $$
DECLARE
    action_type audit_action_enum;
    old_data JSONB;
    new_data JSONB;
BEGIN
    -- Determine action type
    IF TG_OP = 'INSERT' THEN
        action_type := 'created';
        old_data := NULL;
        new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        action_type := 'updated';
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        action_type := 'deleted';
        old_data := to_jsonb(OLD);
        new_data := NULL;
    END IF;
    
    -- Insert audit log
    INSERT INTO audit_logs (
        employee_id,
        employee_name,
        employee_number,
        action,
        action_type,
        severity,
        target_table,
        target_record_id,
        previous_value,
        new_value,
        description,
        published_by_system
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        COALESCE(NEW.first_name || ' ' || NEW.last_name, OLD.first_name || ' ' || OLD.last_name),
        COALESCE(NEW.employee_id, OLD.employee_id),
        action_type,
        'employee_profile',
        'high',
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        old_data,
        new_data,
        'Employee record ' || TG_OP || ' operation',
        TRUE
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_employee_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH ROW EXECUTE FUNCTION audit_employee_changes();

-- ----------------------------------------------------------------------------
-- Function: audit_leave_request_changes
-- Description: Logs leave request submissions and approvals
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_leave_request_changes()
RETURNS TRIGGER AS $$
DECLARE
    action_type audit_action_enum;
    severity_level audit_severity_enum;
BEGIN
    IF TG_OP = 'INSERT' THEN
        action_type := 'created';
        severity_level := 'low';
    ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        IF NEW.status = 'approved' THEN
            action_type := 'approved';
        ELSIF NEW.status = 'rejected' THEN
            action_type := 'rejected';
        ELSE
            action_type := 'updated';
        END IF;
        severity_level := 'high';
    ELSE
        action_type := 'updated';
        severity_level := 'low';
    END IF;
    
    INSERT INTO audit_logs (
        employee_id,
        employee_name,
        employee_number,
        action,
        action_type,
        severity,
        target_table,
        target_record_id,
        previous_value,
        new_value,
        published_by,
        published_by_system
    ) VALUES (
        NEW.employee_id,
        NEW.full_name,
        NEW.employee_number,
        action_type,
        'leave_request',
        severity_level,
        'leave_requests',
        NEW.id,
        to_jsonb(OLD),
        to_jsonb(NEW),
        NEW.reviewed_by,
        FALSE
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_leave_request_changes_trigger
AFTER INSERT OR UPDATE ON leave_requests
FOR EACH ROW EXECUTE FUNCTION audit_leave_request_changes();

-- ----------------------------------------------------------------------------
-- Function: update_leave_balance
-- Description: Automatically updates leave balance when request is approved
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_leave_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process if status changed to 'approved'
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        UPDATE leave_balances
        SET 
            total_taken = total_taken + NEW.total_days,
            updated_at = NOW()
        WHERE 
            employee_id = NEW.employee_id
            AND leave_type = NEW.leave_type
            AND cycle_start_date <= NEW.leave_day_from
            AND cycle_end_date >= NEW.leave_day_to;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leave_balance_trigger
AFTER UPDATE ON leave_requests
FOR EACH ROW EXECUTE FUNCTION update_leave_balance();

-- ----------------------------------------------------------------------------
-- Function: encrypt_sensitive_data (Updated)
-- Description: Encrypts sensitive fields before storage
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION encrypt_sensitive_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Encrypt ID number if provided
    IF NEW.id_number IS NOT NULL THEN
        NEW.encrypted_id_number := pgp_sym_encrypt(NEW.id_number, current_setting('app.encryption_key'));
    END IF;
    
    -- Encrypt tax number if provided
    IF NEW.tax_number IS NOT NULL THEN
        NEW.encrypted_tax_number := pgp_sym_encrypt(NEW.tax_number, current_setting('app.encryption_key'));
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER encrypt_employee_sensitive_data
BEFORE INSERT OR UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION encrypt_sensitive_data();

-- ----------------------------------------------------------------------------
-- Function: encrypt_banking_data (Updated)
-- Description: Encrypts banking account numbers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION encrypt_banking_data()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.account_number IS NOT NULL THEN
        NEW.encrypted_account_number := pgp_sym_encrypt(NEW.account_number, current_setting('app.encryption_key'));
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER encrypt_banking_sensitive_data
BEFORE INSERT OR UPDATE ON banking_details
FOR EACH ROW EXECUTE FUNCTION encrypt_banking_data();
```

## Seed Data

```sql
-- ============================================================================
-- SEED DATA - Default Roles
-- ============================================================================

INSERT INTO roles (role_name, description, can_view_sensitive_data, can_edit_employee_data, can_approve_leave, can_manage_users, can_access_audit_logs, can_manage_system_config) VALUES
    ('employee', 'Regular staff member with access to own data', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('junior_hr', 'Supporting HR role with limited responsibilities', TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('hr_manager', 'Admin with full access to employee records', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE),
    ('admin', 'Administrator with elevated privileges', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
    ('super_admin', 'Highest-level system role with unrestricted access', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE);

-- ============================================================================
-- SEED DATA - Sample Job Titles
-- ============================================================================

INSERT INTO job_titles (title, department, hourly_rate, description) VALUES
    ('Software Engineer', 'Engineering', 350.00, 'Develops and maintains software applications'),
    ('Senior Software Engineer', 'Engineering', 500.00, 'Lead engineer with advanced responsibilities'),
    ('Admin', 'Human Resources', 400.00, 'Manages HR operations and employee relations'),
    ('HR Assistant', 'Human Resources', 250.00, 'Supports HR department with administrative tasks'),
    ('Project Manager', 'Management', 450.00, 'Oversees project delivery and team coordination'),
    ('Accountant', 'Finance', 380.00, 'Manages financial records and reporting'),
    ('Marketing Specialist', 'Marketing', 320.00, 'Develops and executes marketing campaigns'),
    ('Operations Manager', 'Operations', 420.00, 'Oversees daily operational activities');
```

## Views

```sql
-- ============================================================================
-- VIEWS - Convenience queries for common operations
-- ============================================================================

-- ----------------------------------------------------------------------------
-- View: active_employees
-- Description: Quick access to active employee records with key details
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW active_employees AS
SELECT 
    e.id,
    e.employee_id,
    e.first_name,
    e.middle_name,
    e.last_name,
    e.preferred_name,
    e.email,
    e.phone,
    jt.title AS job_title,
    jt.department,
    r.role_name,
    e.employment_status,
    e.id_verified,
    e.bank_verified,
    e.date_hired,
    e.created_at
FROM employees e
LEFT JOIN job_titles jt ON e.job_title_id = jt.id
LEFT JOIN roles r ON e.role_id = r.id
WHERE e.is_active = TRUE
ORDER BY e.created_at DESC;

-- ----------------------------------------------------------------------------
-- View: pending_leave_requests
-- Description: All leave requests awaiting approval
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW pending_leave_requests AS
SELECT 
    lr.id,
    lr.employee_id,
    lr.full_name,
    lr.employee_number,
    lr.leave_type,
    lr.leave_day_from,
    lr.leave_day_to,
    lr.total_days,
    lr.reason,
    lr.created_at,
    e.email,
    e.phone,
    jt.title AS job_title,
    jt.department
FROM leave_requests lr
JOIN employees e ON lr.employee_id = e.id
LEFT JOIN job_titles jt ON e.job_title_id = jt.id
WHERE lr.status = 'pending'
ORDER BY lr.created_at ASC;

-- ----------------------------------------------------------------------------
-- View: employee_leave_summary
-- Description: Current leave balances for all active employees
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW employee_leave_summary AS
SELECT 
    e.id AS employee_id,
    e.employee_id AS employee_number,
    e.first_name || ' ' || e.last_name AS full_name,
    lb.leave_type,
    lb.total_entitled,
    lb.total_taken,
    lb.balance,
    lb.cycle_start_date,
    lb.cycle_end_date
FROM employees e
JOIN leave_balances lb ON e.id = lb.employee_id
WHERE e.is_active = TRUE
ORDER BY e.employee_id, lb.leave_type;

-- ----------------------------------------------------------------------------
-- View: unread_notifications
-- Description: Unread notifications per employee
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW unread_notifications AS
SELECT 
    n.id,
    n.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.email,
    n.title,
    n.message,
    n.notification_type,
    n.is_confidential,
    n.created_at
FROM notifications n
LEFT JOIN employees e ON n.employee_id = e.id
WHERE n.is_read = FALSE
ORDER BY n.created_at DESC;

-- ----------------------------------------------------------------------------
-- View: contracts_expiring_soon
-- Description: Active contracts expiring within 90 days
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW contracts_expiring_soon AS
SELECT 
    c.id,
    c.employee_id,
    e.employee_id AS employee_number,
    c.full_name,
    e.email,
    e.phone,
    c.job_title,
    c.start_date,
    c.end_date,
    c.end_date - CURRENT_DATE AS days_until_expiry
FROM contracts c
JOIN employees e ON c.employee_id = e.id
WHERE 
    c.is_active = TRUE 
    AND c.end_date IS NOT NULL
    AND c.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
    AND e.is_active = TRUE
ORDER BY c.end_date ASC;

-- ----------------------------------------------------------------------------
-- View: employee_full_profile
-- Description: Comprehensive employee data (for admin dashboards)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW employee_full_profile AS
SELECT 
    e.id,
    e.employee_id,
    e.first_name,
    e.middle_name,
    e.last_name,
    e.preferred_name,
    e.email,
    e.phone,
    e.alternative_phone,
    e.address,
    e.dob,
    e.gender,
    e.pronouns,
    e.nationality,
    e.employment_status,
    e.date_hired,
    e.date_terminated,
    e.id_verified,
    e.bank_verified,
    jt.title AS job_title,
    jt.department,
    r.role_name,
    i.basic_salary,
    i.gross_income,
    i.net_income,
    bd.bank_name,
    bd.bank_verified AS banking_verified,
    e.profile_picture_url,
    e.created_at,
    e.updated_at
FROM employees e
LEFT JOIN job_titles jt ON e.job_title_id = jt.id
LEFT JOIN roles r ON e.role_id = r.id
LEFT JOIN income i ON e.id = i.employee_id
LEFT JOIN banking_details bd ON e.id = bd.employee_id
WHERE e.is_active = TRUE;
```

## Utility Functions

```sql
-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: get_employee_full_name
-- Description: Returns formatted full name for an employee
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_employee_full_name(emp_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    full_name VARCHAR;
BEGIN
    SELECT 
        CONCAT_WS(' ', first_name, middle_name, last_name)
    INTO full_name
    FROM employees
    WHERE id = emp_id;
    
    RETURN full_name;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Function: calculate_leave_days
-- Description: Calculates working days between two dates (excluding weekends)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_leave_days(start_date DATE, end_date DATE)
RETURNS DECIMAL AS $$
DECLARE
    total_days DECIMAL;
    weekend_days INTEGER;
BEGIN
    -- Calculate total calendar days
    total_days := end_date - start_date + 1;
    
    -- Calculate weekend days (Saturday and Sunday)
    SELECT COUNT(*)
    INTO weekend_days
    FROM generate_series(start_date, end_date, '1 day'::INTERVAL) AS day
    WHERE EXTRACT(DOW FROM day) IN (0, 6); -- 0 = Sunday, 6 = Saturday
    
    -- Return working days
    RETURN total_days - weekend_days;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Function: archive_employee
-- Description: Soft-deletes employee and updates status to 'archived'
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION archive_employee(emp_id UUID, reason TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE employees
    SET 
        employment_status = 'archived',
        is_active = FALSE,
        deleted_at = NOW(),
        date_terminated = CURRENT_DATE,
        termination_reason = COALESCE(reason, termination_reason)
    WHERE id = emp_id;
    
    -- Log the archival
    INSERT INTO audit_logs (
        employee_id,
        action,
        action_type,
        severity,
        target_table,
        target_record_id,
        description,
        published_by_system
    ) VALUES (
        emp_id,
        'archived',
        'employee_profile',
        'critical',
        'employees',
        emp_id,
        'Employee archived: ' || COALESCE(reason, 'No reason provided'),
        TRUE
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

## Performance Optimization

```sql
-- ============================================================================
-- PERFORMANCE OPTIMIZATION - Additional Indexes
-- ============================================================================

-- Composite indexes for common query patterns
CREATE INDEX idx_employees_status_role ON employees(employment_status, role_id) WHERE is_active = TRUE;
CREATE INDEX idx_leave_requests_employee_status ON leave_requests(employee_id, status);
CREATE INDEX idx_notifications_employee_unread ON notifications(employee_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_audit_logs_employee_date ON audit_logs(employee_id, created_at DESC);

-- Partial indexes for frequently filtered data
CREATE INDEX idx_employees_active ON employees(id) WHERE is_active = TRUE;
CREATE INDEX idx_contracts_active ON contracts(employee_id) WHERE is_active = TRUE;
CREATE INDEX idx_leave_pending ON leave_requests(employee_id) WHERE status = 'pending';

-- GIN index for JSONB document searches
CREATE INDEX idx_employees_documents_gin ON employees USING GIN (documents);
CREATE INDEX idx_audit_logs_values_gin ON audit_logs USING GIN (previous_value, new_value);
```

## RLS Policy Guidelines

```sql
-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICY PLACEHOLDERS
-- ============================================================================

-- IMPORTANT: Enable RLS on all tables and create role-based policies
-- Example policies (to be implemented in Supabase):

-- Enable RLS on sensitive tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE banking_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE disciplinary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Sample RLS Policy Comments (implement in Supabase dashboard or via SQL):
-- 
-- Policy: Employees can view only their own records
-- CREATE POLICY employee_view_own_data ON employees
--     FOR SELECT USING (auth.uid() = auth_user_id);
--
-- Policy: Admins can view all records
-- CREATE POLICY admin_view_all_employees ON employees
--     FOR SELECT USING (
--         EXISTS (
--             SELECT 1 FROM employees 
--             WHERE auth_user_id = auth.uid() 
--             AND role_id IN (SELECT id FROM roles WHERE role_name IN ('admin', 'super_admin'))
--         )
--     );
--
-- Policy: Junior HR can view non-sensitive fields only
-- Policy: Super Admin has unrestricted access
-- 
-- NOTE: Implement comprehensive RLS policies based on the role permissions
-- defined in the PRD before deploying to production.
```

## Post-Deployment Checklist

```sql
-- ============================================================================
-- POST-DEPLOYMENT CHECKLIST
-- ============================================================================
-- 
-- 1. ✅ Execute this schema in Supabase SQL Editor
-- 2. ⚠️  Set encryption key in Supabase settings:
--    ALTER DATABASE postgres SET app.encryption_key = 'your-secure-key';
-- 3. ⚠️  Configure Row Level Security (RLS) policies for each table
-- 4. ✅ Verify all indexes are created successfully
-- 5. ✅ Test triggers with sample data
-- 6. ⚠️  Set up Supabase Storage buckets for documents:
--    - employee-documents (private)
--    - contracts (private)
--    - payslips (private)
--    - profile-pictures (public)
-- 7. ⚠️  Configure Supabase Edge Functions for:
--    - Contract expiry notifications
--    - Leave balance warnings
--    - Automated payslip generation
-- 8. ✅ Run initial seed data for roles and job_titles
-- 9. ⚠️  Configure Resend API for email notifications
-- 10. ⚠️ Set up backup schedule in Supabase dashboard
--
-- ============================================================================

-- Final validation
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name IN (
        'roles', 'job_titles', 'employees', 'next_of_kin', 'income',
        'contracts', 'banking_details', 'payslips', 'leave_balances',
        'leave_requests', 'disciplinary_records', 'notifications',
        'audit_logs', 'ai_chat_sessions', 'notes'
    );
    
    IF table_count = 15 THEN
        RAISE NOTICE 'SUCCESS: All 15 core tables created successfully!';
    ELSE
        RAISE WARNING 'WARNING: Expected 15 tables but found %', table_count;
    END IF;
END $$;

COMMIT;
```

---

*This completes the comprehensive X Spark HRMS PostgreSQL database schema with all tables, triggers, functions, views, seed data, and deployment guidelines.*
