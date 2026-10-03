import { ApiClient } from '@/api/client';
import type {
  FeaturedPropertiesResponse,
  PublicTouristTaxCalculateRequest,
  PublicTouristTaxCalculateResponse,
  SeoEventPayload,
  SeoPagePublic,
  SeoPublishedPages,
} from '@/types/seo.types';

export const PublicSeoApi = {
  /** Published pages for the hub `/p/affitti-brevi` (the same pages as the sitemap). */
  getPublishedPages: (): Promise<SeoPublishedPages> =>
    ApiClient.get<SeoPublishedPages>('/public/content', undefined, { public: true }),

  getComplianceGuide: (region: string, comune: string): Promise<SeoPagePublic> =>
    ApiClient.get<SeoPagePublic>(`/public/content/affitti-brevi/${region}/${comune}`, undefined, {
      public: true,
    }),

  getTouristTaxPage: (comune: string): Promise<SeoPagePublic> =>
    ApiClient.get<SeoPagePublic>(`/public/content/tassa-soggiorno/${comune}`, undefined, { public: true }),

  /** Published, bookable properties of a comune (slug or ISTAT code) for its SEO pages (SE-04, AC2). */
  getFeaturedProperties: (comune: string): Promise<FeaturedPropertiesResponse> =>
    ApiClient.get<FeaturedPropertiesResponse>(
      `/public/seo/${encodeURIComponent(comune)}/featured-properties`,
      undefined,
      { public: true },
    ),

  /** One event of the funnel (AC3). Anonymous; the page does not wait for the answer. */
  trackEvent: (payload: SeoEventPayload): Promise<void> =>
    ApiClient.post<void>('/public/seo/events', payload, { public: true }),

  calculateTouristTax: (
    request: PublicTouristTaxCalculateRequest,
  ): Promise<PublicTouristTaxCalculateResponse> =>
    ApiClient.post<PublicTouristTaxCalculateResponse>('/public/tourist-tax/calculate', request, {
      public: true,
    }),
};
