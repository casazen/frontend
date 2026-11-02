import { ApiClient } from './client';
import type {
  PublicDestination,
  PublicSiteCalendar,
  PublicStaysQuery,
  PublicStaysResult,
} from '@/types/public-stays.types';

const base = (slug: string) => `/public/orgs/${encodeURIComponent(slug)}`;

/**
 * The search of the booking site of one host (DB-07a). Anonymous, read only, limited per client address; the answers are kept
 * by the server for a few seconds.
 */
export const publicSiteSearchApi = {
  /**
   * Every published home of the site for a stay, in one call: free or why not, the total of the stay as the quote adds it up,
   * the average night, the first free date and, when nothing is free, up to three nearby ranges that are. 422
   * `public_stays_dates_invalid` for dates that are not both given, not in order or too long; 400 for a value out of range.
   */
  getStays: (slug: string, query: PublicStaysQuery = {}) =>
    ApiClient.get<PublicStaysResult>(`${base(slug)}/stays`, query, { public: true }),

  /** The nights of the whole site for the «Quando» field: free when some home that sleeps the party is, with the cheapest night. */
  getSiteCalendar: (slug: string, query: { from?: string; to?: string; adults?: number; children?: number } = {}) =>
    ApiClient.get<PublicSiteCalendar>(`${base(slug)}/calendar`, query, { public: true }),

  /** The places for the «Dove» field: the comuni of the published homes with how many each has. */
  getDestinations: (slug: string) =>
    ApiClient.get<PublicDestination[]>(`${base(slug)}/destinations`, undefined, { public: true }),

  /**
   * The same search across ALL the booking sites (the public `/search` of CasaZen): the free homes of every host that can take a
   * booking, a page at a time, each with the slug of its own site and the facets of the place asked. `where` is what the person typed.
   */
  getPlatformStays: (query: PublicStaysQuery = {}) =>
    ApiClient.get<PublicStaysResult>('/public/stays', query, { public: true }),

  /** The nights of all the sites for the «Quando» field; with `where` only the homes of that place count. */
  getPlatformCalendar: (query: { where?: string; from?: string; to?: string; adults?: number; children?: number } = {}) =>
    ApiClient.get<PublicSiteCalendar>('/public/stays/calendar', query, { public: true }),

  /** The places of all the sites for the «Dove» field, the most homes first. */
  getPlatformDestinations: () => ApiClient.get<PublicDestination[]>('/public/stays/destinations', undefined, { public: true }),
};
