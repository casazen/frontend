import { ApiClient } from '@/api/client';
import { normalizeUserDetail, normalizeUserSummary } from '@/api/users.mapper';
import type {
  UserDetail,
  UserSummary,
  UpdateProfileRequest,
  ChangeRoleRequest,
  ChangeRolesRequest,
  PagedResult,
  RentalType,
  OnboardingResponse,
  UserRole,
} from '@/types';

interface GetUsersParams {
  page?: number;
  pageSize?: number;
  role?: string;
  isActive?: boolean;
  search?: string;
}

interface BackendPagedResult<T> {
  items?: T[];
  Items?: T[];
  totalCount?: number;
  TotalCount?: number;
  page?: number;
  Page?: number;
  pageSize?: number;
  PageSize?: number;
}

function normalizePagedUsers(res: BackendPagedResult<Record<string, unknown>>): PagedResult<UserSummary> {
  const items = res.items ?? res.Items ?? [];
  return {
    items: items.map((item) => normalizeUserSummary(item)),
    totalCount: res.totalCount ?? res.TotalCount ?? 0,
    page: res.page ?? res.Page ?? 1,
    pageSize: res.pageSize ?? res.PageSize ?? 20,
  };
}

export const UsersApi = {
  getUsers: (params: GetUsersParams): Promise<PagedResult<UserSummary>> =>
    ApiClient.get<BackendPagedResult<Record<string, unknown>>>('/users', params as Record<string, unknown>).then(
      normalizePagedUsers,
    ),

  getUserById: (id: string): Promise<UserDetail> =>
    ApiClient.get<Record<string, unknown>>(`/users/${id}`).then(normalizeUserDetail),

  getMe: (): Promise<UserDetail> =>
    ApiClient.get<Record<string, unknown>>('/users/me').then(normalizeUserDetail),

  updateMe: (body: UpdateProfileRequest): Promise<UserDetail> =>
    ApiClient.put<Record<string, unknown>>('/users/me', body).then(normalizeUserDetail),

  changeRole: (id: string, role: string): Promise<{ id: string; role: string }> =>
    ApiClient.put<{ id: string; role: string }>(`/users/${id}/role`, { role } as ChangeRoleRequest),

  changeRoles: (id: string, roles: UserRole[]): Promise<{ id: string; rolesAssigned: string[] }> =>
    ApiClient.put<{ id: string; rolesAssigned: string[] }>(
      `/users/${id}/roles`,
      { roles } satisfies ChangeRolesRequest,
    ),

  deactivateUser: (id: string): Promise<void> =>
    ApiClient.delete<void>(`/users/${id}`),

  postOnboarding: (rentalType: RentalType): Promise<OnboardingResponse> =>
    ApiClient.post<OnboardingResponse>('/users/onboarding', { rentalType }),

  putOnboarding: (rentalType: RentalType): Promise<OnboardingResponse> =>
    ApiClient.put<OnboardingResponse>('/users/onboarding', { rentalType }),
};
