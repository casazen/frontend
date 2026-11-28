import type { TFunction } from 'i18next';
import { parseDateRange, type ListState } from '@/components/shared/list-view/list-state';
import type { ListChip, ListFilter } from '@/components/shared/list-view/list-types';
import { withinSupportedDays } from '@/features/reports/report-period';
import type { ArchiveDocument, ArchiveDocumentType, ArchiveListQuery, ArchiveTypeCount, ArchiveTypesQuery } from '@/types';
import { archiveTypeMeta } from './document-type';

export const ARCHIVE_ALL_TYPES = 'all';

const DAYS_FILTER = 'days';
const PROPERTY_FILTER = 'property';

export const ARCHIVE_DEFAULT_PAGE_SIZE = 25;

export const ARCHIVE_PAGE_SIZES = [ARCHIVE_DEFAULT_PAGE_SIZE, 50, 100] as const;

const PAGE_SIZE_PARAM = 'pageSize';
const PAGE_PARAM = 'page';

export function readArchivePageSize(address: URLSearchParams): number {
  const asked = Number(address.get(PAGE_SIZE_PARAM));
  return ARCHIVE_PAGE_SIZES.find((size) => size === asked) ?? ARCHIVE_DEFAULT_PAGE_SIZE;
}

export function withArchivePageSize(address: URLSearchParams, pageSize: number): URLSearchParams {
  const next = new URLSearchParams(address);
  next.delete(PAGE_PARAM);
  if (pageSize === ARCHIVE_DEFAULT_PAGE_SIZE) next.delete(PAGE_SIZE_PARAM);
  else next.set(PAGE_SIZE_PARAM, String(pageSize));
  return next;
}

export function documentChips(t: TFunction, types: readonly ArchiveTypeCount[]): ListChip<ArchiveDocument>[] {
  if (types.length < 2) return [];

  return [
    { id: ARCHIVE_ALL_TYPES, label: t('documentArchive.filters.all'), counted: true },
    ...types.map(({ type }) => {
      const meta = archiveTypeMeta(type);
      return { id: type, label: t(meta.labelKey), icon: meta.icon, counted: true };
    }),
  ];
}

export function archiveChipCounts(counts: readonly ArchiveTypeCount[] | undefined): Record<string, number> | undefined {
  if (!counts) return undefined;
  return { [ARCHIVE_ALL_TYPES]: counts.reduce((sum, entry) => sum + entry.count, 0), ...Object.fromEntries(counts.map((entry) => [entry.type, entry.count])) };
}

export function documentFilters(t: TFunction, properties: ReadonlyArray<{ id: string; name: string }>): ListFilter<ArchiveDocument>[] {
  const days: ListFilter<ArchiveDocument> = { id: DAYS_FILTER, type: 'date', label: t('documentArchive.filters.days') };
  if (properties.length < 2) return [days];

  return [
    days,
    {
      id: PROPERTY_FILTER,
      type: 'select',
      label: t('documentArchive.filters.property'),
      allLabel: t('documentArchive.filters.allProperties'),
      options: properties.map((property) => ({ value: property.id, label: property.name })),
    },
  ];
}

export function archiveFilterParams(state: Pick<ListState, 'q' | 'filters'>): ArchiveTypesQuery {
  const { from, to } = parseDateRange(state.filters[DAYS_FILTER] ?? '');
  return {
    from: from === undefined ? undefined : withinSupportedDays(from),
    to: to === undefined ? undefined : withinSupportedDays(to),
    propertyId: state.filters[PROPERTY_FILTER] || undefined,
    q: state.q.trim() || undefined,
  };
}

export function archiveListQuery(state: ListState, pageSize: number): ArchiveListQuery {
  const typed = state.chip !== '' && state.chip !== ARCHIVE_ALL_TYPES;
  return {
    ...archiveFilterParams(state),
    types: typed ? [state.chip as ArchiveDocumentType] : undefined,
    page: state.page,
    pageSize,
  };
}
