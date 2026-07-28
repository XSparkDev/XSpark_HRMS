-- Fixes discovered by end-to-end testing against live application code:
--  - lib/services/leave-service.ts selects employees.middle_name (missing)
--  - lib/services/leave-service.ts selects leave_types.display_name (was `name`)
--  - lib/services/notes2-service.ts expects notes2.employee_id to reference
--    auth.users.id directly (the note author), separate from target_employee_id
--    which references employees.id (the note's subject). We had built
--    employee_id as `author_id -> employees.id`, which doesn't match.

alter table employees add column if not exists middle_name text;

alter table leave_types rename column name to display_name;

alter table notes2 drop constraint if exists notes2_author_id_fkey;
alter table notes2 rename column author_id to employee_id;
alter table notes2 alter column employee_id drop not null;
alter table notes2 add constraint notes2_employee_id_fkey
  foreign key (employee_id) references auth.users(id) on delete cascade;
