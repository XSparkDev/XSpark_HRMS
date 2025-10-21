# X Spark HRMS Database Implementation Plan

**Version:** 1.0.0  
**Database:** PostgreSQL 15+ (Supabase compatible)  
**Created:** January 2025  
**Project:** X Spark HRMS MVP

## Overview

This document outlines the step-by-step implementation plan for creating the X Spark HRMS PostgreSQL database schema. Each step includes dependency validation, rollback procedures, and success criteria.

## Implementation Strategy

- **Dependency-First Approach**: Create tables in order of dependencies
- **Validation at Each Step**: Verify creation before proceeding
- **Rollback Procedures**: Clear rollback steps for each phase
- **100% Success Requirement**: No proceeding unless current step is 100% successful

## Phase 1: Foundation Setup

### Step 1.1: Environment Preparation
```sql
-- Verify PostgreSQL version and extensions
SELECT version();
SELECT * FROM pg_available_extensions WHERE name IN ('uuid-ossp', 'pgcrypto');

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

**Success Criteria:**
- PostgreSQL 15+ confirmed
- Both extensions created successfully
- No errors in extension creation

**Rollback:** Drop extensions if creation fails

### Step 1.2: ENUM Creation
```sql
-- Create all ENUMs first (no dependencies)
CREATE TYPE leave_type_enum AS ENUM (
    'sick', 'annual', 'unpaid', 'maternity', 'paternity', 
    'family_responsibility', 'other'
);

CREATE TYPE leave_status_enum AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE disciplinary_type_enum AS ENUM ('verbal', 'written', 'final');
CREATE TYPE notification_type_enum AS ENUM ('internal', 'external');
CREATE TYPE audit_action_enum AS ENUM (
    'created', 'updated', 'approved', 'rejected', 'deleted', 
    'archived', 'restored', 'escalated', 'resolved'
);
CREATE TYPE audit_severity_enum AS ENUM ('low', 'high', 'critical');
CREATE TYPE employment_status_enum AS ENUM (
    'active', 'suspended', 'terminated', 'probation', 'absconded', 'archived'
);
CREATE TYPE user_role_enum AS ENUM (
    'employee', 'junior_hr', 'hr_manager', 'admin', 'super_admin'
);
CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');
CREATE TYPE sex_enum AS ENUM ('male', 'female');
CREATE TYPE payment_method_enum AS ENUM ('eft', 'cash', 'cheque');
CREATE TYPE chat_intent_enum AS ENUM (
    'leave_inquiry', 'payslip_request', 'policy_question', 
    'system_help', 'general_query', 'escalation'
);
```

**Success Criteria:**
- All 12 ENUMs created without errors
- Verification query returns all ENUMs

**Validation Query:**
```sql
SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname;
```

**Rollback:** Drop all ENUMs in reverse order

## Phase 2: Core Reference Tables

### Step 2.1: Roles Table
```sql
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

CREATE INDEX idx_roles_role_name ON roles(role_name);
```

**Success Criteria:**
- Table created successfully
- Index created successfully
- No constraint violations

**Validation Query:**
```sql
SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'roles';
SELECT COUNT(*) FROM information_schema.statistics WHERE table_name = 'roles';
```

### Step 2.2: Job Titles Table
```sql
CREATE TABLE job_titles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL UNIQUE,
    department VARCHAR(255),
    description TEXT,
    hourly_rate DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_titles_title ON job_titles(title);
