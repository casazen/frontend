import type { UserDetail, UserRole, UserSummary } from '@/types';

type RawUser = Record<string, unknown>;

function readString(raw: RawUser, camel: string, pascal: string): string {
  const value = raw[camel] ?? raw[pascal];
  return typeof value === 'string' ? value : '';
}

function readBool(raw: RawUser, camel: string, pascal: string, fallback = false): boolean {
  const value = raw[camel] ?? raw[pascal];
  return typeof value === 'boolean' ? value : fallback;
}

function readRoles(raw: RawUser): UserRole[] {
  const roles = raw.roles ?? raw.Roles;
  if (Array.isArray(roles)) {
    return roles.filter((r): r is UserRole => typeof r === 'string');
  }

  const single = readString(raw, 'role', 'Role');
  return single ? [single as UserRole] : [];
}

export function normalizeUserSummary(raw: RawUser): UserSummary {
  const firstName = readString(raw, 'firstName', 'FirstName');
  const lastName = readString(raw, 'lastName', 'LastName');
  const email = readString(raw, 'email', 'Email');
  const roles = readRoles(raw);
  const primaryRole = (readString(raw, 'role', 'Role') || roles[0] || 'Guest') as UserRole;

  return {
    id: readString(raw, 'id', 'Id'),
    email,
    firstName,
    lastName,
    role: primaryRole,
    roles: roles.length > 0 ? roles : [primaryRole],
    rentalType: (raw.rentalType ?? raw.RentalType) as UserSummary['rentalType'],
    isActive: readBool(raw, 'isActive', 'IsActive', true),
    createdAt: readString(raw, 'createdAt', 'CreatedAt'),
  };
}

export function normalizeUserDetail(raw: RawUser): UserDetail {
  const summary = normalizeUserSummary(raw);
  return {
    ...summary,
    phoneNumber: readString(raw, 'phoneNumber', 'PhoneNumber') || undefined,
    updatedAt: readString(raw, 'updatedAt', 'UpdatedAt'),
  };
}

export function displayUserName(user: Pick<UserSummary, 'firstName' | 'lastName' | 'email' | 'id'>): string {
  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  if (fullName) return fullName;
  if (user.email) return user.email;
  return user.id;
}
