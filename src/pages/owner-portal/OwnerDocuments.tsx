import { useTranslation } from 'react-i18next';
import { DocumentsList } from '@/features/owner-portal/documents-list';
import { PortalLoading, PortalPageHeading, PortalReadProblem } from '@/features/owner-portal/portal-parts';
import { useOwnerDocuments } from '@/queries/ownerPortal';

/**
 * The documents the agency shares with the owner (E07/F07/US01/T03, AC-NF111-3): mandate, contract, insurance, statements, invoices and the rest, each with the version in
 * force, the dates it holds from and until and whether it is about to expire, every older version, and a download. A person the owner let in sees what the permissions it was
 * given allow (the server decides); a part that is not open or not permitted says so instead of an empty list.
 */
export function OwnerDocuments() {
  const { t } = useTranslation();
  const documents = useOwnerDocuments();

  return (
    <div className="space-y-6">
      <PortalPageHeading title={t('ownerPortal.documents.title')} description={t('ownerPortal.documents.description')} />
      {documents.isLoading ? (
        <PortalLoading label={t('ownerPortal.documents.loading')} />
      ) : documents.isError ? (
        <PortalReadProblem
          error={documents.error}
          failedTitle={t('ownerPortal.documents.error')}
          onRetry={() => void documents.refetch()}
          testId="owner-documents-error"
        />
      ) : documents.data ? (
        <DocumentsList documents={documents.data.documents} emptyText={t('ownerPortal.documents.empty')} headingAs="h2" />
      ) : null}
    </div>
  );
}
