# SchoolERP — Context & Memory

## Project Overview

Full-stack K-12 School Management ERP with role-based portals for super_admin, principal, teacher, accountant, librarian, parent, and student.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 8, React Router 7, TanStack React Query 5, Axios, Tailwind CSS 4, Lucide React |
| **Backend** | Python 3, FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2 |
| **Auth** | JWT access tokens (15min) + refresh tokens (7 days in Redis), OTP for parents |
| **DB** | PostgreSQL 16 |
| **Cache** | Redis 7 (sessions, rate limiting, refresh tokens) |
| **Files** | MinIO (S3-compatible) |
| **Tasks** | Celery + Redis broker |
| **PDF** | WeasyPrint |
| **Payments** | Razorpay |
| **Infra** | Docker Compose (PostgreSQL, Redis, MinIO) |

## Directory Structure

```
schoolmanage/
├── schoolerp/                          # React frontend
│   └── src/
│       ├── main.jsx                    # Entry, QueryClient
│       ├── App.jsx                     # Routes (lazy-loaded pages)
│       ├── api/
│       │   ├── frappe.js               # Central API client (JWT, CRUD, error parsing)
│       │   ├── googleClassroom.js
│       │   └── homework.js
│       ├── components/                 # Reusable UI (Layout, Sidebar, RoleGuard, modals)
│       ├── context/
│       │   ├── AuthContext.jsx          # Auth state, session validation, login/logout
│       │   ├── SettingsContext.jsx      # School branding/settings
│       │   └── AcademicYearContext.jsx  # Current academic year
│       ├── hooks/                      # Custom React Query hooks (per domain)
│       │   ├── useFrappeQuery.js        # Generic CRUD hooks wrapping frappe.js
│       │   ├── useStudents.js, useFees.js, useExams.js, ... (13 hooks)
│       │   └── useDebounce.js
│       ├── config/
│       │   ├── roleConfig.js           # Pages each role can access
│       │   └── roleAccess.js           # canAccess(), getAllowedPages(), getPrimaryRole()
│       ├── utils/
│       │   └── roles.js                # isSuperAdmin(), isTeacher(), etc.
│       └── pages/                      # 38 page components (lazy-loaded)
│
└── school-erp-backend/                  # Python FastAPI backend
    ├── app/
    │   ├── main.py                     # FastAPI app, CORS, 12 module routers
    │   ├── core/
    │   │   ├── config.py               # pydantic-settings (env vars)
    │   │   ├── database.py             # Async SQLAlchemy engine, get_db
    │   │   ├── security.py             # JWT encode/decode, password hashing, OTP
    │   │   ├── deps.py                 # get_current_user, role_required(), QueryScoper
    │   │   ├── redis.py                # Redis async client
    │   │   └── rate_limit.py           # SlowAPI limiter
    │   ├── shared/
    │   │   ├── models.py              # TimestampMixin (UUID PK), SoftDeleteMixin
    │   │   ├── notifications.py
    │   │   ├── pagination.py
    │   │   ├── storage.py             # MinIO/S3 file storage
    │   │   └── tasks.py               # Celery tasks
    │   └── modules/                    # Feature modules (each has router/schemas/models/service)
    │       ├── auth/                   # Login, refresh, logout, OTP, user CRUD
    │       ├── academic/               # AcademicYear, Class, Section, Subject, Enrollment
    │       ├── admissions/             # Student admissions pipeline
    │       ├── fees/                   # Fee structures, invoices, Razorpay payments
    │       ├── attendance/             # Attendance marking, leave management
    │       ├── timetable/              # Timetable slots
    │       ├── exams/                  # Exams, assessments, report cards
    │       ├── library/                # Books, issues, returns, reservations, fines
    │       ├── staff/                  # Staff profiles, salary, leave
    │       ├── parent/                 # Parent portal endpoints
    │       ├── homework/               # Homework, Google Classroom sync
    │       └── admin/                  # Dashboard stats, user mgmt, settings, audit log
    ├── alembic/versions/               # 13 migration files
    ├── scripts/                        # Seed scripts
    └── tests/                          # Pytest suite (per module)
```

