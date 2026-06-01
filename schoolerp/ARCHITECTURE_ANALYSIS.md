# SchoolERP — Architecture Analysis & Implementation Status

> Last updated: 2026-05-17. Comprehensive audit of the entire codebase.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Current Architecture](#2-current-architecture)
3. [Implementation Status](#3-implementation-status)
4. [Role-Based Access Control (RBAC)](#4-role-based-access-control-rbac)
5. [Page-by-Page Analysis](#5-page-by-page-analysis)
6. [Remaining Issues](#6-remaining-issues)
7. [Remaining Roadmap](#7-remaining-roadmap)

---

## 1. Project Overview

**Stack:** React 19 + Vite 8 + Tailwind CSS 4 + ERPNext/Frappe REST API

**Dependencies:**
| Package | Version | Status |
|---------|---------|--------|
| React | 19.2.6 | Active |
| React Router | 7.15.0 | Active |
| Axios | 1.16.0 | Active |
| TanStack React Query | 5.100.10 | Installed, configured, **not actively used** (pages still use raw useEffect) |
| Lenis | 1.3.23 | Installed, **unused** |

**Backend:** ERPNext v15 instance with Education module. Admin API key proxy via Vite dev plugin.

---

## 2. Current Architecture

```
src/
├── api/
│   └── frappe.js              — Axios client, CRUD, auth, admin proxy (241 lines)
├── config/
│   └── roleAccess.js           — RBAC: role→page mapping, canAccess, getPrimaryRole (151 lines)
├── components/
│   ├── Layout.jsx              — Auth guard + sidebar shell (41 lines)
│   ├── Sidebar.jsx             — Role-filtered navigation (196 lines)
│   ├── Topbar.jsx              — Search bar + user dropdown (95 lines)
│   ├── RoleGuard.jsx           — Route-level RBAC enforcement (24 lines)
│   ├── ErrorBoundary.jsx       — Global crash fallback (85 lines)
│   ├── Pagination.jsx          — Reusable pagination (63 lines)
│   ├── UserModal.jsx           — Create user form
│   ├── UserViewModal.jsx       — Read-only user view
│   ├── AssignClassModal.jsx    — Assign instructor to class
│   └── AssignStudentGroupModal.jsx — Assign instructor to group
├── context/
│   ├── AuthContext.jsx         — Server-validated auth + roles (106 lines)
│   └── SettingsContext.jsx     — School + system settings (57 lines)
├── pages/
│   ├── Login.jsx               — Custom login with SVG illustration (408 lines)
│   ├── Dashboard.jsx           — Stats, charts, schedule, activity (326 lines)
│   ├── Students.jsx            — 3-level drill-down: Standards→Sections→Students (924 lines)
│   ├── UserDetail.jsx          — Full user profile + credentials + edit (874 lines)
│   ├── Classes.jsx             — Student Group CRUD (302 lines)
│   ├── Subjects.jsx            — Course CRUD (211 lines)
│   ├── Attendance.jsx          — Mark & view attendance (443 lines)
│   ├── Timetable.jsx           — Weekly grid (275 lines)
│   ├── Fees.jsx                — Fee invoices with multi-view (740 lines)
│   ├── Accounts.jsx            — Chart of accounts (179 lines)
│   ├── Users.jsx               — Team directory (298 lines)
│   ├── GeneralSettings.jsx     — System config (352 lines)
│   ├── Schedule.jsx            — Alt schedule view (392 lines, legacy)
│   ├── Courses.jsx             — Course catalog (446 lines, legacy)
│   ├── Programs.jsx            — Program mgmt (269 lines, legacy)
│   ├── Homework.jsx            — STUB (16 lines)
│   ├── Behaviour.jsx           — STUB (15 lines)
│   ├── Exams.jsx               — STUB (12 lines)
│   ├── ClassTests.jsx          — STUB (12 lines)
│   ├── Certificates.jsx        — STUB (12 lines)
│   ├── Reports.jsx             — STUB (12 lines)
│   ├── Employees.jsx           — STUB (15 lines)
│   ├── Salary.jsx              — STUB (15 lines)
│   ├── LiveClass.jsx           — STUB (12 lines)
│   ├── Messaging.jsx           — STUB (12 lines)
│   ├── SmsServices.jsx         — STUB (12 lines)
│   └── Store.jsx               — STUB (12 lines)
├── App.jsx                     — Routes with lazy loading + RoleGuard (106 lines)
├── main.jsx                    — Entry point with providers
└── index.css                   — CSS variables + animations
```

---

## 3. Implementation Status

### Phase 1 — Security & Auth Fixes ✅ COMPLETED

| Fix | Status | Details |
|-----|--------|---------|
| Server-side session validation | ✅ | `getLoggedUser()` on every app load, no localStorage |
| AuthContext with roles | ✅ | Fetches full User doc, extracts roles, admin proxy fallback |
| Login race condition fix | ✅ | Roles fetched before `setIsAuthenticated(true)` |
| "Principle" → "Principal" typo | ✅ | Fixed in UserModal |
| Users.jsx uses frappeAPI | ✅ | Raw fetch replaced with API module |
| Design system unification | ✅ | All colors use CSS variables |
| .gitignore + .env | ✅ | Created |

### Phase 2 — Data & Settings ✅ COMPLETED

| Fix | Status | Details |
|-----|--------|---------|
| SettingsContext | ✅ | Loads System Settings + Education Settings, provides to entire app |
| GeneralSettings save | ✅ | Saves to both doctypes, calls `settingsCtx.reload()` |
| Hardcoded values replaced | ✅ | `academic_year`, `company` from SettingsContext |
| ErrorBoundary | ✅ | Class component with styled fallback UI |

### Phase 3 — Performance ✅ COMPLETED

| Fix | Status | Details |
|-----|--------|---------|
| React.lazy code splitting | ✅ | 25 pages lazy loaded, Login eager |
| React Query installed | ✅ | QueryClientProvider wraps app (but pages don't use it yet) |
| N+1 query fixes | ✅ | Students inline fields, batch fetch |
| Pagination | ✅ | Reusable component, Students/Users paginated |
| getList pagination param | ✅ | `limit_start` support added |

### Phase 4 — Role & Security ✅ COMPLETED

| Fix | Status | Details |
|-----|--------|---------|
| RBAC config | ✅ | `src/config/roleAccess.js` — 7 roles mapped to pages |
| RoleGuard component | ✅ | Route-level enforcement, redirects unauthorized to `/` |
| Sidebar role filtering | ✅ | Nav items filtered by `getAllowedPages()`, empty groups hidden |
| Role label in sidebar | ✅ | Shows "Instructor", "Accountant", "Student" under user name |
| Desk User role assignment | ✅ | Added to teacher + student users in ERPNext |
| AuthContext admin fallback | ✅ | Falls back to `adminCallMethod` if `getDoc` returns empty roles |
| Login Credentials card | ✅ | UserDetail shows email + password reset button |
| Teacher-scoped Students | ✅ | Teachers see only their assigned sections |
| Teacher-scoped Classes | ✅ | Filters by `class_teacher` |
| Teacher-scoped Attendance | ✅ | Auto-selects teacher's section |
| Teacher-scoped Timetable | ✅ | Auto-selects teacher's group |
| Admin API proxy | ✅ | `adminCreateDoc`/`adminUpdateDoc` for permission bypass |

---

## 4. Role-Based Access Control (RBAC)

### Role → Page Mapping

| Page | Path | Admin | Instructor | Accountant | Student |
|------|------|:-----:|:----------:|:----------:|:-------:|
| Dashboard | `/` | ✅ | ✅ | ✅ | ✅ |
| Settings | `/settings` | ✅ | ❌ | ❌ | ❌ |
| Students | `/students` | ✅ | ✅ | ❌ | ❌ |
| Classes | `/classes` | ✅ | ✅ | ❌ | ❌ |
| Subjects | `/subjects` | ✅ | ✅ | ❌ | ❌ |
| Attendance | `/attendance` | ✅ | ✅ | ❌ | ✅ |
| Timetable | `/timetable` | ✅ | ✅ | ❌ | ✅ |
| Homework | `/homework` | ✅ | ✅ | ❌ | ✅ |
| Behaviour | `/behaviour` | ✅ | ✅ | ❌ | ❌ |
| Exams | `/exams` | ✅ | ✅ | ❌ | ✅ |
| Class Tests | `/class-tests` | ✅ | ✅ | ❌ | ✅ |
| Certificates | `/certificates` | ✅ | ✅ | ❌ | ❌ |
| Reports | `/reports` | ✅ | ✅ | ✅ | ❌ |
| Employees | `/employees` | ✅ | ❌ | ✅ | ❌ |
| Salary | `/salary` | ✅ | ❌ | ✅ | ❌ |
| Accounts | `/accounts` | ✅ | ❌ | ✅ | ❌ |
| Fees | `/fees` | ✅ | ❌ | ✅ | ❌ |
| Live Class | `/live-class` | ✅ | ✅ | ❌ | ✅ |
| Messaging | `/messaging` | ✅ | ✅ | ✅ | ✅ |
| SMS | `/sms` | ✅ | ❌ | ✅ | ❌ |
| Store | `/store` | ✅ | ❌ | ✅ | ❌ |
| Users | `/users` | ✅ | ❌ | ❌ | ❌ |

### ERPNext Roles Used

| ERPNext Role | Maps To | Purpose |
|-------------|---------|---------|
| `Administrator` | Admin | Full access (wildcard `*`) |
| `Instructor` | Instructor | Teaching staff |
| `Academics User` | Instructor | Same permissions as Instructor |
| `Accounts User` | Accountant | Finance staff |
| `Accounts Manager` | Accountant | Finance staff |
| `HR User` | HR Staff | HR operations |
| `HR Manager` | HR Staff | HR operations |
| `Student` | Student | Limited student view |
| `Desk User` | (system) | Required for ERPNext desk access |

### Auth Flow

```
Login
  ↓
POST /api/method/login → session cookie set
  ↓
GET /api/method/frappe.auth.get_logged_user → email
  ↓
GET /api/resource/User/{email} → full user doc with roles
  ↓ (if fails)
adminCallMethod('frappe.client.get') → admin proxy fallback
  ↓
setUser({ ...fullUser, roles: ['Instructor', 'Desk User'] })
setIsAuthenticated(true)
  ↓
Sidebar reads roles → filters nav items
RoleGuard checks canAccess(roles, pathname) → blocks unauthorized routes
```

---

## 5. Page-by-Page Analysis

### Fully Implemented (12 pages)

| Page | Lines | Key Features | Issues |
|------|-------|-------------|--------|
| **Login** | 408 | Custom SVG illustration, show/hide password, animated entry | "Forgot password" link non-functional; uses `window.location.href` for redirect |
| **Dashboard** | 326 | 4 stat cards, attendance chart, recent activity, quick links | Schedule items hardcoded; fee collection % hardcoded |
| **Students** | 924 | 3-level drill-down, teacher scoping, guardian info, pagination | 924 lines — needs decomposition; fallback standards hardcoded |
| **UserDetail** | 874 | Hero banner, metric cards, credentials card, password reset, 3 tabs, edit modal | 874 lines — needs decomposition; fuzzy instructor matching |
| **Classes** | 302 | CRUD, teacher scoping, search, stats | Clean |
| **Subjects** | 211 | Card grid, color-coded, search, CRUD | Clean |
| **Attendance** | 443 | Mark/view tabs, bulk actions, progress bar, teacher auto-select | Uses admin proxy for saves |
| **Timetable** | 275 | Weekly grid, color-coded, teacher auto-select | `window.confirm` for delete |
| **Fees** | 740 | 4 stat cards, multi-filter, table/card views, 2-step create wizard | Student loading could be slow |
| **Accounts** | 179 | Table view, add account, color-coded types | Read-only for existing |
| **Users** | 298 | Card grid, role filters, pagination, delete, add via modal | Only shows Instructor/Accountant roles |
| **GeneralSettings** | 352 | 3 config sections, saves to 2 doctypes, unsaved warning | Clean |

### Legacy Pages (3 — redirected but still imported)

| Page | Lines | Redirects To | Notes |
|------|-------|-------------|-------|
| Programs | 269 | `/classes` | N+1 student count |
| Courses | 446 | `/subjects` | Dynamic import inconsistency |
| Schedule | 392 | `/timetable` | Alternate schedule view |

### Stub Pages (12 — "Coming soon")

| Page | Lines | Notes |
|------|-------|-------|
| Homework | 16 | Missing ERPNext doctype noted |
| Behaviour | 15 | |
| Exams | 12 | |
| ClassTests | 12 | |
| Certificates | 12 | |
| Reports | 12 | |
| Employees | 15 | |
| Salary | 15 | |
| LiveClass | 12 | |
| Messaging | 12 | |
| SmsServices | 12 | |
| Store | 12 | |

### Shared Modals (3)

| Component | Used By | Purpose |
|-----------|---------|---------|
| AssignClassModal | UserDetail, Schedule | Assign instructor to a class |
| AssignStudentGroupModal | UserDetail | Assign instructor to a student group |
| UserModal | Users | Create new user with roles |

---

## 6. Remaining Issues

### Critical

1. **Hardcoded API credentials in `vite.config.js`** — API key/secret on lines 5-6. Works for dev, needs proper backend proxy for production.

2. **RoleGuard exact path matching** — `canAccess()` uses `Array.includes()`. Nested routes like `/users/someone@email.com` won't match `/users`. Only works for Admin (wildcard).

3. **TanStack React Query installed but unused** — Configured in main.jsx but all 27+ pages still use raw `useEffect`/`useState`. No caching, deduplication, or stale-while-revalidate.

### Moderate

4. **No responsive/mobile layout** — Sidebar is fixed 250px, no hamburger menu. Content overlaps on small screens.

5. **12 of 24 pages are stubs** — Homework, Behaviour, Exams, ClassTests, Certificates, Reports, Employees, Salary, LiveClass, Messaging, SmsServices, Store.

6. **Monolithic components** — Students (924 lines), UserDetail (874 lines), Fees (740 lines) need decomposition.

7. **No toast notification system** — Some pages use `alert()`, some use inline state. Need a unified Toast provider.

8. **Topbar is cosmetic** — Search input does nothing, notification count hardcoded to 3, "Profile" and "Settings" buttons non-functional.

### Low Priority

9. **No tests** — Zero test files in the project.

10. **Unused dependencies** — `lenis` installed but never imported.

11. **No TypeScript** — Entire codebase is JavaScript.

12. **Dashboard hardcoded data** — Schedule items and fee collection percentage are static.

---

## 7. Remaining Roadmap

### Phase 5 — Complete Stub Pages (Priority)

Build the 12 stub pages in order of school necessity:

1. **Homework** — Assignment creation, submission tracking (needs custom DocType or use ToDo)
2. **Exams** — Exam scheduling, marks entry (ERPNext Assessment Plan/Result)
3. **Class Tests** — Quick test creation, marks (similar to Exams)
4. **Employees** — Employee directory (ERPNext Employee doctype)
5. **Salary** — Salary slip viewing (ERPNext Salary Slip)
6. **Reports** — Academic + financial reports
7. **Certificates** — TC, bonafide, character certificate generation
8. **Behaviour** — Disciplinary records (custom DocType)
9. **LiveClass** — Video class integration
10. **Messaging** — Internal messaging
11. **SmsServices** — SMS notification config
12. **Store** — Inventory/POS

### Phase 6 — Code Quality

- [ ] Decompose Students.jsx into StandardsView, SectionsView, StudentsView
- [ ] Decompose UserDetail.jsx into sub-components
- [ ] Replace all `alert()` with Toast system
- [ ] Implement React Query hooks for all pages
- [ ] Fix RoleGuard to handle nested routes (startsWith matching)
- [ ] Make Topbar functional (search, notifications, profile nav)
- [ ] Add mobile responsive layout

### Phase 7 — Production Readiness

- [ ] Move API credentials to backend proxy
- [ ] Add error logging (Sentry or similar)
- [ ] Add Vitest unit tests
- [ ] Add Playwright E2E tests
- [ ] TypeScript migration (start with api/ and hooks/)
- [ ] Remove unused dependencies (lenis)

---

## Summary

| Category | Status |
|----------|--------|
| Auth & Security | ✅ Server-validated, RBAC enforced |
| Data Persistence | ✅ Settings save correctly |
| Performance | ✅ Code split, paginated, N+1 fixed |
| Role-Based Access | ✅ 7 roles, sidebar filtering, route guards |
| Teacher Scoping | ✅ 4 pages auto-filter by class_teacher |
| Feature Completeness | ⚠️ 12 of 24 pages are stubs |
| Code Quality | ⚠️ Large components, no tests, no React Query usage |
| Production Ready | ❌ Needs backend proxy, tests, responsive layout |
