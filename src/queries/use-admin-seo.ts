import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminSeoApi } from '@/api/admin-seo.api';
import type { SeoGenerateRequest, SeoPagesQuery, UpdateSeoReviewStatusRequest } from '@/types/seo.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';

const ADMIN_SEO_KEY = 'admin-seo';

export function useSeoPages(params?: SeoPagesQuery) {
  return useQuery({
    queryKey: [ADMIN_SEO_KEY, 'pages', params],
    queryFn: () => AdminSeoApi.listPages(params),
  });
}

export function useSeoComuni() {
  return useQuery({
    queryKey: [ADMIN_SEO_KEY, 'comuni'],
    queryFn: () => AdminSeoApi.listComuni(),
  });
}

export function useApproveAllSeoDrafts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (counselApproved?: boolean) =>
      AdminSeoApi.approveAllDrafts(counselApproved ?? true),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_SEO_KEY] });
      toast.success(i18n.t('toast.seoApproved', { count: result.approvedCount }));
    },
    onError: () => {
      toast.error(i18n.t('toast.seoApproveFailed'));
    },
  });
}

export function usePlatformAiBudget() {
  return useQuery({
    queryKey: [ADMIN_SEO_KEY, 'budget'],
    queryFn: () => AdminSeoApi.getBudget(),
  });
}

export function useGenerateSeoPages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: SeoGenerateRequest) => AdminSeoApi.generatePages(request),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_SEO_KEY] });
      toast.success(i18n.t('toast.seoGenerated', { jobId: result.jobId, estimatedPages: result.estimatedPages }));
    },
    onError: () => {
      toast.error(i18n.t('toast.seoGenerateFailed'));
    },
  });
}

export function useUpdateSeoReviewStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      pageId,
      body,
    }: {
      pageId: string;
      body: UpdateSeoReviewStatusRequest;
    }) => AdminSeoApi.updateReviewStatus(pageId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_SEO_KEY] });
      toast.success(i18n.t('toast.seoReviewUpdated'));
    },
    onError: () => {
      toast.error(i18n.t('toast.seoReviewUpdateFailed'));
    },
  });
}
