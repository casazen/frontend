import axios from '@/lib/axios';
import type { AppContextKey } from '@/config/route-manifest';

export interface ContextBootstrapDto {
  contextKey: AppContextKey;
  displayName: string;
  roleKey: string;
  permissions: string[];
  defaultRoute: string;
}

export interface UserContextsResponse {
  userId: string;
  contexts: ContextBootstrapDto[];
  lastUsedContextKey?: AppContextKey | null;
}

export const contextsApi = {
  async getContexts(): Promise<UserContextsResponse> {
    const response = await axios.get<UserContextsResponse>('/me/contexts');
    return response.data;
  },
};
