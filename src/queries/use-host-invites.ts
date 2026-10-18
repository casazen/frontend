import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createHostInvite,
  fetchHostInviteQuota,
  fetchHostInvites,
  lookupHostInvite,
  resendHostInvite,
  revokeHostInvite,
  type HostInviteScope,
} from '@/api/host-invites.api';
import type { HostInviteRequest, HostInvitesParams } from '@/types/host-invites';

const KEY = ['host-invites'] as const;

/** A page of the host invites of the scope (admin: all, host: own), filtered and paginated by the server. */
export function useHostInvites(scope: HostInviteScope, params: HostInvitesParams) {
  return useQuery({
    queryKey: [...KEY, scope, 'list', params],
    queryFn: () => fetchHostInvites(scope, params),
  });
}

export function useHostInviteQuota() {
  return useQuery({ queryKey: [...KEY, 'quota'], queryFn: fetchHostInviteQuota });
}

/** A new, resent or revoked invite changes the list and the quota. */
function useInvalidateHostInvites() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: KEY });
}

export function useCreateHostInvite(scope: HostInviteScope) {
  const invalidate = useInvalidateHostInvites();
  return useMutation({
    mutationFn: (payload: HostInviteRequest) => createHostInvite(scope, payload),
    onSuccess: invalidate,
    // A refused invite (quota, taken email) can change the quota shown.
    onError: invalidate,
  });
}

export function useResendHostInvite(scope: HostInviteScope) {
  const invalidate = useInvalidateHostInvites();
  return useMutation({ mutationFn: (id: string) => resendHostInvite(scope, id), onSuccess: invalidate });
}

export function useRevokeHostInvite(scope: HostInviteScope) {
  const invalidate = useInvalidateHostInvites();
  return useMutation({ mutationFn: (id: string) => revokeHostInvite(scope, id), onSuccess: invalidate });
}

/** Lookup of the link of an invite (anonymous); `token` empty disables it. No retry: an answer is final. */
export function useHostInviteLookup(token: string) {
  return useQuery({
    queryKey: [...KEY, 'lookup', token],
    queryFn: () => lookupHostInvite(token),
    enabled: token.length > 0,
    retry: false,
    staleTime: Infinity,
  });
}
