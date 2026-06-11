import { ApiClient } from '@/api/client';
import type {
  PublicTouristTaxCalculateRequest,
  PublicTouristTaxCalculateResponse,
  SeoPagePublic,
} from '@/types/seo.types';

export const PublicSeoApi = {
  getComplianceGuide: (region: string, comune: string): Promise<SeoPagePublic> =>
    ApiClient.get<SeoPagePublic>(`/public/content/affitti-brevi/${region}/${comune}`),

  getTouristTaxPage: (comune: string): Promise<SeoPagePublic> =>
    ApiClient.get<SeoPagePublic>(`/public/content/tassa-soggiorno/${comune}`),

  calculateTouristTax: (
    request: PublicTouristTaxCalculateRequest,
  ): Promise<PublicTouristTaxCalculateResponse> =>
    ApiClient.post<PublicTouristTaxCalculateResponse>('/public/tourist-tax/calculate', request),
};
