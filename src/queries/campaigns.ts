import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { campaignsApi } from '@/api/campaigns.api';
import type {
  CreateDraftDto,
  CreateSegmentDto,
  GenerateContentRequest,
  ScheduleCampaignDto,
  SubmitForApprovalDto,
} from '@/types/campaign.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';

const SEGMENTS_KEY = 'segments';
const CAMPAIGNS_KEY = 'campaigns';
const FIELDS_KEY = 'campaign-fields';

// Segments
export function useSegments() {
  return useQuery({
    queryKey: [SEGMENTS_KEY],
    queryFn: () => campaignsApi.getSegments(),
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
      toast.error(getProblemMessage(error, i18n.t('campaigns.segment.createError')));
    },
  });
}

export function usePreviewCount(segmentId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: [SEGMENTS_KEY, segmentId, 'preview'],
    queryFn: () => campaignsApi.getSegmentPreview(segmentId),
    enabled: enabled && !!segmentId,
  });
}

// Field catalog
export function useFields() {
  return useQuery({
    queryKey: [FIELDS_KEY],
    queryFn: () => campaignsApi.getFields(),
  });
}

// Campaigns
export function useCampaigns() {
  return useQuery({
    queryKey: [CAMPAIGNS_KEY],
    queryFn: () => campaignsApi.getCampaigns(),
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: [CAMPAIGNS_KEY, id],
    queryFn: () => campaignsApi.getCampaignById(id),
    enabled: !!id,
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
      toast.error(getProblemMessage(error, i18n.t('campaigns.draft.createError')));
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
      toast.error(getProblemMessage(error, i18n.t('campaigns.approval.submitError')));
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
      toast.error(getProblemMessage(error, i18n.t('campaigns.schedule.scheduleError')));
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

export function useGenerateContent() {
  return useMutation({
    mutationFn: (data: GenerateContentRequest) => campaignsApi.generateContent(data),
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t('campaigns.generate.error')));
    },
  });
}
