import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { UserDetail } from '@/types';
import { UsersApi } from '@/api/users.api';
import { contextsApi } from '@/api/contexts';
import { confirmWorkspaceAccess } from '../confirm-workspace-access';
vi.mock('@/api/users.api', () => ({ UsersApi: { getMe: vi.fn() } }));
vi.mock('@/api/contexts', () => ({ contextsApi: { getContexts: vi.fn() } }));
const profile = { id: 'auth0|host', isActive: true, orgId: 'org-1', onboardingCompletedAt: '2026-11-17', onboardingRequired: false, consentsAccepted: true, commercialSetupRequired: false } as UserDetail;
const context = { contextKey: 'short-rent' as const, displayName: 'Short rent', roleKey: 'property_owner', permissions: ['property.write'], defaultRoute: '/app/short-rent' };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(UsersApi.getMe).mockResolvedValue(profile); vi.mocked(contextsApi.getContexts).mockResolvedValue({ userId: profile.id, contexts: [context] }); });
describe('server-confirmed onboarding continuation', () => {
  it('uses persisted memberships without inspecting or creating JWT roles and replaces the stale profile', async () => {
    const client = new QueryClient(); client.setQueryData(['me'], { orgId: null });
    await confirmWorkspaceAccess(client, '/app/short-rent/properties/create?first=1');
    expect(client.getQueryData(['me'])).toEqual(profile);
    expect(contextsApi.getContexts).toHaveBeenCalledOnce();
  });
  it.each([{ orgId: null }, { isActive: false }, { onboardingCompletedAt: null }, { onboardingRequired: true }, { consentsAccepted: false }, { commercialSetupRequired: true }])('does not continue with an incomplete or withheld profile: %j', async patch => {
    vi.mocked(UsersApi.getMe).mockResolvedValue({ ...profile, ...patch });
    await expect(confirmWorkspaceAccess(new QueryClient(), '/app/short-rent')).rejects.toThrow();
    expect(contextsApi.getContexts).not.toHaveBeenCalled();
  });
  it.each([{ userId: profile.id, contexts: [] }, { userId: 'other-user', contexts: [context] }])('does not continue without the current user authorized context', async response => {
    vi.mocked(contextsApi.getContexts).mockResolvedValue(response);
    await expect(confirmWorkspaceAccess(new QueryClient(), '/app/short-rent')).rejects.toThrow();
  });
  it('keeps a server denial and does not replace the cached profile', async () => {
    const client = new QueryClient(); client.setQueryData(['me'], { orgId: null });
    const denied = { response: { status: 403 } }; vi.mocked(contextsApi.getContexts).mockRejectedValue(denied);
    await expect(confirmWorkspaceAccess(client, '/app/short-rent')).rejects.toBe(denied);
    expect(client.getQueryData(['me'])).toEqual({ orgId: null });
  });
});
