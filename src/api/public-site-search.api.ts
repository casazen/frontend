import { ApiClient } from './client';
import type {
  PublicDestination,
  PublicSiteCalendar,
  PublicStaysQuery,
  PublicStaysResult,
} from '@/types/public-stays.types';

const base = (slug: string) => `/public/orgs/${encodeURIComponent(slug)}`;

export const publicSiteSearchApi = {
  getStays: (slug: string, query: PublicStaysQuery = {}) =>
    ApiClient.get<PublicStaysResult>(`${base(slug)}/stays`, query, { public: true }),

  getSiteCalendar: (slug: string, query: { from?: string; to?: string; adults?: number; children?: number } = {}) =>
    ApiClient.get<PublicSiteCalendar>(`${base(slug)}/calendar`, query, { public: true }),

  getDestinations: (slug: string) =>
    ApiClient.get<PublicDestination[]>(`${base(slug)}/destinations`, undefined, { public: true }),

  getPlatformStays: (query: PublicStaysQuery = {}) =>
    ApiClient.get<PublicStaysResult>('/public/stays', query, { public: true }),

  getPlatformCalendar: (query: { where?: string; from?: string; to?: string; adults?: number; children?: number } = {}) =>
    ApiClient.get<PublicSiteCalendar>('/public/stays/calendar', query, { public: true }),

  getPlatformDestinations: () => ApiClient.get<PublicDestination[]>('/public/stays/destinations', undefined, { public: true }),
};