## Auth & Authorization

### JWT Flow
- Login returns `access_token` (15min) + `refresh_token` (7 days)
- Refresh tokens stored in Redis: `refresh_token:{user_id}`
- Axios interceptor auto-refreshes on 401
- JWT payload: `{ sub: user_id, role: role, type: "access"|"refresh" }`

### Role Enforcement (two layers)
1. **Endpoint-level**: `role_required("super_admin", "principal")` decorator in deps.py
2. **Row-level**: `QueryScoper` class auto-applies WHERE clauses for list queries

### QueryScoper Rules (deps.py)
| Role | Students | Attendance | Leaves | Homework | Timetable | Invoices |
|---|---|---|---|---|---|---|
| super_admin | all | all | all | all | all | all |
| principal | all | all | all | all | all | all |
| teacher | own section | own section | own | own | own | N/A |
| accountant | N/A | N/A | N/A | N/A | N/A | all |
| librarian | N/A | N/A | N/A | N/A | N/A | N/A |
| parent | children only | children only | N/A | N/A | N/A | children |
| student | self only | self only | own | own | N/A | self |

### 7 Roles
`super_admin` > `principal` > `teacher` > `accountant` > `librarian` > `parent` > `student`

## Key Backend Patterns

### Module Structure
Each module under `app/modules/{name}/` follows:
```
router.py   # FastAPI router with endpoints
schemas.py  # Pydantic request/response schemas
models.py   # SQLAlchemy ORM models
service.py  # Business logic (optional)
```

### Dependency Injection
```
async def endpoint(db=Depends(get_db), current_user=Depends(role_required("teacher", "principal"))):
```
- `get_db` yields async SQLAlchemy sessions
- `get_current_user` decodes JWT, checks user exists and is active
- `role_required()` wraps get_current_user with role check

### Soft Delete
`SoftDeleteMixin` adds `deleted_at` column. Currently only on `User` model. Queries should filter `User.deleted_at.is_(None)`.

### UUID PKs
All models use UUID primary keys via `TimestampMixin` (`id = Column(UUID, primary_key, default=uuid4)`).

## Key Frontend Patterns

### API Client (`src/api/frappe.js`, ~2100 lines)
Mimics Frappe/ERPNext patterns over REST. Key exports:
- `login(email, pwd)` — authenticates, stores tokens
- `getList(doctype, filters?, fields?, orderBy?, limit?, page?)` — list with pagination
- `getDoc(doctype, name)` — single record
- `createDoc(doctype, data)` — create
- `updateDoc(doctype, name, data)` — update
- `deleteDoc(doctype, name)` — soft-ish delete
- Uses doctype-to-endpoint mapping: `{ "Student": "/academic/students", "Fee": "/fees/invoices", ... }`

### React Query Hooks (`src/hooks/useFrappeQuery.js`)
Generic wrappers:
- `useFrappeList(doctype, filters, options)` — list with cache key
- `useFrappeDoc(doctype, name)` — single doc
- `useFrappeCreate(doctype)` — mutation
- `useFrappeUpdate(doctype)` — mutation
- `useFrappeDelete(doctype)` — mutation
- `useFrappeMutation(doctype, method)` — custom

Domain-specific hooks per module build on top of these.

### State Management
- No Redux or Zustand — React Query handles server state
- `AuthContext` for auth state/user/role
- `SettingsContext` for school name/branding
- `AcademicYearContext` for current active academic year

### Routing & Guards
- `App.jsx`: All routes nested under `<RoleGuard><Layout /></Route>`
- `RoleGuard` calls `canAccess(user.roles, path)` from `roleAccess.js`
- Pages lazy-loaded via `React.lazy()`
- Login is the only eagerly loaded page

