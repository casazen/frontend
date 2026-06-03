import { describe, it, expect } from 'vitest';
import {
  getUserRoles,
  hasRole,
  isDualRole,
  isLongTermOnly,
  isShortStayOnly,
  ROLES_CLAIM,
  ROLE_LONG_TERM_LANDLORD,
  ROLE_PROPERTY_OWNER,
} from '../auth-roles';

describe('auth-roles', () => {
  it('reads roles from Auth0 custom claim namespace', () => {
    const user = { [ROLES_CLAIM]: ['LongTermLandlord', 'PropertyOwner'] };
    expect(getUserRoles(user)).toEqual(['LongTermLandlord', 'PropertyOwner']);
    expect(hasRole(user, 'LongTermLandlord')).toBe(true);
    expect(hasRole(user, 'Admin')).toBe(false);
  });

  it('falls back to roles array on demo user shape', () => {
    const user = { roles: ['LongTermLandlord'] };
    expect(hasRole(user, 'LongTermLandlord')).toBe(true);
  });

  it('returns empty roles for missing user', () => {
    expect(getUserRoles(undefined)).toEqual([]);
    expect(hasRole(null, 'LongTermLandlord')).toBe(false);
  });

  it('identifies short-stay-only users', () => {
    const user = { roles: [ROLE_PROPERTY_OWNER] };
    expect(isShortStayOnly(user)).toBe(true);
    expect(isLongTermOnly(user)).toBe(false);
    expect(isDualRole(user)).toBe(false);
  });

  it('identifies long-term-only users', () => {
    const user = { roles: [ROLE_LONG_TERM_LANDLORD] };
    expect(isLongTermOnly(user)).toBe(true);
    expect(isShortStayOnly(user)).toBe(false);
    expect(isDualRole(user)).toBe(false);
  });

  it('identifies dual-role users', () => {
    const user = { roles: [ROLE_PROPERTY_OWNER, ROLE_LONG_TERM_LANDLORD] };
    expect(isDualRole(user)).toBe(true);
    expect(isShortStayOnly(user)).toBe(false);
    expect(isLongTermOnly(user)).toBe(false);
  });
});
