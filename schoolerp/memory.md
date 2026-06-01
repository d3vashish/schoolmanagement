# SchoolERP — Project Memory

## Stack
- **Frontend**: React 19 + Vite 8 + Tailwind CSS 4
- **Backend**: ERPNext (v15/v16) at `http://16.176.144.18`
- **API Proxy**: Vite dev server proxies `/api` → ERPNext (changeOrigin, 30s timeout)
- **Auth**: Session-based (ERPNext login cookie), CSRF token from cookie for write ops
- **Deps**: axios, react-router-dom v7

## Project Structure

```
schoolerp/
├── src/
│   ├── api/frappe.js        — ERPNext REST API wrapper (axios)
│   ├── components/
│   │   ├── Layout.jsx       — Auth guard + sidebar + Outlet
│   │   ├── Sidebar.jsx      — Collapsible sidebar with nav links
│   │   ├── UserModal.jsx    — Create user modal (email, name, role, password)
│   ├── context/
│   │   ├── AuthContext.jsx  — Login/logout, session check
│   │   └── SidebarContext.jsx — Sidebar expand/collapse state
│   ├── pages/
│   │   ├── Login.jsx        — Login page
│   │   ├── Dashboard.jsx    — Stats overview
│   │   ├── Users.jsx        — Premium Instructor/Staff directory grid
│   │   ├── UserDetail.jsx   — Advanced multi-tab user profile & HR dashboard
│   │   ├── Students.jsx     — Student management
│   │   ├── Programs.jsx     — Program management
│   │   ├── Courses.jsx      — Course management
│   │   ├── Schedule.jsx     — Schedule management
│   │   ├── Attendance.jsx   — Attendance management
│   │   └── Fees.jsx         — Fees management
│   ├── App.jsx              — Routes (all pages under Layout)
│   ├── main.jsx             — Entry point
│   └── index.css            — Tailwind + base styles
├── memory.md                — This file
├── vite.config.js           — Proxy /api → ERPNext
├── package.json
└── tailwind.config.js
```

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/login` | Login | Login page |
| `/` | Dashboard | Stats overview |
| `/students` | Students | Student management |
| `/programs` | Programs | Program management |
| `/courses` | Courses | Course management |
| `/schedule` | Schedule | Schedule management |
| `/attendance` | Attendance | Attendance management |
| `/fees` | Fees | Fees management |
| `/users` | Users | **Instructor & Staff list** — Premium grid view |
| `/users/:email` | UserDetail | Single user advanced dashboard (Profile, HR, Academic) |

## Users Page (Team Directory)

### Data Flow
All data fetching in `Users.jsx` uses **native `fetch`** (not axios), bypassing the API wrapper to avoid stale client/cookie issues.
Optimized to **2 API calls total** (down from N+1):

1. **Call 1**: `GET /api/resource/User?fields=["name","first_name","last_name","email","enabled"]&limit_page_length=200`
2. **Call 2**: Concurrently fetches full docs for all valid users to extract roles.
3. **Display**: Premium Cards with gradient avatars, name, email, absolute-positioned active/inactive badges, role pills.
4. **Create**: `UserModal.jsx` → calls `createUser()` (axios) → also attempts `createDoc('Instructor', ...)` silently.

## UserDetail Page (Advanced Dashboard)

The `UserDetail` component has been upgraded into a comprehensive Admin Dashboard featuring progressive loading and multi-source data aggregation.

### Architecture
- **Progressive Rendering**: The core `User` document is fetched first. The UI renders instantly to provide immediate feedback.
- **Parallel Background Fetching**: Once the core User renders, the component triggers concurrent background fetches for linked data (`Instructor`, `Employee`, `Accountant`).
- **Auxiliary Data**: Further background queries fetch HR & Academic details: `Salary Slip`, `Attendance`, `Leave Application`, `Course Schedule`, `Student Group`, and `Assessment Plan`.

### Instructor/Employee Linking Logic (Crucial)
Because the `Instructor` DocType in ERPNext might not have a reliable `user` link field, we use a multi-step fallback to match a `User` to their `Instructor` profile:
1. **By Employee ID**: If the user has an `Employee` doc (matched by `user_id`), check if any `Instructor` matches that employee ID.
2. **Fuzzy Name Match**: Compare `Instructor Name` against `User.first_name + User.last_name`. Includes logic to handle typos and substring matches safely (ignoring blank names).

### Editing Capabilities
The "Edit Profile" modal allows administrators to edit standard `User` fields AND organizational fields simultaneously:
- Edits update the `User` doc.
- If the user has the Instructor role, it updates the `Instructor` doc (Department, Employee ID, Status).
- **Auto-Creation**: If an Instructor document does NOT exist but the user has the Instructor role and saves organizational details, the frontend automatically calls `createDoc` to generate the missing `Instructor` profile in ERPNext.
- **Status Constraints**: ERPNext `Instructor` status only accepts `Active` or `Left` (not "Inactive").

## API Layer (`frappe.js`)

All exports use the singleton `apiClient` (axios) with `withCredentials: true` and auto CSRF token injection.

| Export | Method | Endpoint | Notes |
|--------|--------|----------|-------|
| `login(usr, pwd)` | POST | `/api/method/login` | |
| `logout()` | POST | `/api/method/logout` | Resets `apiClient = null` |
| `getList(doctype, filters, fields, pageLength)` | GET | `/api/resource/{doctype}` | Returns `[]` on error |
| `getDoc(doctype, name)` | GET | `/api/resource/{doctype}/{name}` | |
| `createDoc(doctype, data)` | POST | `/api/resource/{doctype}` | |
| `updateDoc(doctype, name, data)` | PUT | `/api/resource/{doctype}/{name}` | |
| `deleteDoc(doctype, name)` | DELETE | `/api/resource/{doctype}/{name}` | |
| `createUser(userData)` | POST | `/api/resource/User` | Sends `new_password` + `roles` child table |
| `deleteUser(email)` | DELETE | `/api/resource/User/{email}` | |

## Key ERPNext Behaviors & Gotchas

1. **User `name` field** = email (except Administrator and Guest which are literal strings)
2. **Role child table** in User doc is `"roles"` (not `"user_roles"`)
3. **Has Role** is a child table — REST list endpoint returns empty; roles must be fetched via parent User doc
4. **Creating User** requires `new_password` field (not `password`)
5. **Password policy** rejects common/weak passwords — frontend validates before submitting
6. **Instructor doctype list field crash**: querying with `user` Link field in `getList` fields crashes ERPNext (DataError). Always omit `user` from list fields or avoid querying Instructor doctype entirely.
7. **Instructor Status Options**: Only "Active" and "Left" are valid standard statuses (not "Inactive"), sending "Inactive" triggers a 417 Expectation Failed.

## Design Decisions

- **Premium UI Overhaul**: Moved from basic tables to modern glassmorphic dashboards, sticky tabs, robust KPI metric cards, and absolute-positioned status pills to wow the users.
- **Connections Block**: Replicated the ERPNext doc-linking functionality directly in the React frontend, allowing administrators to see related records (Schedules, Assessments, Student Groups) effortlessly.
- **Progressive Loading over Full Spinners**: Dashboard perception speed is prioritized. `UserDetail.jsx` renders the layout instantly after fetching the User core document, then hydrates the metric cards asynchronously.
