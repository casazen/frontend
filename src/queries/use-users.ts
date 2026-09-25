import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UsersApi } from '@/api/users.api';
import { OrgsApi } from '@/api/orgs.api';
import type { RentalType, UpdateProfileRequest, PlanTier, UserDetail, UserRole } from '@/types';
import type { OnboardingConsentsPayload } from '@/types/onboarding.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { isDemoMode } from '@/config/demo.config';
import { getDemoProfile } from '@/lib/demo-profile';

const USERS_KEY = 'users';
// Same key as ME_QUERY_KEY (lib/onboarding-gate), refreshed on a 403 onboarding_required.
const ME_KEY = 'me';

/** Query key for the caller's resolved plan entitlement (#202). Exported so writes can invalidate it. */
export const ENTITLEMENT_QUERY_KEY = ['entitlement'] as const;

interface GetUsersParams {
  page?: number;
  pageSize?: number;
  role?: string;
  isActive?: boolean;
  search?: string;
}

export function useUsers(params?: GetUsersParams) {
  return useQuery({
    queryKey: [USERS_KEY, params],
    queryFn: () => UsersApi.getUsers(params ?? {}),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: [USERS_KEY, id],
    queryFn: () => UsersApi.getUserById(id),
    enabled: !!id,
  });
}

/**
 * Demo mode (A1-18): Playwright mocks `/users/me`, but anywhere else the API rejects the demo token. The profile of
 * the demo persona then stands in for it, so the onboarding guard never loops on an error it cannot fix.
 */
async function fetchMe(): Promise<UserDetail> {
  if (!isDemoMode) return UsersApi.getMe();
  try {
    return await UsersApi.getMe();
  } catch {
    return getDemoProfile();
  }
}

export function useMe() {
  return useQuery({
    queryKey: [ME_KEY],
    queryFn: fetchMe,
    refetchOnMount: 'always',
  });
}

/**
 * Convenience wrapper over {@link useMe} that surfaces the caller's org + plan (#202, AC9/AC11).
 * Returns null org for users with no tenant yet (pre-backfill) so the UI can fail gracefully.
 */
export function useCurrentUser() {
  const query = useMe();
  return {
    ...query,
    user: query.data ?? null,
    org: query.data?.org ?? null,
    planTier: query.data?.org?.planTier ?? null,
  };
}

/** Resolved plan entitlement (limits + usage) for the caller's org (#202, AC8). */
export function useEntitlement() {
  const { org, user } = useCurrentUser();
  return useQuery({
    queryKey: ENTITLEMENT_QUERY_KEY,
    queryFn: () => OrgsApi.getMyEntitlement(),
    // A host endpoint: not asked while the backend withholds the host features (PL-02), e.g. from the admin shell.
    enabled: !!org?.id && user?.onboardingRequired !== true,
    retry: false,
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileRequest) => UsersApi.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ME_KEY] });
      toast.success(i18n.t('toast.profileUpdated'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.profileUpdateFailed'));
    },
  });
}

export function useChangeUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      UsersApi.changeRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      toast.success(i18n.t('toast.roleUpdated'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.roleUpdateFailed'));
    },
  });
}

/** Roles a user currently holds (A1-17), read fresh (not cached) each time the roles dialog opens. */
export function useUserRoles(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [USERS_KEY, id, 'roles'],
    queryFn: () => UsersApi.getRoles(id),
    enabled: enabled && !!id,
  });
}

export function useUpdateUserRoles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: UserRole[] }) => UsersApi.updateRoles(id, roles),
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      queryClient.invalidateQueries({ queryKey: [USERS_KEY, id, 'roles'] });
      toast.success(i18n.t('toast.roleUpdated'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.roleUpdateFailed'));
    },
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: () => OrgsApi.getPlans(),
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rentalType,
      planTier,
      isUpdate,
      consents,
    }: {
      rentalType: RentalType;
      planTier?: PlanTier;
      isUpdate?: boolean;
      consents?: OnboardingConsentsPayload;
    }) =>
      isUpdate
        ? UsersApi.putOnboarding({ rentalType, planTier })
        : UsersApi.postOnboarding({ rentalType, planTier, consents }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ME_KEY] });
      queryClient.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEY });
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => UsersApi.deactivateUser(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      // PL-03: the user is deactivated in CasaZen either way; Auth0 may still have to be updated by a retry.
      if (result?.auth0Synced === false) {
        toast.warning(i18n.t('toast.userDeactivatedAuth0NotSynced'));
      } else {
        toast.success(i18n.t('toast.userDeactivated'));
      }
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.userDeactivateFailed'));
    },
  });
}

export function useReactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => UsersApi.reactivateUser(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      if (result?.auth0Synced === false) {
        toast.warning(i18n.t('toast.userReactivatedAuth0NotSynced'));
      } else {
        toast.success(i18n.t('toast.userReactivated'));
      }
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.userReactivateFailed'));
    },
  });
}
