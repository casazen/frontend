import { create } from 'zustand';
import type { LocalEvent } from '@/api/marketing-studio.api';
import type { GoalId, ToneSteer } from './campaign-goals';

export interface CampaignDraft {
  goalId: GoalId | null;
  propertyId: string;
  segmentId: string;
  recipeId: string | null;
  details: string;
  event: LocalEvent | null;
  skippedEvent: boolean;
  assetId: string | null;
  subject: string;
  body: string;
  steer: ToneSteer | null;
}

export const EMPTY_CAMPAIGN_DRAFT: CampaignDraft = {
  goalId: null,
  propertyId: '',
  segmentId: '',
  recipeId: null,
  details: '',
  event: null,
  skippedEvent: false,
  assetId: null,
  subject: '',
  body: '',
  steer: null,
};

interface Remembered {
  draft: CampaignDraft;
  stepId: string;
  savedAt: number;
}

interface CampaignDraftStore {
  remembered: Remembered | null;
  remember: (draft: CampaignDraft, stepId: string) => void;
  forget: () => void;
}

export const useCampaignDraftStore = create<CampaignDraftStore>((set) => ({
  remembered: null,
  remember: (draft, stepId) => set({ remembered: { draft, stepId, savedAt: Date.now() } }),
  forget: () => set({ remembered: null }),
}));
