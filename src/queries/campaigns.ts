import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { campaignsApi } from '@/api/campaigns.api';
import type {
  ConditionDefinition,
  CreateDraftDto,
  CreateSegmentDto,
  ScheduleCampaignDto,
  SubmitForApprovalDto,
} from '@/types/campaign.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';

const SEGMENTS_KEY = 'segments';
const CAMPAIGNS_KEY = 'campaigns';
const FIELDS_KEY = 'campaign-fields';

export function useSegments(enabled = true) {
  return useQuery({
    queryKey: [SEGMENTS_KEY],
    queryFn: () => campaignsApi.getSegments(),
    enabled,
  });
}

export function useCreateSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSegmentDto) => campaignsApi.createSegment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SEGMENTS_KEY] });
      toast.success(i18n.t('campaigns.segment.created'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('campaigns.segment.createError'));
    },
  });
}

export function usePreviewCount(segmentId: string, propertyId?: string) {
  return useQuery({
    queryKey: [SEGMENTS_KEY, segmentId, 'preview', propertyId ?? null],
    queryFn: () => campaignsApi.getSegmentPreview(segmentId, propertyId),
    enabled: !!segmentId,
  });
}

export function usePreviewCondition(condition: ConditionDefinition | null, propertyId?: string) {
  return useQuery({
    queryKey: [SEGMENTS_KEY, 'preview-condition', condition, propertyId ?? null],
    queryFn: () => campaignsApi.previewCondition(condition as ConditionDefinition, propertyId),
    enabled: condition !== null,
    retry: false,
    staleTime: 30_000,
  });
}

export function useFields() {
  return useQuery({
    queryKey: [FIELDS_KEY],
    queryFn: () => campaignsApi.getFields(),
  });
}

export function useCampaigns(enabled = true) {
  return useQuery({
    queryKey: [CAMPAIGNS_KEY],
    queryFn: () => campaignsApi.getCampaigns(),
    enabled,
    refetchOnMount: 'always',
    refetchInterval: (query) =>
      query.state.data?.some((c) => c.status === 'PendingApproval' || c.status === 'Scheduled') ? 15000 : false,
  });
}

export function useCreateDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDraftDto) => campaignsApi.createDraft(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CAMPAIGNS_KEY] });
      toast.success(i18n.t('campaigns.draft.created'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('campaigns.draft.createError'));
    },
  });
}

export function useSubmitForApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SubmitForApprovalDto) => campaignsApi.submitForApproval(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CAMPAIGNS_KEY] });
      toast.success(i18n.t('campaigns.approval.submitted'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('campaigns.approval.submitError'));
    },
  });
}

export function useScheduleCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ScheduleCampaignDto) => campaignsApi.scheduleCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CAMPAIGNS_KEY] });
      toast.success(i18n.t('campaigns.schedule.scheduled'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('campaigns.schedule.scheduleError'));
    },
  });
}

export function useCampaignReport(campaignId: string) {
  return useQuery({
    queryKey: [CAMPAIGNS_KEY, campaignId, 'report'],
    queryFn: () => campaignsApi.getCampaignReport(campaignId),
    enabled: !!campaignId,
  });
}
