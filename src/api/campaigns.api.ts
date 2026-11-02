import { ApiClient } from './client';
import type {
  Campaign,
  CampaignReport,
  CreateDraftDto,
  CreateSegmentDto,
  FieldDefinition,
  GenerateContentRequest,
  GenerateContentResponse,
  ScheduleCampaignDto,
  Segment,
  SegmentPreviewResult,
  SubmitForApprovalDto,
} from '@/types/campaign.types';

export const campaignsApi = {
  // Segments
  getSegments: () => ApiClient.get<Segment[]>('/campaigns/segments'),

  createSegment: (data: CreateSegmentDto) =>
    ApiClient.post<Segment>('/campaigns/segments', data),

  getSegmentPreview: (segmentId: string) =>
    ApiClient.get<SegmentPreviewResult>(`/campaigns/segments/${segmentId}/preview`),

  // Field catalog
  getFields: () => ApiClient.get<FieldDefinition[]>('/campaigns/fields'),

  // Campaigns
  getCampaigns: () => ApiClient.get<Campaign[]>('/campaigns'),

  getCampaignById: (id: string) => ApiClient.get<Campaign>(`/campaigns/${id}`),

  createDraft: (data: CreateDraftDto) =>
    ApiClient.post<Campaign>('/campaigns/draft', data),

  submitForApproval: (data: SubmitForApprovalDto) =>
    ApiClient.post<Campaign>('/campaigns/submit-for-approval', data),

  scheduleCampaign: (data: ScheduleCampaignDto) =>
    ApiClient.post<Campaign>('/campaigns/schedule', data),

  getCampaignReport: (campaignId: string) =>
    ApiClient.get<CampaignReport>(`/campaigns/${campaignId}/report`),

  // AI generation (NF-08 integration)
  generateContent: (data: GenerateContentRequest) =>
    ApiClient.post<GenerateContentResponse>('/campaigns/generate-content', data),
};
