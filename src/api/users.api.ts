import { ApiClient } from '@/api/client';
import { normalizeUserSummary } from '@/lib/api-normalize';
import type {
  UserDetail,
  UserSummary,
  UpdateProfileRequest,
  ChangeRoleRequest,
  PagedResult,
  OnboardingRequest,
  OnboardingResponse,
  UserActivationResponse,
  UserRole,
  UserRolesResponse,
  SignupAttribution,
  SignupAttributionResult,
} from '@/types';

interface GetUsersParams {
  page?: number;
  pageSize?: number;
  role?: string;
  isActive?: boolean;
  search?: string;
}

// Backend returns our PagedResultDto<T> directly (not wrapped in the standard PaginatedResponse shape)
interface BackendPagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export const UsersApi = {
  getUsers: (params: GetUsersParams): Promise<PagedResult<UserSummary>> =>
    ApiClient.get<BackendPagedResult<Record<string, unknown>>>('/users', params as Record<string, unknown>).then(
      (res) => ({
        items: (res.items ?? []).map(normalizeUserSummary),
        totalCount: res.totalCount ?? 0,
        page: res.page ?? 1,
        pageSize: res.pageSize ?? 20,
      })
    ),

  getUserById: (id: string): Promise<UserDetail> =>
    ApiClient.get<UserDetail>(`/users/${id}`),

  getMe: (): Promise<UserDetail> =>
    ApiClient.get<UserDetail>('/users/me'),

  updateMe: (body: UpdateProfileRequest): Promise<UserDetail> =>
    ApiClient.put<UserDetail>('/users/me', body),

  changeRole: (id: string, role: string): Promise<{ id: string; role: string }> =>
    ApiClient.put<{ id: string; role: string }>(`/users/${id}/role`, { role } as ChangeRoleRequest),

  /** Roles the user currently holds, restricted to the ones an admin can manage (A1-17). */
  getRoles: (id: string): Promise<UserRolesResponse> =>
    ApiClient.get<UserRolesResponse>(`/users/${encodeURIComponent(id)}/roles`),

  /** Sets the user's exact admin-manageable role set (A1-17): grants and revokes the difference. */
  updateRoles: (id: string, roles: UserRole[]): Promise<UserRolesResponse> =>
    ApiClient.put<UserRolesResponse>(`/users/${encodeURIComponent(id)}/roles`, { roles }),

  deactivateUser: (id: string): Promise<UserActivationResponse> =>
    ApiClient.delete<UserActivationResponse>(`/users/${encodeURIComponent(id)}`),

  reactivateUser: (id: string): Promise<UserActivationResponse> =>
    ApiClient.post<UserActivationResponse>(`/users/${encodeURIComponent(id)}/reactivate`),

  postOnboarding: (body: OnboardingRequest): Promise<OnboardingResponse> =>
    ApiClient.post<OnboardingResponse>('/users/onboarding', body),

  putOnboarding: (body: OnboardingRequest): Promise<OnboardingResponse> =>
    ApiClient.put<OnboardingResponse>('/users/onboarding', body),

  /** SE-03: where the signup came from, sent once after the first onboarding (the backend keeps the first one). */
  recordSignupAttribution: (body: SignupAttribution): Promise<SignupAttributionResult> =>
    ApiClient.post<SignupAttributionResult>('/users/me/signup-attribution', body),
};