CREATE INDEX idx_job_titles_department ON job_titles(department);
CREATE INDEX idx_job_titles_is_active ON job_titles(is_active);
```

**Success Criteria:**
- Table created successfully
- All 3 indexes created successfully
- Unique constraint on title works

**Validation Query:**
```sql
SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'job_titles';
SELECT COUNT(*) FROM information_schema.statistics WHERE table_name = 'job_titles';
```

## Phase 3: Core Employee Tables

### Step 3.1: Employees Table (Central Table)
```sql
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    preferred_name VARCHAR(100),
    id_number VARCHAR(13) UNIQUE,
    encrypted_id_number BYTEA,
    dob DATE NOT NULL,
    sex sex_enum NOT NULL,
    gender gender_enum,
    pronouns VARCHAR(50),
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    job_title_id UUID REFERENCES job_titles(id) ON DELETE SET NULL,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    alternative_phone VARCHAR(20),
    address TEXT,
    tax_number VARCHAR(50),
    encrypted_tax_number BYTEA,
    nationality VARCHAR(100) DEFAULT 'South Africa',
    passport_number VARCHAR(50),
    passport_document_url TEXT,
    work_permit_url TEXT,
    id_verified BOOLEAN DEFAULT FALSE,
    work_permit_verified BOOLEAN DEFAULT FALSE,
    bank_verified BOOLEAN DEFAULT FALSE,
    employment_status employment_status_enum DEFAULT 'probation',
    date_hired DATE NOT NULL,
    date_terminated DATE,
    termination_reason TEXT,
    confidentiality_acknowledged_at TIMESTAMPTZ,
    profile_picture_url TEXT,
    documents JSONB DEFAULT '[]'::JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_sa_id_or_passport CHECK (
        (nationality = 'South Africa' AND id_number IS NOT NULL) OR
        (nationality != 'South Africa' AND passport_number IS NOT NULL)
    )
);

-- Create all indexes
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
```

**Success Criteria:**
- Table created with all constraints
- All 10 indexes created successfully
- Foreign key constraints work
- Check constraint validates correctly

**Validation Query:**
```sql
SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'employees';
SELECT COUNT(*) FROM information_schema.statistics WHERE table_name = 'employees';
SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = 'employees';
```

## Phase 4: Employee-Related Tables

### Step 4.1: Next of Kin Table
```sql
CREATE TABLE next_of_kin (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20) NOT NULL,
    alternative_phone VARCHAR(20),
    relationship VARCHAR(100) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_next_of_kin_employee_id ON next_of_kin(employee_id);
CREATE INDEX idx_next_of_kin_is_primary ON next_of_kin(is_primary);
```

**Success Criteria:**
- Table created with foreign key constraint
- Both indexes created successfully
- CASCADE delete works

### Step 4.2: Income Table
```sql
CREATE TABLE income (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID UNIQUE NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    basic_salary DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    bonus DECIMAL(12, 2) DEFAULT 0.00,
    commission DECIMAL(12, 2) DEFAULT 0.00,
    travel_allowance DECIMAL(10, 2) DEFAULT 0.00,
    cellphone_allowance DECIMAL(10, 2) DEFAULT 0.00,
    medical_aid_subsidy DECIMAL(10, 2) DEFAULT 0.00,
    company_car_value DECIMAL(10, 2) DEFAULT 0.00,
    paye DECIMAL(10, 2) DEFAULT 0.00,
    uif DECIMAL(10, 2) DEFAULT 0.00,
    pension_fund DECIMAL(10, 2) DEFAULT 0.00,
    medical_aid_contribution DECIMAL(10, 2) DEFAULT 0.00,
    penalty DECIMAL(10, 2) DEFAULT 0.00,
    other_deductions DECIMAL(10, 2) DEFAULT 0.00,
    overtime DECIMAL(10, 2) DEFAULT 0.00,
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

CREATE INDEX idx_income_employee_id ON income(employee_id);
```

**Success Criteria:**
- Table created with generated columns
- Generated columns work correctly
- Foreign key constraint works

### Step 4.3: Banking Details Table
```sql
CREATE TABLE banking_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID UNIQUE NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    id_number VARCHAR(13) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    encrypted_account_number BYTEA,
    branch_number VARCHAR(20),
    account_type VARCHAR(50) DEFAULT 'Cheque',
    bank_verified BOOLEAN DEFAULT FALSE,
    bank_document_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_banking_details_employee_id ON banking_details(employee_id);
CREATE INDEX idx_banking_details_bank_verified ON banking_details(bank_verified);
```

**Success Criteria:**
- Table created with encryption field
- Both indexes created successfully
- Unique constraint on employee_id works

## Phase 5: Contract and Document Tables

### Step 5.1: Contracts Table
```sql
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    witness_name VARCHAR(255),
    company_name VARCHAR(255) NOT NULL DEFAULT 'X Spark',
    job_title VARCHAR(255) NOT NULL,
    basic_salary DECIMAL(12, 2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    working_hours INTEGER NOT NULL DEFAULT 40,
    notice_period_days INTEGER DEFAULT 30,
    employee_signature TEXT,
    employer_signature TEXT,
    witness_signature TEXT,
    date_signed DATE,
    contract_document_url TEXT,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    superseded_by UUID REFERENCES contracts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contracts_employee_id ON contracts(employee_id);
CREATE INDEX idx_contracts_is_active ON contracts(is_active);
CREATE INDEX idx_contracts_start_date ON contracts(start_date);
CREATE INDEX idx_contracts_end_date ON contracts(end_date);
```

**Success Criteria:**
- Table created with self-referencing foreign key
- All 4 indexes created successfully
- Self-reference constraint works

## Phase 6: Leave Management Tables

### Step 6.1: Leave Balances Table
```sql
CREATE TABLE leave_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type leave_type_enum NOT NULL,
    total_entitled DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    total_taken DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    balance DECIMAL(5, 2) GENERATED ALWAYS AS (total_entitled - total_taken) STORED,
    cycle_start_date DATE NOT NULL,
    cycle_end_date DATE NOT NULL,
    cap_warning_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, leave_type, cycle_start_date)
);

