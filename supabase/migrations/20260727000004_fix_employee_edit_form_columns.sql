-- Found by testing the Employee Edit form end-to-end: CreateEmployeeSchema /
-- UpdateEmployeeSchema in app/api/employees/route.ts, and the EmployeeForm
-- component in app/employees/page.tsx, both read/write these fields that
-- were missing from the initial schema.

alter table employees add column if not exists preferred_name text;
alter table employees add column if not exists alternative_phone text;
alter table employees add column if not exists address text;
alter table employees add column if not exists dob date;
alter table employees add column if not exists sex text check (sex in ('male','female'));
alter table employees add column if not exists gender text check (gender in ('male','female','other','prefer_not_to_say'));
alter table employees add column if not exists tax_number text;
alter table employees add column if not exists pronouns text;

alter table roles add column if not exists description text;

-- lib/services/employee-service.ts encrypts id_number/tax_number client-side
-- before insert/update and stores them as bytea, never plaintext.
alter table employees add column if not exists encrypted_id_number bytea;
alter table employees add column if not exists encrypted_tax_number bytea;

alter table employees add column if not exists nationality text default 'South Africa';
alter table employees add column if not exists date_terminated date;
alter table employees add column if not exists termination_reason text;
alter table employees add column if not exists confidentiality_acknowledged_at timestamptz;
alter table employees add column if not exists deleted_at timestamptz;
