import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CRM_CHANNELS } from '@/features/crm/lib/crm-labels';
import type { CrmProfileListParams, CrmProfileSort } from '@/types/crm.types';

/** Profiles in a page of the list. */
export const PROFILE_PAGE_SIZE = 20;

/** The orders the list can have, with the key of the words of each. The first is the one the server uses when none is asked. */
export const PROFILE_SORTS: ReadonlyArray<{ sort: CrmProfileSort; labelKey: string }> = [
  { sort: 'lastStay', labelKey: 'crm.filters.sort.lastStay' },
  { sort: 'spend', labelKey: 'crm.filters.sort.spend' },
  { sort: 'stays', labelKey: 'crm.filters.sort.stays' },
  { sort: 'name', labelKey: 'crm.filters.sort.name' },
];

const DEFAULT_SORT: CrmProfileSort = 'lastStay';

/** Whether the guest can be written to by e-mail: any, yes (the server filters `reachableByEmail=true`), or no (`false`). */
export type EmailFilter = 'any' | 'reachable' | 'unreachable';

/** What narrows the list, as the address says it. */
export interface ProfileFilterState {
  /** A part of a name, or a whole e-mail address or phone number. */
  search: string;
  country: string;
  language: string;
  channel: string;
  tag: string;
  minStays: number | null;
  email: EmailFilter;
  sort: CrmProfileSort;
  /** From 1. */
  page: number;
}

/** What a change says: any field of the state. A change of anything but the page itself puts the list back on its first page. */
export type ProfileFilterPatch = Partial<ProfileFilterState>;

function textOf(params: URLSearchParams, key: string): string {
  return (params.get(key) ?? '').trim();
}

function wholeNumberOf(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key)?.trim() ?? '';
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

/**
 * The state of the list from the address (`?q=rossi&channel=Airbnb&minStays=2&email=reachable&sort=spend&page=2`). What is not asked for
 * is the default, and what is not valid is ignored: the plain address is the plain list.
 */
export function readProfileFilters(params: URLSearchParams): ProfileFilterState {
  const channel = textOf(params, 'channel');
  const sort = params.get('sort');
  const email = params.get('email');
  return {
    search: textOf(params, 'q'),
    country: textOf(params, 'country'),
    language: textOf(params, 'language'),
    channel: CRM_CHANNELS.some((entry) => entry.channel === channel) ? channel : '',
    tag: textOf(params, 'tag'),
    minStays: wholeNumberOf(params, 'minStays'),
    email: email === 'reachable' || email === 'unreachable' ? email : 'any',
    sort: PROFILE_SORTS.find((entry) => entry.sort === sort)?.sort ?? DEFAULT_SORT,
    page: wholeNumberOf(params, 'page') ?? 1,
  };
}

function setText(params: URLSearchParams, key: string, value: string) {
  const text = value.trim();
  if (text) params.set(key, text);
  else params.delete(key);
}

/**
 * The address after a change: what the patch says is written (or, for the default, taken away), what is not the list's (`detail` of the
 * drawer of the shell) is left alone, and a change of anything but the page goes back to the first page.
 */
export function applyProfileFilters(current: URLSearchParams, patch: ProfileFilterPatch): URLSearchParams {
  const next = new URLSearchParams(current);
  if (patch.search !== undefined) setText(next, 'q', patch.search);
  if (patch.country !== undefined) setText(next, 'country', patch.country);
  if (patch.language !== undefined) setText(next, 'language', patch.language);
  if (patch.channel !== undefined) setText(next, 'channel', patch.channel);
  if (patch.tag !== undefined) setText(next, 'tag', patch.tag);
  if (patch.minStays !== undefined) {
    if (patch.minStays !== null && patch.minStays >= 1) next.set('minStays', String(Math.floor(patch.minStays)));
    else next.delete('minStays');
  }
  if (patch.email !== undefined) {
    if (patch.email === 'any') next.delete('email');
    else next.set('email', patch.email);
  }
  if (patch.sort !== undefined) {
    if (patch.sort === DEFAULT_SORT) next.delete('sort');
    else next.set('sort', patch.sort);
  }

  // Only the page stays when the patch is a page: any other change starts the list again.
  if (patch.page !== undefined && patch.page > 1) next.set('page', String(Math.floor(patch.page)));
  else next.delete('page');
  return next;
}

/** The address with every filter and the search taken away. The order stays: it is not a filter. */
function withoutFilters(current: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of ['q', 'country', 'language', 'channel', 'tag', 'minStays', 'email', 'page']) next.delete(key);
  return next;
}

/** What `GET api/crm/guests` is asked for, from the state of the list. */
export function toListParams(filters: ProfileFilterState): CrmProfileListParams {
  return {
    search: filters.search || undefined,
    country: filters.country || undefined,
    language: filters.language || undefined,
    channel: filters.channel || undefined,
    tag: filters.tag || undefined,
    minStays: filters.minStays ?? undefined,
    reachableByEmail: filters.email === 'any' ? undefined : filters.email === 'reachable',
    sort: filters.sort,
    page: filters.page,
    pageSize: PROFILE_PAGE_SIZE,
  };
}

/** How many of the filters of the panel are on (the search has its own box, the order is not a filter). */
function activeFilterCount(filters: ProfileFilterState): number {
  return (
    [filters.country, filters.language, filters.channel, filters.tag].filter(Boolean).length +
    (filters.minStays === null ? 0 : 1) +
    (filters.email === 'any' ? 0 : 1)
  );
}

/**
 * The state of the list of profiles, which lives in the address (`useSearchParams`) so that a view can be reloaded, shared and left with
 * the Back button. Every change goes back to the first page, and each one is a step of the history, except a text being typed, which
 * replaces the step it is in (`replace`): Back leaves the search as it was, not one letter at a time.
 */
export function useProfileFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readProfileFilters(searchParams), [searchParams]);
  const params = useMemo(() => toListParams(filters), [filters]);
  const activeCount = activeFilterCount(filters);

  const change = useCallback(
    (patch: ProfileFilterPatch, options?: { replace?: boolean }) =>
      setSearchParams((current) => applyProfileFilters(current, patch), { replace: options?.replace }),
    [setSearchParams],
  );
  const clear = useCallback(() => setSearchParams((current) => withoutFilters(current)), [setSearchParams]);
  /** The query string of the list on another page: for a link that replaces the address when the page asked for is not there any more. */
  const searchOfPage = useCallback((page: number) => applyProfileFilters(searchParams, { page }).toString(), [searchParams]);

  return { filters, params, activeCount, hasFilters: activeCount > 0 || filters.search !== '', change, clear, searchOfPage };
}