CREATE INDEX idx_leave_balances_employee_id ON leave_balances(employee_id);
CREATE INDEX idx_leave_balances_leave_type ON leave_balances(leave_type);
CREATE INDEX idx_leave_balances_cycle ON leave_balances(cycle_start_date, cycle_end_date);
```

**Success Criteria:**
- Table created with generated column
- Unique constraint works
- All 3 indexes created successfully

### Step 6.2: Leave Requests Table
```sql
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    employee_number VARCHAR(20) NOT NULL,
    id_number VARCHAR(13) NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    direct_superior VARCHAR(255),
    leave_type leave_type_enum NOT NULL,
    leave_type_other VARCHAR(255),
    leave_day_from DATE NOT NULL,
    leave_day_to DATE NOT NULL,
    total_days DECIMAL(5, 2) NOT NULL,
    reason TEXT,
    supporting_document_url TEXT,
    leave_balance_before DECIMAL(5, 2),
    leave_balance_after DECIMAL(5, 2),
    employee_signature TEXT,
    employer_signature TEXT,
    status leave_status_enum DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_leave_type ON leave_requests(leave_type);
CREATE INDEX idx_leave_requests_dates ON leave_requests(leave_day_from, leave_day_to);
CREATE INDEX idx_leave_requests_reviewed_by ON leave_requests(reviewed_by);
```

**Success Criteria:**
- Table created with multiple foreign keys
- All 5 indexes created successfully
- ENUM constraints work

## Phase 7: Payroll Tables

### Step 7.1: Payslips Table
```sql
CREATE TABLE payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    employee_number VARCHAR(20) NOT NULL,
    id_number VARCHAR(13) NOT NULL,
    tax_number VARCHAR(50),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    job_title VARCHAR(255) NOT NULL,
    pay_date DATE NOT NULL,
    pay_period_from DATE NOT NULL,
    pay_period_to DATE NOT NULL,
    basic_salary DECIMAL(12, 2) NOT NULL,
    bonus DECIMAL(10, 2) DEFAULT 0.00,
    commission DECIMAL(10, 2) DEFAULT 0.00,
    travel_allowance DECIMAL(10, 2) DEFAULT 0.00,
    cellphone_allowance DECIMAL(10, 2) DEFAULT 0.00,
    medical_aid_subsidy DECIMAL(10, 2) DEFAULT 0.00,
    company_car_value DECIMAL(10, 2) DEFAULT 0.00,
    overtime DECIMAL(10, 2) DEFAULT 0.00,
    paye DECIMAL(10, 2) DEFAULT 0.00,
    uif DECIMAL(10, 2) DEFAULT 0.00,
    pension_fund DECIMAL(10, 2) DEFAULT 0.00,
    medical_aid_contribution DECIMAL(10, 2) DEFAULT 0.00,
    penalty DECIMAL(10, 2) DEFAULT 0.00,
    other_deductions DECIMAL(10, 2) DEFAULT 0.00,
    gross_income DECIMAL(12, 2) NOT NULL,
    total_deductions DECIMAL(12, 2) NOT NULL,
    net_income DECIMAL(12, 2) NOT NULL,
    payment_method payment_method_enum DEFAULT 'eft',
    payslip_document_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, pay_period_from, pay_period_to)
);

