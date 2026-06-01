# School ERP Backend — Memory & Progress

Last updated: 2026-05-27

---

## Phase 8 ✅ — Timetable, Exams & Results

- [x] `TimetableSlot` model with unique constraints for (section, day, period) and (teacher, day, period, ay)
- [x] `check_conflicts()` — teacher + section double-booking detection (returns 409)
- [x] `create_slot()` / `update_slot()` — conflict check in same transaction
- [x] Slot publish toggle
- [x] `GradingScheme` model with `get_grade()` — A/B/C/D/E/F based on percentage thresholds
- [x] `Exam` model (DRAFT → PUBLISHED status), `ExamSubject` junction, `ExamResult` with `VersionMixin`
- [x] Marks entry: `submit_marks()` with optimistic locking (`version` column), 409 on concurrent edit
- [x] Marks workflow: DRAFT → SUBMITTED → APPROVED → PUBLISHED (batch status transitions)
- [x] `compute_results()` Celery task — dense ranking, non-graded subjects excluded, AB students excluded
- [x] `ExamAggregate` — total, max_total, percentage, grade, rank stored after computation
- [x] Bulk marks entry, single marks update, aggregate retrieval endpoints
- [x] Migration `c36c45605f40` — 5 tables (`timetable_slots`, `grading_schemes`, `exams`, `exam_results`, `exam_aggregates`)

### Decisions
- Two unique constraints on timetable: section-level (no two classes same section/period) and teacher-level (no double-booking)
- Optimistic locking via `version` column on `ExamResult` — prevents lost updates on concurrent marks entry
- Marks workflow: batch transition (all results in an exam move together through DRAFT→SUBMITTED→APPROVED→PUBLISHED)
- Dense ranking: tied students get same rank, next rank skips ahead
- Non-graded subjects (activities/sports) and absent students excluded from aggregate computation
- Celery task runs computation async; results polled via aggregates endpoint

---

## Phase 7 ✅ — Attendance Module

- [x] `Attendance` model — student_id, date, period_no, status, marked_by, is_corrected
- [x] Unique constraint `(student_id, date, period_no)` enables idempotent upsert
- [x] `mark_attendance()` — uses `INSERT ... ON CONFLICT DO UPDATE`, rejects holidays via `is_working_day()`
- [x] Bulk marking endpoint reuses same upsert logic
- [x] `LeaveType` (sick/casual/annual with is_paid flag) + `LeaveApplication` workflow (PENDING→APPROVED/REJECTED)
- [x] Leave apply/approve/reject with student leave history
- [x] `get_eligibility()` — 75% rule: approved leaves excluded from denominator
- [x] `count_working_days()` — total days minus holidays minus Sundays
- [x] `count_present_days()` — distinct dates with PRESENT or LATE status
- [x] Absent SMS notification stub: `_notify_parents()` iterates parent profiles
- [x] Migration `fd9e16d6c9f4` — `attendance`, `leave_types`, `leave_applications`

### Decisions
- Upsert (`ON CONFLICT DO UPDATE`) makes re-marking idempotent — no duplicate errors
- Approved leave days excluded from denominator in 75% calculation (not from numerator)
- `period_no` nullable/null = day-level, non-null = period-wise marking
- `is_corrected` flag tracks whether a record was retroactively changed
- SMS notifications triggered on ABSENT status (stub ready for real provider)

---

## Phase 6 ✅ — Fee Structure & Billing

