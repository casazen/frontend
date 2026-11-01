import { ApiClient } from './client';

/** The AI reads photos and writes a long text: it may take 20-30 seconds, more than the default 30 s of the client on a slow line. */
const SUGGESTION_TIMEOUT_MS = 95_000;

/** What a suggestion was written from (backend `ListingTextBasis`): the line «Basato su: …» under the text. */
export interface ListingTextBasis {
  /** Photos the AI looked at: 0 when none was sent or the provider reads text only. */
  photos: number;
  comune: string | null;
  /** Plate code of the province (`CO`). */
  province: string | null;
  region: string | null;
  /** Listings published on CasaZen in the same comune that the AI compared. */
  similarListings: number;
  /** Amenities of the property the AI was told about. */
  amenities: number;
}

/** Why the AI wrote nothing: the wizard then composes the text from the data, as before. */
export type ListingTextFallbackReason = 'ai_not_configured' | 'ai_budget_exhausted' | 'ai_unavailable' | 'ai_invalid_answer';

/** `POST /api/properties/{id}/listing-text/suggestion`. */
export interface ListingTextSuggestion {
  aiUsed: boolean;
  reason: ListingTextFallbackReason | null;
  /** At most 60 characters; `null` without the AI. */
  title: string | null;
  /** At most 2,000 characters, paragraphs separated by a blank line; `null` without the AI. */
  description: string | null;
  basedOn: ListingTextBasis;
}

/**
 * «Suggerisci un testo» of the wizard: the AI writes the headline and the description of the listing from the photos (reduced in the
 * browser, cover first), the comune and the data of the property. Nothing is saved: the host keeps or changes the text and saves the step.
 */
export const listingTextApi = {
  suggest: (propertyId: string, body: { photos: string[]; regenerate: boolean }) =>
    ApiClient.post<ListingTextSuggestion>(`/properties/${propertyId}/listing-text/suggestion`, body, {
      timeout: SUGGESTION_TIMEOUT_MS,
    }),
};
