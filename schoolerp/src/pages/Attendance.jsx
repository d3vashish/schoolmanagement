import TeacherAttendance from '../components/TeacherAttendance';

export default function Attendance() {
  return (
    <div className="space-y-6 pb-24 md:pb-6">
      {/* ── Header ── */}
      <div>
        <div className="eyebrow">Academics</div>
        <h1 className="text-3xl font-bold text-[var(--color-text)] -mt-1">Teacher Attendance</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">Mark and review daily staff attendance</p>
      </div>

      <TeacherAttendance />
    </div>
  );
}