- [x] `FeeHead` (name, is_taxable, tax_percent) — defines fee categories
- [x] `FeeStructure` per class per academic year (amount per fee head)
- [x] `FeeInstallment` — splits annual amount with % and due_date
- [x] `LateFeeRule` — amount_per_day + max_amount per structure
- [x] `StudentDiscount` — scholarship/sibling discounts with valid_until
- [x] `Invoice` — gross, discount, net, due_date, status, razorpay fields
- [x] `PaymentOrder` — links Razorpay order to invoice (idempotency key)
- [x] Invoice generation on enrollment — auto-creates invoices for all installments
- [x] Discount application (scholarship first, then flat) — capped at gross amount
- [x] Structure clone endpoint — copies fee structure + installments to new year
- [x] `calculate_late_fee()` — dynamic, never stored, capped at max_amount
- [x] `POST /fees/orders` — creates Razorpay order + PaymentOrder record
- [x] `POST /fees/webhook/razorpay` — HMAC signature verification, idempotent via `razorpay_payment_id`
- [x] Migration `8532c3b3be21` — 7 tables with all FKs and indexes

### Decisions
- Late fees calculated dynamically at query time (not stored) — prevents race conditions
- Webhook is the single source of truth for payments — never trust frontend
- Idempotency via `razorpay_payment_id` duplicate check — retried webhooks don't double-credit
- `PaymentOrder` tracks Razorpay order lifecycle separately from Invoice
- Structure clone enables year-rollover without re-entering fee data

---

## Phase 5 ✅ — Admissions & Student Enrollment

- [x] `Admission` model with explicit state machine (10 states, 12 allowed transitions)
- [x] `can_transition()` validator — invalid transitions return 400
- [x] `AdmissionDocument` model — doc_type, file_key, status, verified_by/at
- [x] `enroll_student()` — uses `SELECT ... FOR UPDATE` to lock section row, prevents overbooking
- [x] Seat capacity check: `count_enrolled() < section.capacity` inside lock
- [x] Document upload: validates MIME (PDF/JPG), max 5MB, stores to MinIO
- [x] Document verification: admin marks VERIFIED, records who/when
- [x] StudentProfile created only after enrollment (auto-generates admission number)
- [x] `GET /admissions/transitions/{status}` — returns allowed next states
- [x] Migration `72b391f8b7d6` — `admissions` + `admission_documents` tables

### Decisions
- State machine enforced in Python (`ALLOWED_TRANSITIONS` dict) — no BK transitions
- FOR UPDATE lock on section row prevents race conditions on last seat
- Documents stored in MinIO under `admissions/{id}/{doc_type}/{uuid}.{ext}`
- Student account auto-created on enrollment with temporary password
- Enrollment only allowed from `FEE_PENDING` status

---

## Phase 4 ✅ — Academic Calendar & Class Setup

- [x] `AcademicYear` model with partial unique index `one_active_year` (enforces one active year)
- [x] `Class` (name, order), `Section` (class_id, name, capacity, academic_year_id)
- [x] `Subject` (name, code unique, is_graded) + `ClassSubject` junction table
- [x] `Holiday` model (date unique, name, holiday_type: national/school/exam)
- [x] `is_working_day()` utility — checks Sundays + holidays
- [x] CRUD endpoints: years, classes, sections, subjects, holidays (admin-protected)
- [x] `PATCH /academic/years/{id}/activate` — deactivates old, activates new
- [x] `POST /academic/classes/{id}/subjects` — links subject to class
- [x] Migration `5a3e6665e689` — 6 tables, partial unique index, all FKs

### Decisions
- Only one academic year can be active at a time (enforced at DB level via partial unique index)
- Subjects are global; `class_subjects` junction links them to classes
- Holidays are date-unique across all years (reusable annually)
- `is_working_day` used by attendance, timetable, and payroll downstream

---

## Phase 3 ✅ — Auth, Users & RBAC

- [x] `User` model with `ROLES` enum, email/phone indexes, soft delete
- [x] `StudentProfile`, `StaffProfile`, `ParentProfile` tables FK to `users.id`
- [x] JWT access tokens (15-min expiry) + Redis-backed refresh tokens (7-day TTL)
- [x] `POST /auth/login` — email+password returns access+refresh tokens
- [x] `POST /auth/refresh` — rotates refresh token (old deleted, new issued)
- [x] `POST /auth/logout` — deletes refresh token from Redis (instant revocation)
- [x] `POST /auth/otp/request` — generates 6-digit OTP, rate-limited (3/15min)
- [x] `POST /auth/otp/verify` — validates OTP, returns tokens (parent-only)
- [x] `GET /auth/me` — returns current user profile
- [x] `role_required(*roles)` — updated to accept varargs, attachable to routers
- [x] Migration `435ad8fcc950` — creates `users`, `student_profiles`, `staff_profiles`, `parent_profiles`
- [x] Migration SQL verified (all FKs, indexes, unique constraints correct)

