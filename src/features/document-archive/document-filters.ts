import type { TFunction } from 'i18next';
import { parseDateRange, type ListState } from '@/components/shared/list-view/list-state';
import type { ListChip, ListFilter } from '@/components/shared/list-view/list-types';
import type { ArchiveDocument, ArchiveDocumentType, ArchiveListQuery, ArchiveTypeCount, ArchiveTypesQuery } from '@/types';
import { archiveTypeMeta } from './document-type';

/** The chip that stands for every type the caller may read. The other chips are named by the key of their type (`contract`). */
export const ARCHIVE_ALL_TYPES = 'all';

/** The ids of the filters, which are also their names in the address (`?f_days=2026-01-01..2026-03-31&f_property=…`). */
const DAYS_FILTER = 'days';
const PROPERTY_FILTER = 'property';

/** Documents in a page when the address does not say: the page size the server uses when none is asked. */
export const ARCHIVE_DEFAULT_PAGE_SIZE = 25;

/** The page sizes the page offers; the server takes 1 to 100. */
export const ARCHIVE_PAGE_SIZES = [ARCHIVE_DEFAULT_PAGE_SIZE, 50, 100] as const;

/** The name of the page size in the address (`?pageSize=50`): the list keeps the page and its filters there too, and leaves this one alone. */
const PAGE_SIZE_PARAM = 'pageSize';
const PAGE_PARAM = 'page';

/** The page size an address asks for: one the page offers, the default for anything else (a stale link never breaks the page). */
export function readArchivePageSize(address: URLSearchParams): number {
  const asked = Number(address.get(PAGE_SIZE_PARAM));
  return ARCHIVE_PAGE_SIZES.find((size) => size === asked) ?? ARCHIVE_DEFAULT_PAGE_SIZE;
}

/**
 * The address of the same list with another page size, from its first page (the page that was open means something else with another
 * size). The default size is not written, as the list writes nothing that is its default.
 */
export function withArchivePageSize(address: URLSearchParams, pageSize: number): URLSearchParams {
  const next = new URLSearchParams(address);
  next.delete(PAGE_PARAM);
  if (pageSize === ARCHIVE_DEFAULT_PAGE_SIZE) next.delete(PAGE_SIZE_PARAM);
  else next.set(PAGE_SIZE_PARAM, String(pageSize));
  return next;
}

/**
 * The quick filters of the list: every type the server says the caller may read, and "all" first. A type the server did not send is not
 * here, so it is not on the page and not valid in the address either. With one type there is nothing to choose between: no chips. Each
 * chip carries a quiet counter, read from `chipCounts` of the list.
 */
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

/** What each chip counts: the documents of its type under the other filters, and for "all" their sum. Nothing while the server has not answered. */
export function archiveChipCounts(counts: readonly ArchiveTypeCount[] | undefined): Record<string, number> | undefined {
  if (!counts) return undefined;
  return { [ARCHIVE_ALL_TYPES]: counts.reduce((sum, entry) => sum + entry.count, 0), ...Object.fromEntries(counts.map((entry) => [entry.type, entry.count])) };
}

/**
 * The filters in the drawer of the list: the days of the document and, when there is more than one property to choose from, the property.
 * The value of a property that is not in the list (a link that is old, a property that is gone) is not valid and is ignored.
 */
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

/** What narrows the archive in the state of the list: the days, the property and the text. The types are the other half of a query. */
export function archiveFilterParams(state: Pick<ListState, 'q' | 'filters'>): ArchiveTypesQuery {
  const { from, to } = parseDateRange(state.filters[DAYS_FILTER] ?? '');
  return {
    from,
    to,
    propertyId: state.filters[PROPERTY_FILTER] || undefined,
    q: state.q.trim() || undefined,
  };
}

/**
 * What the state of the list asks of `GET api/documents`: its filters, the type of the chip that is on (none for "all": every type the
 * caller may read) and the page. The chip that is on is always one the server sent (or none), so it is never a type that was not offered.
 */
export function archiveListQuery(state: ListState, pageSize: number): ArchiveListQuery {
  const typed = state.chip !== '' && state.chip !== ARCHIVE_ALL_TYPES;
  return {
    ...archiveFilterParams(state),
    types: typed ? [state.chip as ArchiveDocumentType] : undefined,
    page: state.page,
    pageSize,
  };
}
