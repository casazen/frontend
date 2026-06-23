import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UsersApi } from '@/api/users.api';
import { OrgsApi } from '@/api/orgs.api';
import type { RentalType, UpdateProfileRequest, PlanTier } from '@/types';
import type { OnboardingConsentsPayload } from '@/types/onboarding.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';

const USERS_KEY = 'users';
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

export function useMe() {
  return useQuery({
    queryKey: [ME_KEY],
    queryFn: () => UsersApi.getMe(),
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
  const { org } = useCurrentUser();
  return useQuery({
    queryKey: ENTITLEMENT_QUERY_KEY,
    queryFn: () => OrgsApi.getMyEntitlement(),
    enabled: !!org?.id,
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
    onError: () => {
      toast.error(i18n.t('toast.profileUpdateFailed'));
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
    onError: () => {
      toast.error(i18n.t('toast.roleUpdateFailed'));
    },
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: () => OrgsApi.getPlans(),
  });
}

export function useUpdateMyPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planTier: PlanTier) => OrgsApi.updateMyPlan(planTier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ME_KEY] });
      queryClient.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEY });
      toast.success(i18n.t('toast.planUpdated'));
    },
    onError: () => {
      toast.error(i18n.t('toast.planUpdateFailed'));
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      toast.success(i18n.t('toast.userDeactivated'));
    },
    onError: () => {
      toast.error(i18n.t('toast.userDeactivateFailed'));
    },
  });
}
