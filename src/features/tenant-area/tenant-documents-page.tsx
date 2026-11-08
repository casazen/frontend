import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { tenantAreaApi } from '@/api/tenant-area.api';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';
import { extraordinaryKept } from './lib/extraordinary';
import { TenantGate } from './tenant-gate';
import { tenantDuesPath } from './paths';
import { useTenantContractPage } from './use-tenant-contract';

export function TenantDocumentsPage() {
  const { t } = useTranslation();
  const page = useTenantContractPage();
  if (page.status !== 'ready') return <TenantGate status={page.status} error={page.error} refetch={page.refetch} />;
  const area = page.area;
  const documents = area.documents.filter((document) => extraordinaryKept(document));

  async function download(documentId: string, name: string) {
    try {
      const blob = await tenantAreaApi.downloadDocument(area.contract.id, documentId);
      saveBlobAs(blob, name);
    } catch (error) {
      toast.error(getProblemMessage(error, t) ?? t('tenantArea.documents.failed'));
    }
  }

  return (
    <div data-testid="tenant-documents">
      {documents.length === 0 ? (
        <div data-testid="tenant-documents-empty">
          <EmptyState
            icon={FileText}
            title={t('tenantArea.documents.emptyTitle')}
            description={t('tenantArea.documents.emptyDescription')}
            action={{ label: t('tenantArea.documents.goToDues'), href: tenantDuesPath(area.contract.id) }}
          />
        </div>
      ) : (
        <ul className="min-w-0 space-y-2">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex min-w-0 flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              data-testid={`tenant-document-${document.kind}`}
            >
              <span className="min-w-0 break-words">
                <span className="font-medium">{document.name}</span>
                <span className="mt-1 block text-sm text-foreground/70 sm:mt-0 sm:ml-2 sm:inline">{t(`tenantArea.documents.kind.${kindKey(document.kind)}`)}</span>
              </span>
              <Button type="button" variant="outline" size="sm" className="h-auto min-h-11 w-full whitespace-normal sm:w-auto" onClick={() => void download(document.id, document.name)}>
                {t('tenantArea.documents.download')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function kindKey(kind: string): string {
  return ['Budget', 'Settlement', 'Statement', 'Report', 'Other'].includes(kind) ? kind : 'Other';
}
