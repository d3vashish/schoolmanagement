export function isSuperAdmin(user) {
  return user?.roles?.includes('super_admin');
}

export function isPrincipal(user) {
  return user?.roles?.includes('principal');
}

export function isAdmin(user) {
  return isSuperAdmin(user) || isPrincipal(user);
}

export function isTeacher(user) {
  return user?.roles?.includes('teacher');
}

export function isLibrarian(user) {
  return user?.roles?.includes('librarian');
}

export function isAccountant(user) {
  return user?.roles?.includes('accountant');
}

export function isStudent(user) {
  return user?.roles?.includes('student');
}

export function isParent(user) {
  return user?.roles?.includes('parent');
}

export function canManageStudents(user) {
  return isSuperAdmin(user) || isPrincipal(user);
}

export function canDeleteStudent(user) {
  return isSuperAdmin(user);
}

export function canManageStandards(user) {
  return isSuperAdmin(user);
}

export function canManageSections(user) {
  return isSuperAdmin(user);
}
