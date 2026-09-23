import { ApiClient } from './client';

export interface SupplierShowcaseDto {
  slug: string;
  legalName: string;
  categories: string[];
  comuni: string[];
  bio?: string;
  photoUrls: string[];
  availability: { date: string; available: boolean }[];
}

export const publicSupplierApi = {
  /** Public supplier showcase (`/s/:slug`); anonymous endpoint `GET /api/public/suppliers/{slug}`. */
  getShowcase: (slug: string) =>
    ApiClient.get<SupplierShowcaseDto>(`/public/suppliers/${encodeURIComponent(slug)}`, undefined, {
      public: true,
    }),
};
