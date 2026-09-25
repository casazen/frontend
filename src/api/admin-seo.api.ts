import { ApiClient } from '@/api/client';
import type {
  ApproveSeoRevisionRequest,
  PlatformAiBudget,
  SeoComuneRegistryItem,
  SeoGenerateAccepted,
  SeoGenerateRequest,
  SeoPageAdmin,
  SeoPageAdminDetail,
  SeoPagesPagedResult,
  SeoPagesQuery,
  WithdrawSeoPageRequest,
} from '@/types/seo.types';

interface BackendPagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export const AdminSeoApi = {
  listPages: (params?: SeoPagesQuery): Promise<SeoPagesPagedResult> =>
    ApiClient.get<BackendPagedResult<SeoPageAdmin>>('/admin/seo/pages', params).then((res) => ({
      items: res.items ?? [],
      totalCount: res.totalCount ?? 0,
      page: res.page ?? 1,
      pageSize: res.pageSize ?? 20,
    })),

  /** Review screen: published and pending text (sanitized) and the review audit. */
  getPage: (pageId: string): Promise<SeoPageAdminDetail> =>
    ApiClient.get<SeoPageAdminDetail>(`/admin/seo/pages/${pageId}`),

  generatePages: (request: SeoGenerateRequest): Promise<SeoGenerateAccepted> =>
    ApiClient.post<SeoGenerateAccepted>('/admin/seo/generate', request),

  approveRevision: (pageId: string, body: ApproveSeoRevisionRequest): Promise<SeoPageAdmin> =>
    ApiClient.post<SeoPageAdmin>(`/admin/seo/pages/${pageId}/approve`, body),

  withdrawPage: (pageId: string, body: WithdrawSeoPageRequest): Promise<SeoPageAdmin> =>
    ApiClient.post<SeoPageAdmin>(`/admin/seo/pages/${pageId}/withdraw`, body),

  getBudget: (): Promise<PlatformAiBudget> =>
    ApiClient.get<PlatformAiBudget>('/admin/seo/budget'),

  listComuni: (): Promise<SeoComuneRegistryItem[]> =>
    ApiClient.get<SeoComuneRegistryItem[]>('/admin/seo/comuni'),
};
