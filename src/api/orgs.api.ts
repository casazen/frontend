import axios from '@/lib/axios';
import { ApiClient } from '@/api/client';
import type {
  BrandingImageKind,
  Entitlement,
  OrgBranding,
  OrgSettings,
  OrgSlugAvailability,
  PlanCatalogEntry,
  UpdateOrgBrandingRequest,
  UpdateOrgSettingsRequest,
} from '@/types';

export const OrgsApi = {
  getPlans: (): Promise<PlanCatalogEntry[]> =>
    ApiClient.get<PlanCatalogEntry[]>('/orgs/plans'),

  getMyEntitlement: (): Promise<Entitlement> =>
    ApiClient.get<Entitlement>('/orgs/me/entitlement'),

  /** A1-22, A1-23: name, public slug and contact email opt-in. Org billing admin only. */
  getSettings: (): Promise<OrgSettings> =>
    ApiClient.get<OrgSettings>('/orgs/me/settings'),

  updateSettings: (payload: UpdateOrgSettingsRequest): Promise<OrgSettings> =>
    ApiClient.put<OrgSettings>('/orgs/me/settings', payload),

  /** A1-23: whether a slug can become the org's public address (advisory: the PUT checks again). */
  checkSlugAvailability: (slug: string): Promise<OrgSlugAvailability> =>
    ApiClient.get<OrgSlugAvailability>('/orgs/me/settings/slug-availability', { slug }),

  /** BK-12: public-site branding (logo, hero, color, tagline, theme). Org billing admin only. */
  getBranding: (): Promise<OrgBranding> =>
    ApiClient.get<OrgBranding>('/orgs/me/branding'),

  updateBranding: (payload: UpdateOrgBrandingRequest): Promise<OrgBranding> =>
    ApiClient.put<OrgBranding>('/orgs/me/branding', payload),

  /** Multipart field `file`; the backend checks type, size and pixel dimensions from the bytes. */
  uploadBrandingImage: async (kind: BrandingImageKind, file: File): Promise<OrgBranding> => {
    const formData = new FormData();
    formData.append('file', file);
    // Explicit multipart: the client's default JSON content type would serialize the FormData as JSON.
    const response = await axios.put<OrgBranding>(`/orgs/me/branding/${kind}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  removeBrandingImage: (kind: BrandingImageKind): Promise<OrgBranding> =>
    ApiClient.delete<OrgBranding>(`/orgs/me/branding/${kind}`),
};