CREATE INDEX idx_payslips_employee_id ON payslips(employee_id);
CREATE INDEX idx_payslips_pay_date ON payslips(pay_date);
CREATE INDEX idx_payslips_pay_period ON payslips(pay_period_from, pay_period_to);
```

**Success Criteria:**
- Table created with unique constraint
- All 3 indexes created successfully
- ENUM constraint works

## Phase 8: Management and Audit Tables

### Step 8.1: Disciplinary Records Table
```sql
CREATE TABLE disciplinary_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    id_number VARCHAR(13) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    disciplinary_type disciplinary_type_enum NOT NULL,
    note TEXT NOT NULL,
    disciplinary_document_url TEXT,
    issued_by UUID NOT NULL REFERENCES employees(id) ON DELETE SET NULL,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_disciplinary_records_employee_id ON disciplinary_records(employee_id);
CREATE INDEX idx_disciplinary_records_type ON disciplinary_records(disciplinary_type);
CREATE INDEX idx_disciplinary_records_issued_by ON disciplinary_records(issued_by);
CREATE INDEX idx_disciplinary_records_issued_at ON disciplinary_records(issued_at);
```

**Success Criteria:**
- Table created with multiple foreign keys
- All 4 indexes created successfully
- ENUM constraint works

### Step 8.2: Notifications Table
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type notification_type_enum NOT NULL,
    is_confidential BOOLEAN DEFAULT FALSE,
    published_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_employee_id ON notifications(employee_id);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_published_by ON notifications(published_by);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

**Success Criteria:**
- Table created with nullable foreign key
- All 5 indexes created successfully
- ENUM constraint works

### Step 8.3: Audit Logs Table
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    employee_name VARCHAR(255),
    employee_number VARCHAR(20),
    action audit_action_enum NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    severity audit_severity_enum DEFAULT 'low',
    target_table VARCHAR(100),
    target_record_id UUID,
    previous_value JSONB,
    new_value JSONB,
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    published_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    published_by_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_employee_id ON audit_logs(employee_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_table, target_record_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_published_by ON audit_logs(published_by);
```

**Success Criteria:**
- Table created with JSONB fields
- All 7 indexes created successfully
- Multiple ENUM constraints work

## Phase 9: Advanced Features Tables

### Step 9.1: AI Chat Sessions Table
```sql
CREATE TABLE ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id VARCHAR(100) NOT NULL,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    query_text TEXT NOT NULL,
    response_text TEXT NOT NULL,
    intent chat_intent_enum NOT NULL,
    confidence_score DECIMAL(3, 2) CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    is_resolved BOOLEAN DEFAULT FALSE,
    escalated_to UUID REFERENCES employees(id) ON DELETE SET NULL,
    escalated_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_time INTERVAL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_chat_sessions_chat_id ON ai_chat_sessions(chat_id);
CREATE INDEX idx_ai_chat_sessions_employee_id ON ai_chat_sessions(employee_id);
CREATE INDEX idx_ai_chat_sessions_intent ON ai_chat_sessions(intent);
CREATE INDEX idx_ai_chat_sessions_is_resolved ON ai_chat_sessions(is_resolved);
CREATE INDEX idx_ai_chat_sessions_escalated_to ON ai_chat_sessions(escalated_to);
CREATE INDEX idx_ai_chat_sessions_created_at ON ai_chat_sessions(created_at DESC);
```

**Success Criteria:**
- Table created with CHECK constraint
- All 6 indexes created successfully
- ENUM and CHECK constraints work

### Step 9.2: Notes Table
```sql
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    title VARCHAR(255),
    content TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES employees(id) ON DELETE SET NULL,
    is_confidential BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notes_employee_id ON notes(employee_id);
CREATE INDEX idx_notes_author_id ON notes(author_id);
CREATE INDEX idx_notes_is_confidential ON notes(is_confidential);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);
```