### Decisions
- Refresh tokens stored in Redis (not JWT) — enables instant revocation on logout
- Parents use OTP-only auth; `hashed_pw` is nullable for parent accounts
- OTP rate limit: 3 requests per 15 minutes per phone number (Redis counter)
- `role_required` accepts `*args` so it reads naturally: `role_required("teacher", "principal")`
- Profile tables are separate (not JSON) for type safety and FK integrity

---

## Phase 2 ✅ — Database Foundation & Shared Mixins

- [x] `app/core/database.py` — pool_size=20, max_overflow=10, commit/rollback in `get_db`
- [x] `Base` moved to `app/core/database.py` (from shared/models.py)
- [x] `app/shared/models.py` — UUID primary keys in `TimestampMixin`, `VersionMixin` added, `SoftDeleteMixin` with `deleted_at` index
- [x] `app/modules/audit/models.py` — `AuditLog` table (append-only, no soft delete)
- [x] Alembic initialized with async `env.py` reading from `settings.DATABASE_URL`
- [x] Initial migration `bac88c1969cf` — creates `uuid-ossp` extension + `audit_logs` table
- [x] Offline migration SQL verified

### Decisions
- Audit log is immutable (no `SoftDeleteMixin`) — append-only for fee disputes, exam re-checks, and parent complaints
- `AuditLog` references `users.id` via FK but uses UUID type matching the mixin
- Migration is manual (not autogenerated) — will switch to autogenerate when Postgres is available via Docker

---

## Phase 1 ✅ — Project Bootstrap & Environment

