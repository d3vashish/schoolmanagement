import { useState, useRef, useEffect } from 'react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const today = () => new Date().toISOString().split('T')[0];

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function DatePicker({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value ? new Date(value + 'T00:00:00') : new Date();
    return d.getMonth();
  });
  const [viewYear, setViewYear] = useState(() => {
    const d = value ? new Date(value + 'T00:00:00') : new Date();
    return d.getFullYear();
  });
  const ref = useRef(null);

  const selectedDate = value ? new Date(value + 'T00:00:00') : null;
  const todayDate = today();
  const todayObj = new Date(todayDate + 'T00:00:00');

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Sync view month when value changes
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setViewMonth(d.getMonth());
      setViewYear(d.getFullYear());
    }
  }, [value]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  // Build calendar grid
  const cells = [];
  // Empty cells for days before the 1st
  for (let i = 0; i < firstDay; i++) cells.push(null);
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectDate = (day) => {
    const d = new Date(viewYear, viewMonth, day);
    onChange(toDateStr(d));
    setOpen(false);
  };

  const goToday = () => {
    onChange(todayDate);
    setViewMonth(todayObj.getMonth());
    setViewYear(todayObj.getFullYear());
    setOpen(false);
  };

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const isToday = (day) =>
    viewYear === todayObj.getFullYear() &&
    viewMonth === todayObj.getMonth() &&
    day === todayObj.getDate();

  const isSelected = (day) =>
    selectedDate &&
    viewYear === selectedDate.getFullYear() &&
    viewMonth === selectedDate.getMonth() &&
    day === selectedDate.getDate();

  const isFuture = (day) => {
    const d = new Date(viewYear, viewMonth, day);
    return d > todayObj;
  };

  const isWeekend = (day) => {
    const d = new Date(viewYear, viewMonth, day).getDay();
    return d === 0 || d === 6;
  };

  const displayLabel = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : 'Select date';

  const isTodaySelected = value === todayDate;

  return (
    <div className="relative" ref={ref}>
      {label && (
        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={`input text-sm flex items-center gap-2 min-w-[200px] cursor-pointer text-left ${
          !isTodaySelected ? 'border-amber-300 bg-amber-50/50' : ''
        }`}>
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="flex-1 font-medium">{displayLabel}</span>
        {!isTodaySelected && (
          <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">NOT TODAY</span>
        )}
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 w-[320px] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Quick actions */}
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <button onClick={goToday}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                isTodaySelected
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              Today
            </button>
            <button onClick={() => { const d = new Date(); d.setDate(d.getDate() - 1); onChange(toDateStr(d)); setOpen(false); }}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">
              Yesterday
            </button>
          </div>

          {/* Month/Year nav */}
          <div className="flex items-center justify-between px-4 py-2">
            <button onClick={goPrevMonth}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-bold text-gray-800">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button onClick={goNextMonth}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 px-3">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 px-3 pb-3 gap-0.5">
            {cells.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />;

              const future = isFuture(day);
              const weekend = isWeekend(day);
              const selected = isSelected(day);
              const todayCell = isToday(day);

              return (
                <button
                  key={day}
                  onClick={() => !future && selectDate(day)}
                  disabled={future}
                  className={`relative h-9 rounded-lg text-sm font-medium transition-all ${
                    selected
                      ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20'
                      : todayCell
                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold'
                        : future
                          ? 'text-gray-200 cursor-not-allowed'
                          : weekend
                            ? 'text-gray-400 hover:bg-gray-50'
                            : 'text-gray-700 hover:bg-gray-50'
                  }`}>
                  {day}
                  {todayCell && !selected && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--color-primary)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
