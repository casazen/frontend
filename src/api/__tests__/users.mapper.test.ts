import { describe, expect, it } from 'vitest';
import { displayUserName, normalizeUserSummary } from '@/api/users.mapper';

describe('normalizeUserSummary', () => {
  it('maps PascalCase API fields to camelCase', () => {
    const user = normalizeUserSummary({
      Id: 'u1',
      Email: 'mario@example.com',
      FirstName: 'Mario',
      LastName: 'Rossi',
      Role: 'PropertyOwner',
      Roles: ['PropertyOwner', 'LongTermLandlord'],
      IsActive: true,
      CreatedAt: '2026-01-01T00:00:00Z',
    });

    expect(user).toMatchObject({
      id: 'u1',
      email: 'mario@example.com',
      firstName: 'Mario',
      lastName: 'Rossi',
      role: 'PropertyOwner',
      roles: ['PropertyOwner', 'LongTermLandlord'],
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    });
  });

  it('falls back to single role when roles array is missing', () => {
    const user = normalizeUserSummary({
      id: 'u2',
      email: 'guest@example.com',
      role: 'Guest',
    });

    expect(user.roles).toEqual(['Guest']);
  });
});

describe('displayUserName', () => {
  it('prefers full name, then email, then id', () => {
    expect(
      displayUserName({
        id: 'u1',
        firstName: 'Mario',
        lastName: 'Rossi',
        email: 'mario@example.com',
      }),
    ).toBe('Mario Rossi');

    expect(
      displayUserName({
        id: 'u2',
        firstName: '',
        lastName: '',
        email: 'solo@example.com',
      }),
    ).toBe('solo@example.com');

    expect(
      displayUserName({
        id: 'u3',
        firstName: '',
        lastName: '',
        email: '',
      }),
    ).toBe('u3');
  });
});