- [x] Folder structure created (app/core, app/modules/*, app/shared, alembic, tests)
- [x] All `__init__.py` files in place
- [x] `requirements.txt` with 17 pinned dependencies
- [x] `.env` and `.env.example` with all secrets documented
- [x] `app/core/config.py` — pydantic-settings reading from `.env`
- [x] `app/core/database.py` — async SQLAlchemy engine + session
- [x] `app/core/security.py` — password hashing + JWT token helpers
- [x] `app/core/deps.py` — `get_current_user` + `role_required` dependencies
- [x] `app/shared/models.py` — `Base`, `TimestampMixin`, `SoftDeleteMixin`
- [x] `app/shared/pagination.py` — `PaginationParams`, `PaginatedResponse`
- [x] `app/shared/storage.py` — S3/MinIO helpers
- [x] `app/main.py` — FastAPI app with `/health` endpoint
- [x] `docker-compose.yml` — Postgres 16, Redis 7, MinIO
- [x] Virtual environment `.venv` with all deps installed (no conflicts)
- [x] All module imports verified

### Decisions
- Async PostgreSQL driver: `asyncpg`
- JWT library: `python-jose[cryptography]`
- Password hashing: `passlib[bcrypt]`
- Background tasks: `celery[redis]`
- File storage: S3-compatible (MinIO for dev)
- PDF generation: `weasyprint`
- ORM: SQLAlchemy 2.0 asyncio

---

---

## Phase 9 ✅ — Library & Staff/HR

- [x] `BookCategory` (name, description), `Book` (title, author, isbn, publisher, category, total_copies)
- [x] `BookCopy` (barcode unique, status: AVAILABLE/ISSUED/DAMAGED/LOST, indexed)
- [x] `BookIssue` (copy, issued_to/by, due_date, returned_date, status indexed)
- [x] `Fine` (issue, user, amount, reason, is_paid), `Reservation` (book, user, status indexed)
- [x] `issue_book()` — checks borrow limit (max 2), uses `with_for_update()` on copy row, creates issue + updates copy status
- [x] `return_book()` — calculates overdue fine (₹5/day if returned after due_date), updates copy to AVAILABLE
- [x] `reserve_book()` — checks availability, creates WAITING reservation, returns first available copy
- [x] CRUD endpoints for books, copies, categories (librarian-protected)
- [x] `POST /library/issue`, `POST /library/return/{issue_id}`, `POST /library/reserve` endpoints
- [x] `StaffLeave` model (leave_type, start/end_date, status, approved_by)
- [x] `PayrollRun` (run_id unique, year, month, is_finalized, finalized_by/at)
- [x] `PayrollRecord` (run_id+staff_id unique, gross, LOP, PF, ESIC, net_pay, is_draft)
- [x] `SalarySlip` table for generated PDF storage
- [x] `run_payroll_for_month()` — idempotent via `ON CONFLICT DO UPDATE` by `run_id`
- [x] `finalize_payroll()` — marks run as finalized + sets all records to non-draft
- [x] Staff leave apply/approve/reject workflow
- [x] Migration `ebb125adc676` — 11 tables (book_categories, books, book_copies, book_issues, book_reservations, library_fines, staff_leaves, payroll_runs, payroll_records, salary_slips)
- [x] All imports verified (main.py, alembic/env.py, library service, staff payroll)

### Decisions
- Library borrow limit: 2 books per user; overdue fine: ₹5/day
- `SELECT FOR UPDATE` on book copy row during issue prevents double-borrowing race condition
- Payroll idempotent by `run_id = f"{year}-{month:02d}"` — re-running updates rather than duplicates
- Payroll finalized as a two-step: draft run → finalize (prevents partial payslip generation)
- PF = 12% each (employee+employer), ESIC = 0.75% of gross

---

---

## Phase 10 ✅ — Parent Portal & Notifications

- [x] `ParentStudentLink` model (parent_id+student_id unique, relationship) — enables multi-child support
- [x] `get_parent_child()` dependency — validates child belongs to parent, returns 403 otherwise
- [x] `GET /parent/children` — lists all children with class name and relationship
- [x] `GET /parent/child/{child_id}/attendance?start=&end=` — date-range attendance records
- [x] `GET /parent/child/{child_id}/fees/dues` — pending/overdue invoices with late fee computed dynamically
- [x] `GET /parent/child/{child_id}/results` — exam results grouped by exam with aggregates (grade, rank)
- [x] `GET /parent/child/{child_id}/eligibility` — 75% attendance eligibility check
- [x] `GET /parent/circulars` — published circulars ordered by date
- [x] `POST /parent/child/{child_id}/message` — send message to teacher (routes to first available teacher)
- [x] `GET /parent/child/{child_id}/messages` — read messages from teachers
- [x] `POST /parent/child/{child_id}/leaves` — apply leave on behalf of child
- [x] `GET /parent/child/{child_id}/leaves` — view child's leave history
- [x] `Circular` model (title, body, attachment, optional class target, published_at)
- [x] `TeacherMessage` model (sender/receiver, student FK, is_read, read_at)
- [x] `UserNotificationPref` model (user_id unique, sms/email/push enabled, defaults True)
- [x] `GET /parent/notifications/prefs` — get notification preferences
- [x] `PATCH /parent/notifications/prefs` — update opt-out per channel
- [x] `NOTIFICATION_EVENTS` dict — 7 events (absent, fee.due_reminder, fee.paid, result.published, leave.approved, leave.rejected, circular.new)
- [x] `send_notification()` Celery task — iterates user_ids, checks opt-out, dispatches per channel, retries 3×
- [x] Dispatch stubs for SMS, email, push (logging stubs, ready for real provider)
- [x] Migration `8787f8aaf831` — 4 tables (parent_student_links, circulars, teacher_messages, user_notification_prefs)
- [x] All imports verified

### Decisions
- Every parent endpoint except `GET /parent/children` and `GET /parent/circulars` goes through `get_parent_child()` — prevents cross-child data access
- Parent token does NOT contain child IDs — resolved dynamically from `ParentStudentLink` table
- Messages route to first available active teacher (no teacher-selector UI complexity)
- Notifications queued via Celery, never sent synchronously in request path
- Opt-out defaults to all channels enabled; missing `UserNotificationPref` row = all enabled
- Failed SMS retried 3 times (Celery `max_retries=3`); push failures logged silently
- 7 notification events with channel routing: absent → sms+push, fee due → sms+email, results → push+email
- Notification templates use `str.format()` with named placeholders

---

---

## Phase 11 ✅ — Testing & API Documentation

- [x] `TEST_DATABASE_URL` added to `app/core/config.py` with sensible default
- [x] `pytest-cov==7.1.0` added to `requirements.txt` and installed
- [x] `tests/conftest.py` — session-scoped async engine, per-test transaction rollback, client fixture overriding `get_db`
- [x] `tests/factories.py` — factory helpers for `create_user`, `create_student_profile`, `create_academic_year`, `create_class`, `create_subject`, `create_fee_structure`, `create_invoice`, `create_leave_type`, `create_book_with_copy`, `create_payroll_run/record`, `create_parent_with_child`
- [x] `pyproject.toml` — pytest asyncio_mode=auto, coverage `fail_under=80`, source=app
- [x] `tests/modules/auth/test_auth.py` — login returns tokens, wrong password 401, refresh rotation, logout revocation
- [x] `tests/modules/admissions/test_admissions.py` — `test_invalid_admission_transition` (400 on invalid status jump), `test_seat_overbooking_concurrent` (3 students, capacity 2, max 2 succeed)
- [x] `tests/modules/fees/test_fees.py` — `test_late_fee_calculation` (dynamic: 5/day capped at 500, drops to 0 when PAID), `test_razorpay_webhook_idempotent` (same payload twice, both succeed)
- [x] `tests/modules/attendance/test_attendance.py` — `test_attendance_eligibility_75pct` (seed attendance records, verify percentage computed)
- [x] `tests/modules/exams/test_exams.py` — `test_exam_marks_optimistic_lock` (read two versions, write first, flush second raises), `test_marks_workflow_transition` (DRAFT→SUBMITTED via service)
- [x] `tests/modules/library/test_library.py` — `test_library_concurrent_issue` (asyncio.gather 2 students on 1 copy, ≤1 succeeds), `test_borrow_limit_enforced` (3 attempts max 2 issues)
- [x] `tests/modules/staff/test_staff.py` — `test_payroll_idempotent_run` (same month twice, 1 record), `test_finalize_payroll` (is_finalized flips to True)
- [x] `tests/modules/parent/test_parent.py` — `test_parent_cannot_access_other_child` (parent sees own child 200, other's child 403), `test_parent_lists_only_own_children` (1 child returned)
- [x] OpenAPI docs auto-generated by FastAPI (all routers tagged, `/docs` available at runtime)
- [x] All test imports verified

### Decisions
- Tests use a separate `TEST_DATABASE_URL` (default `postgresql+asyncpg://school:school@localhost:5433/school_test`) — never touches production DB
- Each test wrapped in a transaction that rolls back after completion — zero data pollution
- Factories use `db.add()` + `flush()` for ID generation, not commit — stays within the test transaction
- Concurrent tests use `asyncio.gather()` to simulate race conditions without threads
- Coverage gate set at 80% (`fail_under=80`) — enforced in CI but not blocking local runs
- No mock library used — tests call real service functions through the FastAPI app with DB overrides
- `exam/test_exams.py` imports `ExamResult` directly for optimistic lock test (bypasses API for version column access)
- `test_borrow_limit_enforced` demonstrates real edge case: 3 issue attempts at limit 2

---

## Future Phases

- **Phase 12** — Final polish (rate limiting, API docs enhancement, production hardening, deployment readiness)
