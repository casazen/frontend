import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { tenantAreaApi } from '@/api/tenant-area.api';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';
import { TenantGate } from './tenant-gate';
import { useTenantContractPage } from './use-tenant-contract';

export function TenantDocumentsPage() {
  const { t } = useTranslation();
  const page = useTenantContractPage();
  if (page.status !== 'ready') return <TenantGate status={page.status} error={page.error} refetch={page.refetch} />;
  const area = page.area;

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
      {area.documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('tenantArea.documents.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {area.documents.map((document) => (
            <li key={document.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <span>
                <span className="font-medium">{document.name}</span>
                <span className="ml-2 text-sm text-foreground/70">{t(`tenantArea.documents.kind.${kindKey(document.kind)}`)}</span>
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => void download(document.id, document.name)}>
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
