import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UsersApi } from '@/api/users.api';
import { OrgsApi } from '@/api/orgs.api';
import type { RentalType, PlanTier, UserDetail, UserRole } from '@/types';
import type { OnboardingConsentsPayload } from '@/types/onboarding.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { isDemoMode } from '@/config/demo.config';
import { getDemoProfile } from '@/lib/demo-profile';

const USERS_KEY = 'users';
const ME_KEY = 'me';

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

export function useCurrentUser() {
  const query = useMe();
  return {
    ...query,
    user: query.data ?? null,
    org: query.data?.org ?? null,
    planTier: query.data?.org?.planTier ?? null,
  };
}

export function useEntitlement(enabled = true) {
  const { org, user } = useCurrentUser();
  return useQuery({
    queryKey: ENTITLEMENT_QUERY_KEY,
    queryFn: () => OrgsApi.getMyEntitlement(),
    enabled: enabled && !!org?.id && user?.onboardingRequired !== true,
    retry: false,
  });
}

export function useUserRoles(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [USERS_KEY, id, 'roles'],
    queryFn: () => UsersApi.getRoles(id),
    enabled: enabled && !!id,
    // Overrides the global 5-minute staleTime: an out-of-band change (Auth0 dashboard, onboarding, supplier claim)
    // must show up the next time the dialog opens, or saving would silently revert it.
    staleTime: 0,
    refetchOnMount: 'always',
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

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => UsersApi.deleteRegisteredUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      toast.success(i18n.t('toast.userRemoved'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.userRemoveFailed'));
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
