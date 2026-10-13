import axios from '@/lib/axios';
import { ApiClient } from '@/api/client';
import type { PagedResult } from '@/types/users.types';
import type {
  HostInvite,
  HostInviteLookup,
  HostInviteQuota,
  HostInviteRequest,
  HostInviteResult,
  HostInvitesParams,
} from '@/types/host-invites';

/** Who calls: the platform admin (all invites) or a host (only their own, with a daily quota). */
export type HostInviteScope = 'admin' | 'host';

const BASE: Record<HostInviteScope, string> = {
  admin: '/admin/host-invites',
  host: '/hosts/me/invitations',
};

export async function createHostInvite(scope: HostInviteScope, payload: HostInviteRequest): Promise<HostInviteResult> {
  return ApiClient.post<HostInviteResult>(BASE[scope], payload);
}

export async function fetchHostInvites(
  scope: HostInviteScope,
  { search, state, page = 1, pageSize = 20 }: HostInvitesParams,
): Promise<PagedResult<HostInvite>> {
  return ApiClient.get<PagedResult<HostInvite>>(BASE[scope], {
    page,
    pageSize,
    ...(search ? { search } : {}),
    ...(state ? { state } : {}),
  });
}

/** Sends an invite again: new link and expiry, the old link stops working. */
export async function resendHostInvite(scope: HostInviteScope, id: string): Promise<HostInviteResult> {
  return ApiClient.post<HostInviteResult>(`${BASE[scope]}/${encodeURIComponent(id)}/resend`);
}

export async function revokeHostInvite(scope: HostInviteScope, id: string): Promise<void> {
  await axios.delete(`${BASE[scope]}/${encodeURIComponent(id)}`);
}

export async function fetchHostInviteQuota(): Promise<HostInviteQuota> {
  return ApiClient.get<HostInviteQuota>(`${BASE.host}/quota`);
}

/** Anonymous: what the link of an invite is worth. The token is a secret of the link: never logged or tracked. */
export async function lookupHostInvite(token: string): Promise<HostInviteLookup> {
  return ApiClient.get<HostInviteLookup>('/host-invites/lookup', { token }, { public: true });
}

/** Signed in: binds the invite to the account (204, no body). */
export async function acceptHostInvite(token: string): Promise<void> {
  await axios.post('/host-invites/accept', { token });
}