**Success Criteria:**
- Table created with multiple foreign keys
- All 4 indexes created successfully
- CASCADE and SET NULL constraints work

## Phase 10: Triggers and Functions

### Step 10.1: Basic Triggers
```sql
-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
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
```

**Success Criteria:**
- Function created successfully
- All 13 triggers created successfully
- Triggers fire correctly on UPDATE

### Step 10.2: Employee ID Generation
```sql
CREATE OR REPLACE FUNCTION generate_employee_id()
RETURNS TRIGGER AS $$
DECLARE
    year_month VARCHAR(5);
    next_number INTEGER;
    new_employee_id VARCHAR(20);
BEGIN
    year_month := TO_CHAR(NOW(), 'YY/MM');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id FROM '\d{3}$') AS INTEGER)), 0) + 1
    INTO next_number
    FROM employees
    WHERE employee_id LIKE 'XSP' || year_month || '%';
    
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
```

**Success Criteria:**
- Function created successfully
- Trigger created successfully
- Employee ID generation works

### Step 10.3: Audit Functions
```sql
CREATE OR REPLACE FUNCTION audit_employee_changes()
RETURNS TRIGGER AS $$
DECLARE
    action_type audit_action_enum;
    old_data JSONB;
    new_data JSONB;
BEGIN
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
    
    INSERT INTO audit_logs (
        employee_id, employee_name, employee_number, action, action_type,
        severity, target_table, target_record_id, previous_value, new_value,
        description, published_by_system
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        COALESCE(NEW.first_name || ' ' || NEW.last_name, OLD.first_name || ' ' || OLD.last_name),
        COALESCE(NEW.employee_id, OLD.employee_id),
        action_type, 'employee_profile', 'high', TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id), old_data, new_data,
        'Employee record ' || TG_OP || ' operation', TRUE
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_employee_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH ROW EXECUTE FUNCTION audit_employee_changes();
```

**Success Criteria:**
- Function created successfully
- Trigger created successfully
- Audit logging works for all operations

### Step 10.4: Encryption Functions
```sql
CREATE OR REPLACE FUNCTION encrypt_sensitive_data()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_number IS NOT NULL THEN
        NEW.encrypted_id_number := pgp_sym_encrypt(NEW.id_number, current_setting('app.encryption_key'));
    END IF;
    
    IF NEW.tax_number IS NOT NULL THEN
        NEW.encrypted_tax_number := pgp_sym_encrypt(NEW.tax_number, current_setting('app.encryption_key'));
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER encrypt_employee_sensitive_data
BEFORE INSERT OR UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION encrypt_sensitive_data();

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

**Success Criteria:**
- Both functions created successfully
- Both triggers created successfully
- Encryption works (requires encryption key to be set)

## Phase 11: Views Creation

### Step 11.1: Core Views
```sql
-- Active employees view
CREATE OR REPLACE VIEW active_employees AS
SELECT 
    e.id, e.employee_id, e.first_name, e.middle_name, e.last_name,
    e.preferred_name, e.email, e.phone, jt.title AS job_title,
    jt.department, r.role_name, e.employment_status, e.id_verified,
    e.bank_verified, e.date_hired, e.created_at
FROM employees e
LEFT JOIN job_titles jt ON e.job_title_id = jt.id
LEFT JOIN roles r ON e.role_id = r.id
WHERE e.is_active = TRUE
ORDER BY e.created_at DESC;

-- Pending leave requests view
CREATE OR REPLACE VIEW pending_leave_requests AS
SELECT 
    lr.id, lr.employee_id, lr.full_name, lr.employee_number,
    lr.leave_type, lr.leave_day_from, lr.leave_day_to, lr.total_days,
    lr.reason, lr.created_at, e.email, e.phone,
    jt.title AS job_title, jt.department
FROM leave_requests lr
JOIN employees e ON lr.employee_id = e.id
LEFT JOIN job_titles jt ON e.job_title_id = jt.id
WHERE lr.status = 'pending'
ORDER BY lr.created_at ASC;

-- Employee leave summary view
CREATE OR REPLACE VIEW employee_leave_summary AS
SELECT 
    e.id AS employee_id, e.employee_id AS employee_number,
    e.first_name || ' ' || e.last_name AS full_name, lb.leave_type,
    lb.total_entitled, lb.total_taken, lb.balance,
    lb.cycle_start_date, lb.cycle_end_date
