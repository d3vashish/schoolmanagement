import ROLES from './roleConfig'

const PRIORITY = ['super_admin', 'principal', 'teacher', 'accountant', 'librarian', 'parent', 'student']

export function getAllowedPages(roles = []) {
  if (!roles.length) return ['/']
  const paths = new Set()
  for (const role of roles) {
    const cfg = ROLES[role]
    if (!cfg) continue
    if (cfg.pages === '*') return '*'
    cfg.pages.forEach(p => paths.add(p))
  }
  paths.add('/')
  return [...paths]
}

export function canAccess(roles, path) {
  const allowed = getAllowedPages(roles)
  if (allowed === '*') return true
  return allowed.includes(path)
}

export function getPrimaryRole(roles = []) {
  for (const r of PRIORITY) {
    if (roles.includes(r)) return ROLES[r].label
  }
  return roles[0] || 'User'
}
