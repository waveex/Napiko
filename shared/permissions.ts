/**
 * Role i uprawnienia w organizacji (warsztacie).
 *
 * Plik jest współdzielony przez serwer (Better Auth) i aplikację (UI),
 * dzięki czemu te same reguły decydują o dostępie i o tym, co widać na ekranie.
 * Uprawnienia modułów biznesowych (zlecenia, pojazdy, magazyn) dojdą po zatwierdzeniu SRS.
 */
import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements, ownerAc, adminAc } from 'better-auth/plugins/organization/access'

export const statements = {
  ...defaultStatements,
  settings: ['read', 'update'],
  file: ['upload', 'read'],
  audit: ['read'],
  customer: ['read', 'create', 'update'],
  /** Dane kontaktowe klienta (telefon, e-mail, NIP, notatki) – minimalizacja danych dla mechaników. */
  customerContact: ['read'],
  vehicle: ['read', 'create', 'update'],
  workOrder: ['read', 'create', 'update'],
  /** assign – przydział innym, selfAssign – branie zadań samemu, work – statusy i czas pracy. */
  task: ['read', 'create', 'update', 'assign', 'selfAssign', 'work'],
  /** Potrzeby zgłaszane przez mechaników: quote – wycena i zamówienia, decide – decyzja (np. zgoda klienta telefonicznie). */
  workRequest: ['read', 'create', 'quote', 'decide'],
  /** Rozliczenia: dane firmy do dokumentów, cennik, kosztorysy, paragony. Mechanik ich nie widzi. */
  billing: ['read', 'update'],
  /** Wyniki warsztatu na pulpicie: wartość zamkniętych zleceń, akceptacje prac dodatkowych, czas pracy zespołu. */
  report: ['read'],
  /** Wiadomości do klienta (przyjęcie pojazdu, gotowy do odbioru) i link do statusu naprawy. */
  customerNotification: ['read', 'send'],
} as const

const officeWorkshop = {
  customer: ['read', 'create', 'update'],
  customerContact: ['read'],
  vehicle: ['read', 'create', 'update'],
  workOrder: ['read', 'create', 'update'],
  task: ['read', 'create', 'update', 'assign', 'selfAssign', 'work'],
  workRequest: ['read', 'create', 'quote', 'decide'],
  billing: ['read', 'update'],
  customerNotification: ['read', 'send'],
} as const

export const ac = createAccessControl(statements)

export const roles = {
  /** Właściciel: pełne prawa, w tym usunięcie organizacji i wyniki warsztatu. */
  owner: ac.newRole({
    ...ownerAc.statements,
    ...officeWorkshop,
    settings: ['read', 'update'],
    file: ['upload', 'read'],
    audit: ['read'],
    report: ['read'],
  }),
  /** Biuro: przyjmuje zlecenia, zarządza zespołem i ustawieniami, bez usuwania organizacji. */
  office: ac.newRole({
    ...adminAc.statements,
    ...officeWorkshop,
    settings: ['read', 'update'],
    file: ['upload', 'read'],
    audit: ['read'],
  }),
  /** Mechanik: realizuje zadania, dodaje zdjęcia i wideo. */
  mechanic: ac.newRole({
    settings: ['read'],
    file: ['upload', 'read'],
    customer: ['read'],
    vehicle: ['read'],
    workOrder: ['read'],
    task: ['read', 'selfAssign', 'work'],
    workRequest: ['read', 'create'],
  }),
}

export type OrgRole = keyof typeof roles

export const ORG_ROLES = Object.keys(roles) as OrgRole[]

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Właściciel',
  office: 'Biuro',
  mechanic: 'Mechanik',
}

export type PermissionRequest = {
  [K in keyof typeof statements]?: Array<(typeof statements)[K][number]>
}

/** Członek może mieć kilka ról zapisanych po przecinku (np. "office,mechanic"). */
export function parseRoles(role: string | null | undefined): OrgRole[] {
  return (role ?? '')
    .split(',')
    .map(r => r.trim())
    .filter((r): r is OrgRole => r in roles)
}

export function hasPermission(role: string | null | undefined, request: PermissionRequest): boolean {
  return parseRoles(role).some(r => roles[r].authorize(request as never).success)
}
