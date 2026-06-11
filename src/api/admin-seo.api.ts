import { ApiClient } from '@/api/client';
import type {
  PlatformAiBudget,
  SeoGenerateAccepted,
  SeoGenerateRequest,
  SeoPageAdmin,
  SeoPagesPagedResult,
  SeoPagesQuery,
  UpdateSeoReviewStatusRequest,
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

  generatePages: (request: SeoGenerateRequest): Promise<SeoGenerateAccepted> =>
    ApiClient.post<SeoGenerateAccepted>('/admin/seo/generate', request),

  updateReviewStatus: (
    pageId: string,
    body: UpdateSeoReviewStatusRequest,
  ): Promise<SeoPageAdmin> =>
    ApiClient.patch<SeoPageAdmin>(`/admin/seo/pages/${pageId}/review-status`, body),

  getBudget: (): Promise<PlatformAiBudget> =>
    ApiClient.get<PlatformAiBudget>('/admin/seo/budget'),
};