FROM employees e
JOIN leave_balances lb ON e.id = lb.employee_id
WHERE e.is_active = TRUE
ORDER BY e.employee_id, lb.leave_type;

-- Unread notifications view
CREATE OR REPLACE VIEW unread_notifications AS
SELECT 
    n.id, n.employee_id, e.first_name || ' ' || e.last_name AS employee_name,
    e.email, n.title, n.message, n.notification_type,
    n.is_confidential, n.created_at
FROM notifications n
LEFT JOIN employees e ON n.employee_id = e.id
WHERE n.is_read = FALSE
ORDER BY n.created_at DESC;

-- Contracts expiring soon view
CREATE OR REPLACE VIEW contracts_expiring_soon AS
SELECT 
    c.id, c.employee_id, e.employee_id AS employee_number,
    c.full_name, e.email, e.phone, c.job_title,
    c.start_date, c.end_date, c.end_date - CURRENT_DATE AS days_until_expiry
FROM contracts c
JOIN employees e ON c.employee_id = e.id
WHERE 
    c.is_active = TRUE 
    AND c.end_date IS NOT NULL
    AND c.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
    AND e.is_active = TRUE
ORDER BY c.end_date ASC;

-- Employee full profile view
CREATE OR REPLACE VIEW employee_full_profile AS
SELECT 
    e.id, e.employee_id, e.first_name, e.middle_name, e.last_name,
    e.preferred_name, e.email, e.phone, e.alternative_phone, e.address,
    e.dob, e.gender, e.pronouns, e.nationality, e.employment_status,
    e.date_hired, e.date_terminated, e.id_verified, e.bank_verified,
    jt.title AS job_title, jt.department, r.role_name,
    i.basic_salary, i.gross_income, i.net_income,
    bd.bank_name, bd.bank_verified AS banking_verified,
    e.profile_picture_url, e.created_at, e.updated_at
