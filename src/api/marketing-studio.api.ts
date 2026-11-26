import { ApiClient } from './client';

export const marketingChannels = [
  'email',
  'newsletter',
  'instagram',
  'facebook',
  'linkedin',
  'google-ads',
  'meta-ads',
  'linkedin-ads',
  'microsoft-ads',
  'chatgpt-ads',
] as const;
export type MarketingChannel = (typeof marketingChannels)[number];

export interface NewsletterSettings {
  segmentId: string | null;
  propertyId: string | null;
  cadenceDays: number;
  instructions: string;
  enabled: boolean;
}

export interface MarketingSettings {
  canEdit?: boolean;
  voice: string;
  propertyNotes: Record<string, string>;
  propertyUrls: Record<string, string>;
  monthlyEmailLimit: number;
  loyalStays: number;
  lostMonths: number;
  newsletter: NewsletterSettings;
}

export interface LocalEvent {
  name: string;
  date: string;
  source: string;
  description: string;
  confidence?: string;
}

export interface ContentBrief {
  propertyId: string;
  segmentId: string;
  channel: MarketingChannel;
  brief: string;
  eventName?: string;
  sourceEvent?: LocalEvent;
}

export interface GeneratedContent {
  subject: string;
  body: string;
  id: string;
  propertyId: string;
  segmentId: string;
  channel: MarketingChannel;
  approvedAt: string | null;
  trackingUrl: string | null;
  createdAt: string;
  campaignId?: string | null;
  sourceEvent?: LocalEvent | null;
  keywords: string;
  audience: string;
  budget: string;
}

export interface ImportPreview {
  headers: string[];
  sample: string[][];
  totalRows: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

const studio = '/campaigns/studio';
export const assetQueryKey = ['marketing-assets'];
export const saveAssetDraft = (asset: {id:string; subject:string; body:string}) =>
  ApiClient.post<{id:string}>(studio + '/assets/' + asset.id + '/draft', {subject:asset.subject, body:asset.body});
export const marketingStudioApi = {
  settings: () => ApiClient.get<MarketingSettings>(studio + '/settings'),
  saveSettings: (value: MarketingSettings) => ApiClient.put<void>(studio + '/settings', value),
  events: (propertyId: string, from: string, to: string) =>
    ApiClient.post<LocalEvent[]>(studio + '/events', { propertyId, from, to }, { timeout: 120000 }),
  generate: (brief: ContentBrief) => ApiClient.post<GeneratedContent>(studio + '/generate', brief, { timeout: 120000 }),
  previewImport: (file: File) => {
    const data = new FormData();
    data.append('file', file);
    return ApiClient.post<ImportPreview>('/marketing/import/preview', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importGuests: (file: File, mapping: Record<string, number>, propertyId: string, basis: string, source: string) => {
    const data = new FormData();
    data.append('file', file);
    data.append('mapping', JSON.stringify(mapping));
    data.append('propertyId', propertyId);
    data.append('basis', basis);
    data.append('source', source);
    return ApiClient.post<ImportResult>('/marketing/import', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
