import { describe, it, expect } from 'vitest';
import { getUserRoles, hasRole, ROLES_CLAIM } from '../auth-roles';

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
});
