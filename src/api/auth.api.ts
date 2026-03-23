import { ApiClient } from './client';
import type { User } from '@/types';

export const authApi = {
  getProfile: () => ApiClient.get<User>('/auth/profile'),

  logout: () => ApiClient.post<void>('/auth/logout'),
};
