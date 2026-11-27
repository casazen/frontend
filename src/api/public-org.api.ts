import { ApiClient } from './client';
import type {
  HostContactPayload,
  OrgSiteDocumentKind,
  PublicCalendarDto,
  PublicOrgDocument,
  PublicOrgDto,
  PublicPropertyDetailDto,
  PublicPropertyDto,
} from '@/types';

export const publicOrgApi = {
  getPublicOrg: (slug: string) =>
    ApiClient.get<PublicOrgDto>(`/public/orgs/${slug}`, undefined, { public: true }),

  getOrgProperties: (slug: string) =>
    ApiClient.get<PublicPropertyDto[]>(`/public/orgs/${slug}/properties`, undefined, { public: true }),

  getOrgProperty: (slug: string, propertyId: string) =>
    ApiClient.get<PublicPropertyDetailDto>(`/public/orgs/${slug}/properties/${propertyId}`, undefined, {
      public: true,
    }),

  getOrgPropertyCalendar: (slug: string, propertySlugOrId: string, from?: string, to?: string) =>
    ApiClient.get<PublicCalendarDto>(
      `/public/orgs/${encodeURIComponent(slug)}/properties/${encodeURIComponent(propertySlugOrId)}/calendar`,
      { from, to },
      { public: true },
    ),

  getOrgDocument: (slug: string, kind: OrgSiteDocumentKind) =>
    ApiClient.get<PublicOrgDocument>(`/public/orgs/${slug}/documents/${kind}`, undefined, { public: true }),

  /**
   * DB-03b "Scrivi a {host}": a visitor with no booking writes a few lines to the host, who gets them by email and answers from their
   * mailbox. 202 with no body once taken in (the same whatever the site publishes: it never says whether the message reached anybody);
   * 400 for a body that breaks the rules (`host_contact_email_invalid`, `host_contact_message_invalid`, `host_contact_consent_required`),
   * 404 for a site that does not exist, 429 over the limits. The text is not stored and not logged by the backend.
   */
  sendHostContact: (slug: string, payload: HostContactPayload) =>
    ApiClient.post<void>(`/public/orgs/${encodeURIComponent(slug)}/contact`, payload, { public: true }),
};
