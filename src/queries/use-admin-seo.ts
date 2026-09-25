import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminSeoApi } from '@/api/admin-seo.api';
import type {
  ApproveSeoRevisionRequest,
  SeoGenerateRequest,
  SeoPagesQuery,
  WithdrawSeoPageRequest,
} from '@/types/seo.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';

const ADMIN_SEO_KEY = 'admin-seo';

/** Server-side paginated list; the previous page stays on screen while the next one loads. */
export function useSeoPages(params?: SeoPagesQuery) {
  return useQuery({
    queryKey: [ADMIN_SEO_KEY, 'pages', params],
    queryFn: () => AdminSeoApi.listPages(params),
    placeholderData: keepPreviousData,
  });
}

/** Review screen of one page; disabled while no page is selected. */
export function useSeoPageDetail(pageId: string | null) {
  return useQuery({
    queryKey: [ADMIN_SEO_KEY, 'page', pageId],
    queryFn: () => AdminSeoApi.getPage(pageId as string),
    enabled: pageId !== null,
  });
}

export function useSeoComuni() {
  return useQuery({
    queryKey: [ADMIN_SEO_KEY, 'comuni'],
    queryFn: () => AdminSeoApi.listComuni(),
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
      toast.success(i18n.t('toast.seoGenerated', { estimatedPages: result.estimatedPages }));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.seoGenerateFailed'));
    },
  });
}

export function useApproveSeoRevision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ pageId, body }: { pageId: string; body: ApproveSeoRevisionRequest }) =>
      AdminSeoApi.approveRevision(pageId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_SEO_KEY] });
      toast.success(i18n.t('toast.seoRevisionApproved'));
    },
    onError: (error) => {
      // A newer revision (409) or a refused one (422): reload what the admin sees.
      queryClient.invalidateQueries({ queryKey: [ADMIN_SEO_KEY] });
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.seoRevisionApproveFailed'));
    },
  });
}

export function useWithdrawSeoPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ pageId, body }: { pageId: string; body: WithdrawSeoPageRequest }) =>
      AdminSeoApi.withdrawPage(pageId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_SEO_KEY] });
      toast.success(i18n.t('toast.seoPageWithdrawn'));
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_SEO_KEY] });
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.seoPageWithdrawFailed'));
    },
  });
}
