import { useState } from 'react';
import { CondominiumManagement } from '@/features/condominium/condominium-management';
import { CONDO_KEY } from '@/api/condominium-accounting.api';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { Button } from '@/components/ui/button';
import { ApiClient } from '@/api/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useWorkspace } from '@/hooks/use-workspace';

interface CondoDue { id: string; name: string; label: string; dueDate: string; amount: number; paid: boolean }
const url = '/long-rent/condominiums/manual-payments';

/** Home banking remains external: this page only records the landlord's explicit payment declaration. */
export function LandlordPaymentsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<string | null>(null);
  const dues = useQuery({ queryKey: ['condominium-manual-payments'], queryFn: () => ApiClient.get<CondoDue[]>(url) });
  const mark = useMutation({ mutationFn: (id: string) => ApiClient.post(`${url}/${encodeURIComponent(id)}/mark-paid`, {}),
    onSuccess: () => { setConfirm(null); void qc.invalidateQueries({ queryKey: ['condominium-manual-payments'] }); void qc.invalidateQueries({ queryKey: [CONDO_KEY] }); } });
  const canWrite = hasPermission('long-rent', 'property.write');
  return <div className="min-w-0 space-y-6" data-testid="long-rent-payments">
    <PageHeader title={t('condoManual.title')} description={t('condoManual.description')} crumbs="auto" />
    <div className={`${FOCUS_COLUMN} space-y-4`}>
      <p className="text-sm">{t('condoManual.reminder')}</p>
      <CondominiumManagement />
      {dues.isLoading ? <p role="status">{t('tenantSepa.loading')}</p> : null}
      {dues.isError || mark.isError ? <p role="alert">{t('tenantSepa.error')}</p> : null}
      {dues.data?.length === 0 ? <p>{t('condoManual.empty')}</p> : null}
      <ul className="space-y-3">
        {dues.data?.map(due => <li key={due.id} className="space-y-2 rounded-md border p-4">
          <h2 className="font-semibold">{due.name} · {due.label}</h2>
          <p>{formatDate(due.dueDate)} · {formatCurrency(due.amount, 'EUR')}</p>
          {due.paid ? <p>{t('condoManual.paid')}</p> : canWrite ? confirm === due.id ? <div className="space-y-2">
            <p>{t('condoManual.confirm', { amount: formatCurrency(due.amount, 'EUR') })}</p>
            <Button disabled={mark.isPending} onClick={() => mark.mutate(due.id)}>{t('condoManual.confirmPaid')}</Button>{' '}
            <Button variant="outline" disabled={mark.isPending} onClick={() => setConfirm(null)}>{t('condoManual.cancel')}</Button>
          </div> : <Button onClick={() => setConfirm(due.id)}>{t('condoManual.markPaid')}</Button> : null}
        </li>)}
      </ul>
    </div>
  </div>;
}
