import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CRM_CHANNELS } from '@/features/crm/lib/crm-labels';
import type { CrmProfileListParams, CrmProfileSort } from '@/types/crm.types';

export const PROFILE_PAGE_SIZE = 20;

export const PROFILE_SORTS: ReadonlyArray<{ sort: CrmProfileSort; labelKey: string }> = [
  { sort: 'lastStay', labelKey: 'crm.filters.sort.lastStay' },
  { sort: 'spend', labelKey: 'crm.filters.sort.spend' },
  { sort: 'stays', labelKey: 'crm.filters.sort.stays' },
  { sort: 'name', labelKey: 'crm.filters.sort.name' },
];

const DEFAULT_SORT: CrmProfileSort = 'lastStay';

export type EmailFilter = 'any' | 'reachable' | 'unreachable';

export interface ProfileFilterState {
  search: string;
  country: string;
  language: string;
  channel: string;
  tag: string;
  minStays: number | null;
  email: EmailFilter;
  sort: CrmProfileSort;
  page: number;
}

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

const DIGITS_OF_A_PHONE = 5;

/**
 * Whether a search text is an e-mail address or a phone number (or the start of one that has most of it): the personal data a host looks
 * a guest up by, which the server finds by the whole value. Such a text is never written to the address (`?q=`), where it would stay in
 * the history of the browser and in the link the host shares: it stays in the state of the page and goes only to the query of the API.
 */
export function looksLikeContact(text: string): boolean {
  return text.includes('@') || (text.match(/\d/g) ?? []).length >= DIGITS_OF_A_PHONE;
}

export function applyProfileFilters(current: URLSearchParams, patch: ProfileFilterPatch): URLSearchParams {
  const next = new URLSearchParams(current);
  if (patch.search !== undefined) setText(next, 'q', looksLikeContact(patch.search) ? '' : patch.search);
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

  if (patch.page !== undefined && patch.page > 1) next.set('page', String(Math.floor(patch.page)));
  else next.delete('page');
  return next;
}

function withoutFilters(current: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of ['q', 'country', 'language', 'channel', 'tag', 'minStays', 'email', 'page']) next.delete(key);
  return next;
}

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
 * replaces the step it is in (`replace`): Back leaves the search as it was, not one letter at a time. The one thing that does not live
 * in the address is a search by e-mail address or phone number (`looksLikeContact`): personal data stay out of the history and of the
 * links, so that search is kept in the state of the page and does not survive a reload.
 */
export function useProfileFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [contactSearch, setContactSearch] = useState('');
  const filters = useMemo(() => {
    const read = readProfileFilters(searchParams);
    return read.search === '' && contactSearch !== '' ? { ...read, search: contactSearch } : read;
  }, [searchParams, contactSearch]);
  const params = useMemo(() => toListParams(filters), [filters]);
  const activeCount = activeFilterCount(filters);

  const change = useCallback(
    (patch: ProfileFilterPatch, options?: { replace?: boolean }) => {
      if (patch.search !== undefined) setContactSearch(looksLikeContact(patch.search) ? patch.search.trim() : '');
      setSearchParams((current) => applyProfileFilters(current, patch), { replace: options?.replace });
    },
    [setSearchParams],
  );
  const clear = useCallback(() => {
    setContactSearch('');
    setSearchParams((current) => withoutFilters(current));
  }, [setSearchParams]);
  const searchOfPage = useCallback((page: number) => applyProfileFilters(searchParams, { page }).toString(), [searchParams]);

  return { filters, params, activeCount, hasFilters: activeCount > 0 || filters.search !== '', change, clear, searchOfPage };
}
