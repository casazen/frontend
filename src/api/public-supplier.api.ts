import { ApiClient } from './client';

/** What the public page `/fornitori/:slug` shows of a supplier (`GET /api/public/suppliers/{slug}`, SU-13). */
export interface SupplierShowcaseDto {
  /** Null only in the owner's preview of a profile that has no public address yet. */
  slug: string | null;
  legalName: string;
  /** Service category codes (translated by the page). */
  categories: string[];
  /** The comuni by name. */
  comuni: string[];
  bio?: string | null;
  photoUrls: string[];
  /** The next 14 days (Europe/Rome) the supplier saved an availability for. */
  availability: { date: string; available: boolean }[];
}

export const publicSupplierApi = {
  /** Public supplier showcase (`/fornitori/:slug`); anonymous endpoint `GET /api/public/suppliers/{slug}`. */
  getShowcase: (slug: string) =>
    ApiClient.get<SupplierShowcaseDto>(`/public/suppliers/${encodeURIComponent(slug)}`, undefined, {
      public: true,
    }),
};
