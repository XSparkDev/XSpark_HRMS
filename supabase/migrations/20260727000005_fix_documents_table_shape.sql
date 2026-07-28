-- lib/services/documents-service.ts stores documents as a search/knowledge-base
-- style record (title, filename, content, uploaded_at, source_url, search_vector)
-- with all HR-specific metadata (employee_id, uploaded_by, is_sensitive, etc.)
-- packed into `content` as a JSON string, not as separate relational columns.
-- document_versions / document_access_log are unused by the live code and are
-- dropped since their FK depended on the old (incorrect) documents shape.

drop table if exists document_versions;
drop table if exists document_access_log;
drop table if exists documents;

create table documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  filename text,
  content text,
  uploaded_at timestamptz not null default now(),
  source_url text,
  search_vector tsvector
);
create index idx_documents_search_vector on documents using gin(search_vector);
alter table documents enable row level security;