### Role-based Sidebar
`Sidebar.jsx` has 7 navigation groups. Each role sees different items based on `roleConfig.js`.

## Database (13 Alembic Migrations)

1. `initial_schema` — base tables
2. `users_and_profiles` — User, StudentProfile, StaffProfile, ParentProfile
3. `academic_tables` — AcademicYear, Class, Section, Subject, ClassSubject, Enrollment
4. `admissions_tables` — Admission pipeline
5. `fee_tables` — FeeStructure, FeeHead, Invoice, PaymentOrder
6. `attendance_tables` — Attendance, Leave
7. `timetable_and_exam_tables` — TimetableSlot, Exam, Assessment
8. `parent_and_notification_tables` — ParentStudentLink, Notification
9. `library_and_staff_tables` — Book, Issue, Reservation, Fine, Staff salary
10. `homework_table` — Homework, HomeworkSubmission
11. `admin_tables` — AuditLog, SystemSetting
12. `report_cards_and_academic_progressions` — ReportCard, AcademicProgression
13. `phase2_role_scoping` — Role scoping enhancements

## API Endpoints (12 routers)

| Prefix | Module | Key Endpoints |
|---|---|---|
| `/auth` | auth | login, refresh, logout, OTP, /me, users CRUD |
| `/academic` | academic | years, classes, sections, subjects, enrollments, teacher assignments |
| `/admissions` | admissions | pipeline CRUD |
| `/fees` | fees | structures, invoices, payments, Razorpay |
| `/attendance` | attendance | mark, by-section, overview, leaves |
| `/timetable` | timetable | slots CRUD |
| `/exams` | exams | exams, assessments, report cards |
| `/library` | library | books, issues, returns, fines |
| `/staff` | staff | profiles, salary, leave |
| `/parent` | parent | dashboard, children data |
| `/homework` | homework | assignments, submissions, Google Classroom |
| `/admin` | admin | stats, users, settings, audit log |
| `/health` | root | health check |

## Running Locally

```bash
# Infrastructure
docker compose -f school-erp-backend/docker-compose.yml up -d

# Backend
cd school-erp-backend
source .venv/Scripts/activate   # Windows
uvicorn app.main:app --reload --port 8001

# Frontend
cd schoolerp
npm run dev   # Port 5173, proxies /api -> localhost:8001

# DB Migrations
cd school-erp-backend
alembic upgrade head

# Seed data
python scripts/seed_users.py
```

## Code Style Conventions

### Backend
- Async everywhere (async def, async SQLAlchemy)
- UUID PKs via TimestampMixin
- Soft delete via SoftDeleteMixin (deleted_at)
- Pydantic v2 for schemas
- Module isolation — each module owns its models/schemas/routes
- `service.py` for business logic (when router gets too heavy)

### Frontend
- No TypeScript — plain JSX
- React Query for all server state (no Redux)
- Axios client with JWT auto-refresh interceptor
- RoleGuard for route-level access
- Fat API client (frappe.js) — doctype-patterned CRUD
- Tailwind CSS for styling
- Lucide React for icons
- Lazy-loaded page components

## Current Dev Phase

Recent work includes Phase 2 Role Scoping (row-level data filtering via QueryScoper), Admin API endpoints, and Student role-aware features. Planning docs in `docs/superpowers/`.

## Common Patterns

**Adding a new page:**
1. Create page component in `schoolerp/src/pages/`
2. Add lazy import + route in `App.jsx`
3. Add page to role permissions in `roleConfig.js`
4. If needed, add API endpoint in backend module

**Adding a new backend endpoint:**
1. Add schema in module's `schemas.py`
2. Add query logic in `service.py` or router
3. Add route in `router.py` with appropriate `role_required()` or QueryScoper
4. Register router in `main.py` if new module

**Adding a new module:**
1. Create `app/modules/{name}/` with `__init__.py`, `router.py`, `schemas.py`, `models.py`
2. Create alembic migration: `alembic revision --autogenerate -m "description"`
3. Register router in `main.py`
