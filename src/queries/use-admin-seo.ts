import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminSeoApi } from '@/api/admin-seo.api';
import type { SeoGenerateRequest, SeoPagesQuery, UpdateSeoReviewStatusRequest } from '@/types/seo.types';
import { toast } from 'sonner';

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
      toast.success(`${result.approvedCount} pagine approvate`);
    },
    onError: () => {
      toast.error('Impossibile approvare le bozze SEO');
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
      toast.success(`Job ${result.jobId} accodato (${result.estimatedPages} pagine stimate)`);
    },
    onError: () => {
      toast.error('Impossibile avviare la rigenerazione SEO');
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
      toast.success('Stato revisione aggiornato');
    },
    onError: () => {
      toast.error('Impossibile aggiornare lo stato revisione');
    },
  });
}
