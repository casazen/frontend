import { useMemo, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ListBulkAction } from '@/components/shared/list-view/list-types';
import { useAcceptSupplierRequests } from '@/queries/supplier/use-inbox';
import type { SupplierServiceRequest } from '@/types/service-request';
import { acceptInBlocks, NEEDS_OFFER, NOT_IN_BLOCK, type BulkAcceptFailure } from './bulk-accept';
import { BulkAcceptDialog, type BulkAcceptSummary } from './bulk-accept-dialog';
import { canBulkAccept } from './request-model';

/**
 * "Accetta le selezionate" on the tab of the requests to answer (SP-08b): the selected requests are taken as they are, in blocks of 20, and
 * every one has its own outcome. When all go through, a line says how many; when some do not, the toast says it too and a dialog tells
 * which and why (the job overlaps one already accepted, it changed meanwhile...), never a generic error. The requests the supplier has as a
 * backup that waits are not taken here: they have their own button and are told as such. Nothing is sent to anybody by this but what a single
 * "Accetta" sends (the customer is told that the request was taken).
 */
export function useBulkAccept(): { action: ListBulkAction<SupplierServiceRequest>; dialog: ReactNode } {
  const { t } = useTranslation();
  const { mutateAsync } = useAcceptSupplierRequests();
  const [summary, setSummary] = useState<BulkAcceptSummary | null>(null);

  const action = useMemo<ListBulkAction<SupplierServiceRequest>>(
    () => ({
      id: 'accept',
      label: t('supplier.requests.bulk.accept'),
      icon: Check,
      confirm: {
        title: (count) => t('supplier.requests.bulk.confirm.title', { count }),
        description: (count) => t('supplier.requests.bulk.confirm.description', { count }),
        confirmLabel: t('supplier.requests.bulk.confirm.confirm'),
      },
      run: async (rows) => {
        const eligible = rows.filter(canBulkAccept);
        const skipped: BulkAcceptFailure[] = rows
          .filter((row) => !canBulkAccept(row))
          .map((row) => ({ id: row.id, code: row.kind === 'Custom' ? NEEDS_OFFER : NOT_IN_BLOCK, message: null }));
        const outcome = await acceptInBlocks(
          eligible.map((row) => row.id),
          mutateAsync,
        );
        const failed = [...outcome.failed, ...skipped];
        const accepted = outcome.accepted.length;
        if (failed.length === 0) return { title: t('supplier.requests.bulk.done', { count: accepted }) };

        setSummary({ accepted, failed, rows: new Map(rows.map((row) => [row.id, row])) });
        return {
          title: accepted > 0 ? t('supplier.requests.bulk.partial', { accepted, count: failed.length }) : t('supplier.requests.bulk.none', { count: failed.length }),
          tone: 'warning',
        };
      },
    }),
    [t, mutateAsync],
  );

  return { action, dialog: summary ? <BulkAcceptDialog summary={summary} onClose={() => setSummary(null)} /> : null };
}
