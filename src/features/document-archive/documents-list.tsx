import { useMemo, type ReactNode } from 'react';
import { CalendarDays, Download, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { defineList } from '@/components/shared/list-view/define-list';
import type { ListRowAction } from '@/components/shared/list-view/list-types';
import { BOOKINGS_PATH } from '@/features/bookings/lib/booking-list-query';
import { formatStayDate } from '@/lib/stay-dates';
import type { ArchiveDocument, ArchiveTypeCount } from '@/types';
import { archiveDocumentKey, formatFileSize, isEmptyDocument } from './document-file';
import { documentChips, documentFilters } from './document-filters';
import { archiveTypeMeta } from './document-type';

interface DocumentsListOptions {
  /** The types the server says the caller may read: the chips of the list, and no other. */
  types: readonly ArchiveTypeCount[];
  /** The properties of the caller, for the filter. */
  properties: ReadonlyArray<{ id: string; name: string }>;
  /** The rows (by `archiveDocumentKey`) whose file the server could not find: they say so instead of offering a download. */
  withoutFile: ReadonlySet<string>;
  /** A download is under way: no other can start until it ends, so every button waits. */
  downloading: boolean;
  /** The person asked to download this document. */
  onDownload: (document: ArchiveDocument) => void;
}

const DAY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

const BOOKING_LINK =
  'inline-block max-w-full rounded-sm font-semibold text-foreground [overflow-wrap:anywhere] hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * The documents of the archive (NF-99) as a unified list (UI-14) in `server` mode: the server filters, searches and pages, so the list shows
 * the rows as they come. Five columns: the document with its kind under it (an icon and the word), the day, the property, the booking
 * when there is one (a link to it) and the size. The one action of a row is the download; a row that has no file says so, in the place of
 * the size, and has no button, so there is never a button that leads nowhere. There is no CSV of the page: the archive has its own export,
 * and no order to choose: the server sends the newest day first.
 */
export function useDocumentsList({ types, properties, withoutFile, downloading, onDownload }: DocumentsListOptions) {
  const { t, i18n } = useTranslation();

  return useMemo(() => {
    const language = i18n.language;
    const hasNoFile = (document: ArchiveDocument) => isEmptyDocument(document) || withoutFile.has(archiveDocumentKey(document));

    const day = (document: ArchiveDocument) => formatStayDate(document.date, language, DAY) || document.date;
    const typeName = (document: ArchiveDocument) => t(archiveTypeMeta(document.type).labelKey);
    const sizeText = (document: ArchiveDocument): string =>
      hasNoFile(document) ? t('documentArchive.noFile') : document.sizeBytes === null ? '—' : formatFileSize(document.sizeBytes, language);

    /** The kind of a document, with an icon: the word says it, the icon only helps the eye. */
    const typeLine = (document: ArchiveDocument): ReactNode => {
      const Icon = archiveTypeMeta(document.type).icon;
      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground/70">
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {typeName(document)}
        </span>
      );
    };

    /** The booking of a document, as a link to it; a document of no booking has a dash. */
    const bookingCell = (document: ArchiveDocument): ReactNode =>
      document.bookingId ? (
        <Link to={`${BOOKINGS_PATH}/${document.bookingId}`} className={BOOKING_LINK}>
          {document.bookingCode || t('documentArchive.booking')}
        </Link>
      ) : (
        '—'
      );

    const downloadOf = (document: ArchiveDocument): ListRowAction | null =>
      hasNoFile(document)
        ? null
        : {
            id: 'download',
            label: t('documentArchive.download'),
            icon: Download,
            variant: 'outline',
            disabled: downloading,
            onSelect: () => onDownload(document),
            testId: `document-download-${archiveDocumentKey(document)}`,
          };

    return defineList<ArchiveDocument>({
      key: 'documents',
      title: t('documentArchive.title'),
      rowKey: archiveDocumentKey,
      rowLabel: (document) => document.title,
      columns: [
        {
          id: 'document',
          label: t('documentArchive.columns.document'),
          default: true,
          always: true,
          rowHeader: true,
          render: (document) => (
            <div className="min-w-0">
              <span className="break-words font-medium">{document.title}</span>
              <span className="mt-0.5 block">{typeLine(document)}</span>
            </div>
          ),
        },
        { id: 'date', label: t('documentArchive.columns.date'), default: true, render: (document) => <span className="whitespace-nowrap">{day(document)}</span> },
        { id: 'property', label: t('documentArchive.columns.property'), default: true, render: (document) => document.propertyName || '—' },
        { id: 'booking', label: t('documentArchive.columns.booking'), default: true, render: bookingCell },
        {
          id: 'size',
          label: t('documentArchive.columns.size'),
          default: true,
          align: 'end',
          render: (document) => <span className="whitespace-nowrap">{sizeText(document)}</span>,
        },
      ],

      search: { label: t('documentArchive.search.label'), placeholder: t('documentArchive.search.placeholder') },
      chips: documentChips(t, types),
      filters: documentFilters(t, properties),

      primaryAction: downloadOf,
      card: (document) => ({
        title: document.title,
        sub: document.propertyName || undefined,
        status: typeLine(document),
        meta: [
          { icon: CalendarDays, text: day(document), label: t('documentArchive.columns.date') },
          ...(document.bookingId ? [{ text: bookingCell(document), label: t('documentArchive.columns.booking') }] : []),
          { text: sizeText(document), label: t('documentArchive.columns.size') },
        ],
      }),
      rowTone: (document) => (hasNoFile(document) ? 'done' : undefined),
      // With the sidebar open (from `lg`) five columns and the button do not fit under 1280 px: cards until then.
      cardsUntil: 'xl',
      csv: false,

      empty: { icon: FileText, title: t('documentArchive.emptyTitle'), description: t('documentArchive.emptyDescription') },
      noResults: { title: t('documentArchive.noResultsTitle'), description: t('documentArchive.noResultsDescription') },
      countLabel: (count) => t('documentArchive.count', { count }),
    });
  }, [t, i18n.language, types, properties, withoutFile, downloading, onDownload]);
}
