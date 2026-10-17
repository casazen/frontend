import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { SupplierClient } from '@/types/supplier-clients';

/** Who the customer is, in a line under the name: host or private customer, and "Abituale" from the third job taken. */
export function ClientTags({ client }: { client: SupplierClient }) {
  const { t } = useTranslation();
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-foreground/70">
      <span>{t(client.kind === 'private' ? 'supplier.clients.kind.private' : 'supplier.clients.kind.host')}</span>
      {client.regular ? <Badge variant="secondary">{t('supplier.clients.regular')}</Badge> : null}
    </div>
  );
}
