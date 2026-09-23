import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '@/hooks/use-auth';
import { useUserRoles } from '../use-user-roles';

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));

const getAccessToken = vi.fn(async () => undefined);

function mockAuth(user: Record<string, unknown> | undefined, isAuthenticated = true) {
  vi.mocked(useAuth).mockReturnValue({
    user,
    isAuthenticated,
    isLoading: false,
    getAccessToken,
  } as unknown as ReturnType<typeof useAuth>);
}

describe('useUserRoles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useUserRoles_NewUserObjectWithSameRoles_ReturnsSameArray', () => {
    mockAuth({ roles: ['PropertyOwner'] });
    const { result, rerender } = renderHook(() => useUserRoles());
    const first = result.current;

    mockAuth({ roles: ['PropertyOwner'] });
    rerender();

    expect(result.current).toBe(first);
    expect(result.current).toEqual(['PropertyOwner']);
  });

  it('useUserRoles_RolesChange_ReturnsNewRoles', async () => {
    mockAuth({ roles: ['PropertyOwner'] });
    const { result, rerender } = renderHook(() => useUserRoles());

    mockAuth({ roles: ['PropertyOwner', 'LongTermLandlord'] });
    rerender();

    await waitFor(() => expect(result.current).toEqual(['PropertyOwner', 'LongTermLandlord']));
  });

  it('useUserRoles_SignedOut_ReturnsEmptyRoles', async () => {
    mockAuth({ roles: ['PropertyOwner'] });
    const { result, rerender } = renderHook(() => useUserRoles());

    mockAuth(undefined, false);
    rerender();

    await waitFor(() => expect(result.current).toEqual([]));
  });
});
