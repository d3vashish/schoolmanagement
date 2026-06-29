import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { AcademicYearProvider } from './context/AcademicYearContext';
import { NotificationProvider } from './context/NotificationContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import RoleGuard from './components/RoleGuard';

// ── Eagerly loaded (auth + shell) ────────────────────────────────────────────
import Login from './pages/Login';

// ── Lazy loaded pages ────────────────────────────────────────────────────────
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Students = lazy(() => import('./pages/Students'));
const StudentDetail = lazy(() => import('./pages/StudentDetail'));
const Courses = lazy(() => import('./pages/Courses'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Fees = lazy(() => import('./pages/Fees'));
const Users = lazy(() => import('./pages/Users'));
const UserDetail = lazy(() => import('./pages/UserDetail'));
const GeneralSettings = lazy(() => import('./pages/GeneralSettings'));
const Subjects = lazy(() => import('./pages/Subjects'));
const Classes = lazy(() => import('./pages/Classes'));
const Employees = lazy(() => import('./pages/Employees'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Salary = lazy(() => import('./pages/Salary'));
const Timetable = lazy(() => import('./pages/Timetable'));
const Homework = lazy(() => import('./pages/Homework'));
const ClassTests = lazy(() => import('./pages/ClassTests'));
const Certificates = lazy(() => import('./pages/Certificates'));
const Reports = lazy(() => import('./pages/Reports'));
const Library = lazy(() => import('./pages/Library'));
const Admissions = lazy(() => import('./pages/Admissions'));
const ParentDashboard = lazy(() => import('./pages/ParentDashboard'));
const ParentChildView = lazy(() => import('./pages/ParentChildView'));
const ExamManagement = lazy(() => import('./pages/ExamManagement'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const AdminUserDetail = lazy(() => import('./pages/AdminUserDetail'));
const StudentLookup = lazy(() => import('./pages/StudentLookup'));

const PageLoader = () => (
  <div className="flex items-center justify-center py-20">
    <span className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SettingsProvider>
          <AcademicYearProvider>
          <NotificationProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<RoleGuard><Layout /></RoleGuard>}>
                  {/* ── Core ── */}
                  <Route index element={<Dashboard />} />
                  <Route path="settings" element={<GeneralSettings />} />

                  {/* ── Academic ── */}
                  <Route path="students" element={<Students />} />
                  <Route path="students/lookup" element={<StudentLookup />} />
                  <Route path="students/:id" element={<StudentDetail />} />
                  <Route path="subjects" element={<Subjects />} />
                  <Route path="classes" element={<Classes />} />
                  <Route path="attendance" element={<Attendance />} />
                  <Route path="timetable" element={<Timetable />} />
                  <Route path="homework" element={<Homework />} />
                  <Route path="library" element={<Library />} />
                  <Route path="admissions" element={<Admissions />} />

                  {/* ── Examinations ── */}
                  {/* /exams removed: it was a Google-Classroom-only page (Exams.jsx)
                      with no FastAPI backing. exam-management is the real, working page. */}
                  <Route path="class-tests" element={<ClassTests />} />
                  <Route path="certificates" element={<Certificates />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="exam-management" element={<ExamManagement />} />

                  {/* ── HR & Finance ── */}
                  <Route path="employees" element={<Employees />} />
                  <Route path="salary" element={<Salary />} />
                  <Route path="accounts" element={<Accounts />} />
                  <Route path="fees" element={<Fees />} />

                  {/* ── Parent Portal ── */}
                  <Route path="parent" element={<ParentDashboard />} />
                  <Route path="parent/child/:childId" element={<ParentChildView />} />

                  {/* ── Admin ── */}
                  <Route path="admin" element={<AdminDashboard />} />
                  <Route path="admin/users/:id" element={<AdminUserDetail />} />
                  <Route path="users" element={<Users />} />
                  <Route path="users/:email" element={<UserDetail />} />
                  <Route path="audit-log" element={<AuditLog />} />

                  {/* ── Legacy redirects ── */}
                  <Route path="programs" element={<Navigate to="/students" replace />} />
                  <Route path="courses" element={<Navigate to="/subjects" replace />} />
                  <Route path="exams" element={<Navigate to="/exam-management" replace />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          </NotificationProvider>
          </AcademicYearProvider>
        </SettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;