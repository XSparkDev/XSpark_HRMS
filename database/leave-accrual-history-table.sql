-- ============================================================================
-- LEAVE ACCRUAL HISTORY TABLE
-- ============================================================================
-- This table tracks all leave accrual events for audit and reporting purposes.
-- Each accrual event records when leave was added to an employee's balance.
-- ============================================================================

CREATE TABLE IF NOT EXISTS leave_accrual_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    balance_id UUID NOT NULL REFERENCES leave_balances(id) ON DELETE CASCADE,
    accrual_date DATE NOT NULL,
    amount DECIMAL(5, 2) NOT NULL,
    accrual_reason VARCHAR(50) NOT NULL, -- e.g., 'monthly', 'instant', 'special'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leave_accrual_history_employee_id ON leave_accrual_history(employee_id);
CREATE INDEX idx_leave_accrual_history_leave_type_id ON leave_accrual_history(leave_type_id);
CREATE INDEX idx_leave_accrual_history_balance_id ON leave_accrual_history(balance_id);
CREATE INDEX idx_leave_accrual_history_accrual_date ON leave_accrual_history(accrual_date);
CREATE INDEX idx_leave_accrual_history_reason ON leave_accrual_history(accrual_reason);

-- Update timestamp trigger
CREATE TRIGGER update_leave_accrual_history_updated_at 
    BEFORE UPDATE ON leave_accrual_history
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();



