import { ApiClient } from '@/api/client';
import type { UserDetail, UserSummary, UpdateProfileRequest, ChangeRoleRequest, PagedResult } from '@/types';

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
    ApiClient.get<BackendPagedResult<UserSummary>>('/users', params as Record<string, unknown>).then(
      (res) => ({
        items: res.items ?? [],
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

  deactivateUser: (id: string): Promise<void> =>
    ApiClient.delete<void>(`/users/${id}`),
};
