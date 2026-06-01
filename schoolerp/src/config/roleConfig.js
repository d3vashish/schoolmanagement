const ACADEMIC = ['/', '/students', '/classes', '/subjects', '/attendance', '/timetable', '/homework', '/behaviour', '/library', '/admissions']
const EXAMS = ['/exams', '/class-tests', '/certificates', '/reports', '/exam-management']
const FINANCE = ['/', '/employees', '/salary', '/accounts', '/fees', '/reports']
const COMMS = ['/live-class', '/messaging', '/notifications', '/store']

const ROLES = {
  super_admin: { label: 'Administrator', pages: '*' },
  principal: { label: 'Administrator', pages: '*' },
  teacher: { label: 'Instructor', pages: [...ACADEMIC, ...EXAMS, ...COMMS] },
  accountant: { label: 'Accounts User', pages: [...FINANCE, '/messaging', '/notifications', '/store'] },
  librarian: { label: 'Librarian', pages: ['/', '/students', '/attendance', '/reports', '/library', '/notifications'] },
  parent: { label: 'Parent', pages: ['/', '/parent', '/attendance', '/timetable', '/homework', '/fees', '/live-class', '/messaging', '/notifications'] },
  student: { label: 'Student', pages: ['/', '/attendance', '/timetable', '/homework', '/exams', '/class-tests', '/live-class', '/messaging', '/library', '/notifications'] },
}

export default ROLES
