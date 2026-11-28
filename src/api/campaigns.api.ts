import { ApiClient } from './client';
import type {
  Campaign,
  CampaignReport,
  ConditionDefinition,
  CreateDraftDto,
  CreateSegmentDto,
  ScheduleCampaignDto,
  Segment,
  SegmentPreviewResult,
  SubmitForApprovalDto,
} from '@/types/campaign.types';

export const campaignsApi = {
  // Segments
  getSegments: () => ApiClient.get<Segment[]>('/campaigns/segments'),

  createSegment: (data: CreateSegmentDto) => ApiClient.post<Segment>('/campaigns/segments', data),

  getSegmentPreview: (segmentId: string, propertyId?: string) =>
    ApiClient.get<SegmentPreviewResult>(`/campaigns/segments/${segmentId}/preview`, propertyId ? {propertyId} : undefined),

  previewCondition: (condition: ConditionDefinition, propertyId?: string) =>
    ApiClient.post<SegmentPreviewResult>('/campaigns/segments/preview', { condition, propertyId }),

  suggestSegment: (brief: string) => ApiClient.post<CreateSegmentDto>('/campaigns/studio/suggest-segment', { brief }),

  // Campaigns
  getCampaigns: () => ApiClient.get<Campaign[]>('/campaigns'),

  getCampaignById: (id: string) => ApiClient.get<Campaign>(`/campaigns/${id}`),

  createDraft: (data: CreateDraftDto) => ApiClient.post<Campaign>('/campaigns', data),

  submitForApproval: (data: SubmitForApprovalDto) => ApiClient.post<void>(`/campaigns/${data.campaignId}/submit`, {}),

  scheduleCampaign: (data: ScheduleCampaignDto) =>
    ApiClient.post<void>(`/campaigns/${data.campaignId}/schedule`, { scheduledAt: data.scheduledAt }),

  getCampaignReport: (campaignId: string) => ApiClient.get<CampaignReport>(`/campaigns/${campaignId}/report`),
};