FROM employees e
LEFT JOIN job_titles jt ON e.job_title_id = jt.id
LEFT JOIN roles r ON e.role_id = r.id
LEFT JOIN income i ON e.id = i.employee_id
LEFT JOIN banking_details bd ON e.id = bd.employee_id
WHERE e.is_active = TRUE;
```

**Success Criteria:**
- All 6 views created successfully
- Views return data correctly
- No syntax errors in view definitions

## Phase 12: Seed Data

### Step 12.1: Roles Seed Data
```sql
INSERT INTO roles (role_name, description, can_view_sensitive_data, can_edit_employee_data, can_approve_leave, can_manage_users, can_access_audit_logs, can_manage_system_config) VALUES
    ('employee', 'Regular staff member with access to own data', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
    ('junior_hr', 'Supporting HR role with limited responsibilities', TRUE, TRUE, FALSE, FALSE, FALSE, FALSE),
    ('hr_manager', 'HR Manager with full access to employee records', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE),
    ('admin', 'Administrator with elevated privileges', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
    ('super_admin', 'Highest-level system role with unrestricted access', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE);
```

**Success Criteria:**
- All 5 roles inserted successfully
- No constraint violations
- All role permissions set correctly

### Step 12.2: Job Titles Seed Data
```sql
INSERT INTO job_titles (title, department, hourly_rate, description) VALUES
    ('Software Engineer', 'Engineering', 350.00, 'Develops and maintains software applications'),
    ('Senior Software Engineer', 'Engineering', 500.00, 'Lead engineer with advanced responsibilities'),
    ('HR Manager', 'Human Resources', 400.00, 'Manages HR operations and employee relations'),
    ('HR Assistant', 'Human Resources', 250.00, 'Supports HR department with administrative tasks'),
    ('Project Manager', 'Management', 450.00, 'Oversees project delivery and team coordination'),
    ('Accountant', 'Finance', 380.00, 'Manages financial records and reporting'),
    ('Marketing Specialist', 'Marketing', 320.00, 'Develops and executes marketing campaigns'),
    ('Operations Manager', 'Operations', 420.00, 'Oversees daily operational activities');
```

**Success Criteria:**
- All 8 job titles inserted successfully
- No constraint violations
- All departments and rates set correctly

## Phase 13: Performance Optimization

### Step 13.1: Additional Indexes
```sql
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

**Success Criteria:**
- All 9 additional indexes created successfully
- Partial indexes work correctly
- GIN indexes work for JSONB searches

## Phase 14: Final Validation

### Step 14.1: Complete Schema Validation
```sql
-- Verify all tables exist
DO $$
DECLARE
    table_count INTEGER;
    expected_tables TEXT[] := ARRAY[
        'roles', 'job_titles', 'employees', 'next_of_kin', 'income',
        'contracts', 'banking_details', 'payslips', 'leave_balances',
        'leave_requests', 'disciplinary_records', 'notifications',
        'audit_logs', 'ai_chat_sessions', 'notes'
    ];
    missing_tables TEXT[] := '{}';
    table_name TEXT;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name = ANY(expected_tables);
    
    IF table_count = 15 THEN
        RAISE NOTICE 'SUCCESS: All 15 core tables created successfully!';
    ELSE
        RAISE WARNING 'WARNING: Expected 15 tables but found %', table_count;
        
        -- Find missing tables
        FOREACH table_name IN ARRAY expected_tables
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = table_name
            ) THEN
                missing_tables := array_append(missing_tables, table_name);
            END IF;
        END LOOP;
        
        RAISE WARNING 'Missing tables: %', array_to_string(missing_tables, ', ');
    END IF;
END $$;

-- Verify all ENUMs exist
DO $$
DECLARE
    enum_count INTEGER;
    expected_enums TEXT[] := ARRAY[
        'leave_type_enum', 'leave_status_enum', 'disciplinary_type_enum',
        'notification_type_enum', 'audit_action_enum', 'audit_severity_enum',
        'employment_status_enum', 'user_role_enum', 'gender_enum',
        'sex_enum', 'payment_method_enum', 'chat_intent_enum'
    ];
BEGIN
    SELECT COUNT(*) INTO enum_count
    FROM pg_type
    WHERE typtype = 'e'
    AND typname = ANY(expected_enums);
    
    IF enum_count = 12 THEN
        RAISE NOTICE 'SUCCESS: All 12 ENUMs created successfully!';
    ELSE
        RAISE WARNING 'WARNING: Expected 12 ENUMs but found %', enum_count;
    END IF;
END $$;

-- Verify all views exist
DO $$
DECLARE
    view_count INTEGER;
    expected_views TEXT[] := ARRAY[
        'active_employees', 'pending_leave_requests', 'employee_leave_summary',
        'unread_notifications', 'contracts_expiring_soon', 'employee_full_profile'
    ];
BEGIN
    SELECT COUNT(*) INTO view_count
    FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name = ANY(expected_views);
    
    IF view_count = 6 THEN
        RAISE NOTICE 'SUCCESS: All 6 views created successfully!';
    ELSE
        RAISE WARNING 'WARNING: Expected 6 views but found %', view_count;
    END IF;
END $$;

-- Verify all functions exist
DO $$
DECLARE
    function_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
    AND routine_name IN (
        'update_updated_at_column', 'generate_employee_id',
        'audit_employee_changes', 'encrypt_sensitive_data',
        'encrypt_banking_data'
    );
    
    IF function_count = 5 THEN
        RAISE NOTICE 'SUCCESS: All 5 functions created successfully!';
    ELSE
        RAISE WARNING 'WARNING: Expected 5 functions but found %', function_count;
    END IF;
END $$;

-- Verify all triggers exist
DO $$
DECLARE
    trigger_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    AND trigger_name LIKE '%updated_at%'
    OR trigger_name LIKE '%employee_id%'
    OR trigger_name LIKE '%audit%'
    OR trigger_name LIKE '%encrypt%';
    
    IF trigger_count >= 20 THEN
        RAISE NOTICE 'SUCCESS: All triggers created successfully!';
    ELSE
        RAISE WARNING 'WARNING: Expected 20+ triggers but found %', trigger_count;
    END IF;
END $$;
```

**Success Criteria:**
- All validation queries pass
- No missing tables, ENUMs, views, functions, or triggers
- Complete schema is functional

## Rollback Procedures

### Complete Rollback (Emergency)
```sql
-- Drop all triggers first
DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
DROP TRIGGER IF EXISTS update_job_titles_updated_at ON job_titles;
DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
-- ... (continue for all triggers)

-- Drop all functions
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS generate_employee_id();
DROP FUNCTION IF EXISTS audit_employee_changes();
DROP FUNCTION IF EXISTS encrypt_sensitive_data();
DROP FUNCTION IF EXISTS encrypt_banking_data();

-- Drop all views
DROP VIEW IF EXISTS active_employees;
DROP VIEW IF EXISTS pending_leave_requests;
DROP VIEW IF EXISTS employee_leave_summary;
DROP VIEW IF EXISTS unread_notifications;
DROP VIEW IF EXISTS contracts_expiring_soon;
DROP VIEW IF EXISTS employee_full_profile;

-- Drop all tables (in reverse dependency order)
DROP TABLE IF EXISTS notes;
DROP TABLE IF EXISTS ai_chat_sessions;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS disciplinary_records;
DROP TABLE IF EXISTS leave_requests;
DROP TABLE IF EXISTS leave_balances;
DROP TABLE IF EXISTS payslips;
DROP TABLE IF EXISTS banking_details;
DROP TABLE IF EXISTS contracts;
DROP TABLE IF EXISTS income;
DROP TABLE IF EXISTS next_of_kin;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS job_titles;
DROP TABLE IF EXISTS roles;

-- Drop all ENUMs
DROP TYPE IF EXISTS chat_intent_enum;
DROP TYPE IF EXISTS payment_method_enum;
DROP TYPE IF EXISTS sex_enum;
DROP TYPE IF EXISTS gender_enum;
DROP TYPE IF EXISTS user_role_enum;
DROP TYPE IF EXISTS employment_status_enum;
DROP TYPE IF EXISTS audit_severity_enum;
DROP TYPE IF EXISTS audit_action_enum;
DROP TYPE IF EXISTS notification_type_enum;
DROP TYPE IF EXISTS disciplinary_type_enum;
DROP TYPE IF EXISTS leave_status_enum;
DROP TYPE IF EXISTS leave_type_enum;

-- Drop extensions
DROP EXTENSION IF EXISTS pgcrypto;
DROP EXTENSION IF EXISTS "uuid-ossp";
```

## Success Criteria Summary

### Phase Completion Requirements:
1. **Phase 1**: Extensions and ENUMs created successfully
2. **Phase 2**: Reference tables (roles, job_titles) created with indexes
3. **Phase 3**: Core employees table created with all constraints
4. **Phase 4**: Employee-related tables created with foreign keys
5. **Phase 5**: Contract and document tables created
6. **Phase 6**: Leave management tables created
7. **Phase 7**: Payroll tables created
8. **Phase 8**: Management and audit tables created
9. **Phase 9**: Advanced features tables created
10. **Phase 10**: All triggers and functions created
11. **Phase 11**: All views created successfully
12. **Phase 12**: Seed data inserted successfully
13. **Phase 13**: Performance optimization indexes created
14. **Phase 14**: Complete validation passes

### Final Success Criteria:
- ✅ 15 tables created
- ✅ 12 ENUMs created
- ✅ 65+ indexes created
- ✅ 10+ triggers created
- ✅ 5 functions created
- ✅ 6 views created
- ✅ Seed data inserted
- ✅ All validation queries pass
- ✅ No errors in any phase

## Implementation Notes

1. **Execute each phase sequentially** - Do not skip phases
2. **Validate after each step** - Run validation queries before proceeding
3. **Test constraints** - Verify foreign keys, checks, and unique constraints work
4. **Monitor performance** - Check index creation doesn't timeout
5. **Backup before starting** - Create database backup before implementation
6. **Set encryption key** - Configure `app.encryption_key` before testing encryption functions

## Emergency Contacts

- **Database Administrator**: [Contact Info]
- **Development Team Lead**: [Contact Info]
- **System Administrator**: [Contact Info]

---

*This implementation plan ensures 100% success rate with proper dependency management and comprehensive validation at each step.*
