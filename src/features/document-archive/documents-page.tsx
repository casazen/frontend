import { useCallback, useState } from 'react';
import { FileArchive } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ARCHIVE_ERROR, archiveErrorCode } from '@/api/document-archive.api';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { ListView } from '@/components/shared/list-view/list-view';
import { useListState } from '@/components/shared/list-view/use-list-state';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { useDocuments, useDocumentTypes, useDownloadArchiveDocument } from '@/queries/use-document-archive';
import { useProperties } from '@/queries/use-properties';
import type { ArchiveDocument, ArchiveTypeCount, Property } from '@/types';
import { ArchiveExportDialog } from './archive-export-dialog';
import { archiveDocumentKey } from './document-file';
import {
  ARCHIVE_PAGE_SIZES,
  archiveChipCounts,
  archiveFilterParams,
  archiveListQuery,
  readArchivePageSize,
  withArchivePageSize,
} from './document-filters';
import { useDocumentsList } from './documents-list';

const NO_ROWS: ArchiveDocument[] = [];
const NO_TYPES: ArchiveTypeCount[] = [];
const NO_PROPERTIES: Property[] = [];

/**
 * The documents page (NF-99, REP-04): every document the caller may read, in one list, with the filter by type (a chip for each type the
 * server offers, with its count), by days and by property, a search, a download for each row and the archive of a period as a ZIP. What the
 * caller may read is decided by the server, for the list, the counts, the files and the archive alike: this page offers what the server
 * sends and nothing else. The server pages the list; the page, the page size and the filters are in the address (`?page=2&pageSize=50`),
 * so a reload and the Back button give the place that was left. It is for who may read the properties (`property.read`: the route asks for
 * it, the same door as the API); each type is then opened by the server with the permission of its own area.
 */
export function DocumentsPage() {
  const { t } = useTranslation();
  const [address, setAddress] = useSearchParams();
  const pageSize = readArchivePageSize(address);
  const [exporting, setExporting] = useState(false);
  // The rows whose file the server could not find: they say so, and the button is gone from them.
  const [withoutFile, setWithoutFile] = useState<ReadonlySet<string>>(() => new Set());

  const properties = useProperties({}, { fresh: true });
  const propertyList = Array.isArray(properties.data) ? properties.data : NO_PROPERTIES;

  // The types the caller may read, asked with no filter: the chips are the definition of the list, and the list cannot be defined from what
  // its own filters give. The numbers on the chips are the second call below, which does follow the filters.
  const offered = useDocumentTypes({});
  const offeredTypes = offered.data ?? NO_TYPES;
  // The first read waits for what the filters are made of: the properties (an old `?f_property=` is checked against them) and the types (so is `?chip=`).
  const ready = !properties.isLoading && !offered.isLoading;

  const { mutate: downloadDocument, isPending: downloading } = useDownloadArchiveDocument();
  const startDownload = useCallback(
    (document: ArchiveDocument) => {
      downloadDocument(document, {
        onError: (error) => {
          if (archiveErrorCode(error) === ARCHIVE_ERROR.noFile) setWithoutFile((current) => new Set(current).add(archiveDocumentKey(document)));
        },
      });
    },
    [downloadDocument],
  );

  const list = useDocumentsList({ types: offeredTypes, properties: propertyList, withoutFile, downloading, onDownload: startDownload });
  const { state } = useListState(list);
  const documents = useDocuments(archiveListQuery(state, pageSize), ready);
  const counts = useDocumentTypes(archiveFilterParams(state), ready);

  const retry = () => {
    void documents.refetch();
    if (offered.isError) void offered.refetch();
  };

  return (
    <AppShell>
      <div className="space-y-6" data-testid="documents-page">
        <PageHeader
          title={t('documentArchive.title')}
          description={t('documentArchive.description')}
          primary={{ label: t('documentArchive.export.open'), icon: FileArchive, onClick: () => setExporting(true), testId: 'archive-export-open' }}
          mobilePrimary="none"
        />

        <ListView
          list={list}
          mode="server"
          rows={documents.data?.items ?? NO_ROWS}
          totalCount={documents.data?.totalCount}
          pageSize={pageSize}
          chipCounts={archiveChipCounts(counts.data)}
          isLoading={!ready || documents.isLoading}
          isRefreshing={documents.isPlaceholderData}
          isError={documents.isError && !documents.isLoading}
          error={documents.error}
          errorTitle={t('documentArchive.error')}
          onRetry={retry}
          testId="documents-list"
          // The button of a row is 44 px high whatever the pointer: the table is where the mouse is, and the targets are for fingers too.
          className="[&_td_button]:min-h-11"
        />

        {(documents.data?.totalCount ?? 0) > ARCHIVE_PAGE_SIZES[0] ? (
          <div className="flex justify-end">
            <Field label={t('documentArchive.pageSize')} className="w-full sm:w-52">
              <Select
                size="sm"
                value={String(pageSize)}
                onChange={(event) => setAddress(withArchivePageSize(address, Number(event.target.value)), { preventScrollReset: true })}
                data-testid="documents-page-size"
              >
                {ARCHIVE_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}
      </div>

      <ArchiveExportDialog
        open={exporting}
        onClose={() => setExporting(false)}
        types={offeredTypes}
        properties={propertyList}
        propertyId={state.filters.property}
      />
    </AppShell>
  );
}
