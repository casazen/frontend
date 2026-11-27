import type { ListingLanguage, ListingTexts } from '@/types';
import { ApiClient } from './client';

const SUGGESTION_TIMEOUT_MS = 95_000;

export interface ListingTextBasis {
  photos: number;
  comune: string | null;
  province: string | null;
  region: string | null;
  similarListings: number;
  amenities: number;
}

export type ListingTextFallbackReason = 'ai_not_configured' | 'ai_budget_exhausted' | 'ai_unavailable' | 'ai_invalid_answer';

export interface ListingTextSuggestion {
  aiUsed: boolean;
  reason: ListingTextFallbackReason | null;
  title: string | null;
  description: string | null;
  basedOn: ListingTextBasis;
  fields?: ListingTexts | null;
}

export const listingTextApi = {
  suggestFields: (propertyId: string, body: { photos: string[]; regenerate: boolean; language: ListingLanguage }, signal?: AbortSignal) =>
    ApiClient.post<ListingTextSuggestion>(`/properties/${propertyId}/listing-text/fields-suggestion`, body, { timeout: SUGGESTION_TIMEOUT_MS, signal }),
  suggest: (propertyId: string, body: { photos: string[]; regenerate: boolean }) =>
    ApiClient.post<ListingTextSuggestion>(`/properties/${propertyId}/listing-text/suggestion`, body, {
      timeout: SUGGESTION_TIMEOUT_MS,
    }),
};
