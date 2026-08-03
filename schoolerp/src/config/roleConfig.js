const ACADEMIC = ['/', '/students', '/subjects', '/classes', '/attendance', '/timetable', '/homework', '/behaviour', '/library', '/admissions']
const EXAMS = ['/exams', '/class-tests', '/certificates', '/reports', '/exam-management']
const FINANCE = ['/', '/employees', '/salary', '/accounts', '/fees', '/reports']
const COMMS = ['/live-class', '/messaging', '/notifications', '/store']

const ROLES = {
  super_admin: { label: 'Administrator', pages: '*' },
  principal: { label: 'Administrator', pages: '*' },
  teacher: { label: 'Instructor', pages: [...ACADEMIC.filter(pg => pg !== '/attendance'), ...EXAMS, ...COMMS] },
  accountant: { label: 'Accounts User', pages: [...FINANCE, '/students/lookup', '/messaging', '/notifications', '/store'] },
  librarian: { label: 'Librarian', pages: ['/', '/students', '/students/lookup', '/reports', '/library', '/notifications'] },
  parent: { label: 'Parent', pages: ['/', '/parent', '/timetable', '/homework', '/fees', '/live-class', '/messaging', '/notifications'] },
  student: { label: 'Student', pages: ['/', '/timetable', '/homework', '/exams', '/class-tests', '/live-class', '/messaging', '/library', '/notifications'] },
}

export default ROLES