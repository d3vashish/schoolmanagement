import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { AcademicYearProvider } from './context/AcademicYearContext';
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
const Schedule = lazy(() => import('./pages/Schedule'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Fees = lazy(() => import('./pages/Fees'));
const Users = lazy(() => import('./pages/Users'));
const UserDetail = lazy(() => import('./pages/UserDetail'));
const GeneralSettings = lazy(() => import('./pages/GeneralSettings'));
const Classes = lazy(() => import('./pages/Classes'));
const Subjects = lazy(() => import('./pages/Subjects'));
const Employees = lazy(() => import('./pages/Employees'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Salary = lazy(() => import('./pages/Salary'));
const Timetable = lazy(() => import('./pages/Timetable'));
const Homework = lazy(() => import('./pages/Homework'));
const Behaviour = lazy(() => import('./pages/Behaviour'));
const Exams = lazy(() => import('./pages/Exams'));
const ClassTests = lazy(() => import('./pages/ClassTests'));
const Certificates = lazy(() => import('./pages/Certificates'));
const Reports = lazy(() => import('./pages/Reports'));
const LiveClass = lazy(() => import('./pages/LiveClass'));
const Messaging = lazy(() => import('./pages/Messaging'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Store = lazy(() => import('./pages/Store'));
const Library = lazy(() => import('./pages/Library'));
const Admissions = lazy(() => import('./pages/Admissions'));
const ParentDashboard = lazy(() => import('./pages/ParentDashboard'));
const ParentChildView = lazy(() => import('./pages/ParentChildView'));
const ExamManagement = lazy(() => import('./pages/ExamManagement'));

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
                  <Route path="students/:id" element={<StudentDetail />} />
                  <Route path="classes" element={<Classes />} />
                  <Route path="subjects" element={<Subjects />} />
                  <Route path="attendance" element={<Attendance />} />
                  <Route path="timetable" element={<Timetable />} />
                  <Route path="homework" element={<Homework />} />
                  <Route path="behaviour" element={<Behaviour />} />
                  <Route path="library" element={<Library />} />
                  <Route path="admissions" element={<Admissions />} />

                  {/* ── Examinations ── */}
                  <Route path="exams" element={<Exams />} />
                  <Route path="class-tests" element={<ClassTests />} />
                  <Route path="certificates" element={<Certificates />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="exam-management" element={<ExamManagement />} />

                  {/* ── HR & Finance ── */}
                  <Route path="employees" element={<Employees />} />
                  <Route path="salary" element={<Salary />} />
                  <Route path="accounts" element={<Accounts />} />
                  <Route path="fees" element={<Fees />} />

                  {/* ── Communication ── */}
                  <Route path="live-class" element={<LiveClass />} />
                  <Route path="messaging" element={<Messaging />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="store" element={<Store />} />

                  {/* ── Parent Portal ── */}
                  <Route path="parent" element={<ParentDashboard />} />
                  <Route path="parent/child/:childId" element={<ParentChildView />} />

                  {/* ── Admin ── */}
                  <Route path="users" element={<Users />} />
                  <Route path="users/:email" element={<UserDetail />} />

                  {/* ── Legacy redirects ── */}
                  <Route path="programs" element={<Navigate to="/classes" replace />} />
                  <Route path="courses" element={<Navigate to="/subjects" replace />} />
                  <Route path="schedule" element={<Navigate to="/timetable" replace />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          </AcademicYearProvider>
        </SettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
