import { ApiClient } from './client';
import type {
  Campaign,
  CampaignReport,
  CreateDraftDto,
  CreateSegmentDto,
  FieldDefinition,
  ScheduleCampaignDto,
  Segment,
  SegmentPreviewResult,
  SubmitForApprovalDto,
} from '@/types/campaign.types';

export const campaignsApi = {
  // Segments
  getSegments: () => ApiClient.get<Segment[]>('/campaigns/segments'),

  createSegment: (data: CreateSegmentDto) => ApiClient.post<Segment>('/campaigns/segments', data),

  getSegmentPreview: (segmentId: string) =>
    ApiClient.get<SegmentPreviewResult>(`/campaigns/segments/${segmentId}/preview`),

  // Field catalog
  getFields: () => ApiClient.get<FieldDefinition[]>('/campaigns/fields'),

  // Campaigns
  getCampaigns: () => ApiClient.get<Campaign[]>('/campaigns'),

  getCampaignById: (id: string) => ApiClient.get<Campaign>(`/campaigns/${id}`),

  createDraft: (data: CreateDraftDto) => ApiClient.post<Campaign>('/campaigns', data),

  submitForApproval: (data: SubmitForApprovalDto) => ApiClient.post<void>(`/campaigns/${data.campaignId}/submit`, {}),

  scheduleCampaign: (data: ScheduleCampaignDto) =>
    ApiClient.post<void>(`/campaigns/${data.campaignId}/schedule`, { scheduledAt: data.scheduledAt }),

  getCampaignReport: (campaignId: string) => ApiClient.get<CampaignReport>(`/campaigns/${campaignId}/report`),
};
