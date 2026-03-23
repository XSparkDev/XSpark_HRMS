## Borrow/Return Status Migration — Test Plan (7 files)

This document lets you implement the migration **one-by-one** or **in batches**, and quickly verify:
- **App behavior**: what changes you should see in the UI/API
- **DB reality**: which columns/rows should change
- **Tests**: exact steps and Postman URLs

### Canonical statuses (authoritative)

`borrow_status` should be the meaning-bearing field:
- `pending_borrow`
- `borrowed`
- `pending_return`
- `returned`
- `rejected`

Booleans are **derived compatibility fields** (kept consistent while migrating):
- `borrow_request` (boolean)
- `is_borrowed` (boolean)
- `is_returned` (boolean)

### Truth mapping (used for verification)

| `borrow_status` | `borrow_request` | `is_borrowed` | `is_returned` |
|---|---:|---:|---:|
| `pending_borrow` | true | false | false |
| `borrowed` | false | true | false |
| `pending_return` | true | true | false |
| `returned` | false | false | true |
| `rejected` | false | false | false |

> Note: `approved` is not used in this system. Keep approvals transitioning directly to `borrowed`.

---

## Implementation checkpoints (file-by-file)

| # | File to change | Completeness signal in the **App** | Completeness signal in the **DB** | Quick test (UI / Postman) |
|---:|---|---|---|---|
| 1 | `app/api/device-scans/validate/route.ts` | QR **collect** and **return** validation uses `borrow_status` (not legacy `status/approval_status`). Return scan should create/trigger a **pending return request** flow (not instantly set returned if supervisor approval is required). | After **collect**: borrow row ends in `borrow_status='borrowed'`. After **return request**: borrow row ends in `borrow_status='pending_return'` and `is_returned` stays `false`. A `returns` row exists in `Pending`. | **Collect**: `POST /api/device-scans/validate` with `{"borrow_id":"...","scanned_code":"...","mode":"collect"}`. **Return**: same with `mode:"return"`. Verify borrow row in DB. |
| 2 | `lib/services/supervisor-dashboard-service.ts` | Pending borrow list shows only pending borrows; active list shows only active. Pending returns list shows “waiting approval” items reliably. | Fetches align with `borrow_status` (pending/active/return). `returns.status` drives return request list, and borrow row remains `pending_return` until approval. | Supervisor page: open **Approve Borrow Requests**, **View Active Borrows**, **Approve Returns** dialogs. Postman: `GET /api/borrows?borrowStatus=pending_borrow` (or your chosen param) and `GET /api/returns?status=pending`. |
| 3 | `app/api/borrows/route.ts` | A single “source of truth” API for filtering by `borrow_status` (status-first). Existing boolean query params remain supported during migration. | Calling `/api/borrows?...` returns rows that match `borrow_status` correctly, regardless of older columns. | Postman: `GET http://localhost:3000/api/borrows?borrowStatus=borrowed&limit=100` and `GET ...?borrowStatus=pending_return`. Also verify old `isBorrowed/isReturned/borrowRequest` queries still work until you remove them. |
| 4 | `lib/services/borrow-service.ts` | Creating/approving/rejecting/returning borrows updates status consistently; UI lists stop drifting. | Every write sets `borrow_status` AND derived booleans follow the mapping table above. No “impossible” combos remain after new writes. | Postman: `POST /api/borrows` then `PATCH /api/borrows?id=...&action=approve` then create return request (via UI or the return flow) and finally approve return. Inspect DB row at each step. |
| 5 | `app/ams-supervisor/page.tsx` | Supervisor badges/actions are driven by `borrow_status`. The correct actions appear for each status (approve/reject/approve return). No refresh required after actions. | N/A (UI only), but actions must trigger status transitions in DB. | Manual: submit borrow request → open supervisor page → approve → ensure it moves to active. Submit return request → approve return → ensure it disappears from pending returns and appears in returned/history. |
| 6 | `app/ams-devices/page.tsx` | Employee sees consistent statuses: “Pending Borrow” after request, “Borrowed” only after approval/collection, “Pending Return” after return request, “Returned” only after supervisor approval. | Borrow row transitions: `pending_borrow → borrowed → pending_return → returned`. Return request row exists while pending. | Manual: employee borrow request + supervisor approve + employee return request + supervisor approve return. Confirm no timezone/date regressions in borrow/return dates. |
| 7 | `app/ams-devices/management-history/page.tsx` | History labels/colors map from DB statuses correctly. Filtering by “Active/Returned/Pending” matches DB statuses. | N/A (UI only), but data should reflect `borrow_status` fields returned by APIs/services. | Manual: open management history and verify a known borrow shows the expected label for each stage. |

---

## Bundled implementation options (recommended batches)

### Batch A — “API + Service correctness first” (DB truth becomes reliable)
**Includes**: #3 `app/api/borrows/route.ts`, #4 `lib/services/borrow-service.ts`

**What you should see**
- Borrow creation/approval/reject/return writes consistent `borrow_status`
- `/api/borrows?borrowStatus=...` becomes the reliable query for UI layers

**Tests**
- Postman:
  - Create: `POST http://localhost:3000/api/borrows`
  - List pending: `GET http://localhost:3000/api/borrows?borrowStatus=pending_borrow&limit=100`
  - Approve: `PATCH http://localhost:3000/api/borrows?id=<borrow_id>&action=approve` (body: `{"supervisorId":"<uuid>"}`)
  - List active: `GET http://localhost:3000/api/borrows?borrowStatus=borrowed&limit=100`

### Batch B — “Supervisor UI consistency” (dashboard stops disagreeing)
**Includes**: #2 `lib/services/supervisor-dashboard-service.ts`, #5 `app/ams-supervisor/page.tsx`

**What you should see**
- Pending borrows and active borrows are correct without refresh
- Pending returns list is stable (based on `returns.status` + `borrow_status`)

**Tests**
- Manual: open dialogs and verify counts match Postman list endpoints.

### Batch C — “Employee workflow end-to-end”
**Includes**: #6 `app/ams-devices/page.tsx` + (usually) Batch A + Batch B

**What you should see**
- Employee status text matches supervisor status text at every step

**Tests**
- Full run:
  1) Employee creates borrow → should show `pending_borrow`
  2) Supervisor approves/collects → should show `borrowed`
  3) Employee submits return request → should show `pending_return` (and `is_returned` remains false)
  4) Supervisor approves return → should show `returned`

### Batch D — “History/reporting polish”
**Includes**: #7 `app/ams-devices/management-history/page.tsx`

**What you should see**
- History filters and badges align with `borrow_status`

---

## DB verification queries (copy/paste)

Replace `<borrow_id>` / `<device_id>` as needed.

```sql
-- Inspect a single borrow record
select
  borrow_id,
  device_id,
  borrowed_by,
  borrow_status,
  borrow_request,
  is_borrowed,
  is_returned,
  borrow_date,
  return_date,
  updated_at
from borrows
where borrow_id = '<borrow_id>';
```

```sql
-- Pending borrows
select borrow_id, borrow_status, borrow_request, is_borrowed, is_returned
from borrows
where borrow_status = 'pending_borrow'
order by borrow_date desc
limit 50;
```

```sql
-- Pending returns (waiting supervisor approval)
select borrow_id, borrow_status, borrow_request, is_borrowed, is_returned
from borrows
where borrow_status = 'pending_return'
order by updated_at desc
limit 50;
```

```sql
-- Pending return requests table (supervisor queue)
select id, device_id, employee_id, status, created_at, updated_at
from returns
where status in ('Pending', 'Pending Approval', 'Awaiting Approval')
order by created_at desc
limit 50;
```

