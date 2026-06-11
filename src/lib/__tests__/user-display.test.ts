import { describe, it, expect } from 'vitest';
import { normalizeUserSummary } from '@/lib/api-normalize';
import { formatUserDisplayName } from '@/lib/user-display';

describe('normalizeUserSummary', () => {
  it('maps PascalCase backend fields to camelCase', () => {
    const user = normalizeUserSummary({
      Id: 'auth0|1',
      Email: 'mario@example.com',
      FirstName: 'Mario',
      LastName: 'Rossi',
      Role: 'PropertyOwner',
      IsActive: true,
    });

    expect(user.id).toBe('auth0|1');
    expect(user.email).toBe('mario@example.com');
    expect(user.firstName).toBe('Mario');
    expect(user.lastName).toBe('Rossi');
  });
});

describe('formatUserDisplayName', () => {
  it('prefers full name over email and id', () => {
    expect(
      formatUserDisplayName({
        id: 'auth0|1',
        email: 'mario@example.com',
        firstName: 'Mario',
        lastName: 'Rossi',
      }),
    ).toBe('Mario Rossi');
  });

  it('falls back to email when names are missing', () => {
    expect(
      formatUserDisplayName({
        id: 'auth0|1',
        email: 'mario@example.com',
        firstName: '',
        lastName: '',
      }),
    ).toBe('mario@example.com');
  });
});
