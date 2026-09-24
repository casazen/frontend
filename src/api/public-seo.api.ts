import { ApiClient } from '@/api/client';
import type {
  PublicTouristTaxCalculateRequest,
  PublicTouristTaxCalculateResponse,
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

  calculateTouristTax: (
    request: PublicTouristTaxCalculateRequest,
  ): Promise<PublicTouristTaxCalculateResponse> =>
    ApiClient.post<PublicTouristTaxCalculateResponse>('/public/tourist-tax/calculate', request, {
      public: true,
    }),
};
