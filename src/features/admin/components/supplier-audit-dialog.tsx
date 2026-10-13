import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getProblemMessage } from '@/lib/api-errors';
import { getSupplierStatusLabel } from '@/lib/i18n-labels';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { useSupplierAudit } from '@/queries/use-supplier';
import type { AdminSupplier } from '@/types/admin-suppliers';

const AUDIT_DATE_TIME: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

/** The audit trail of a supplier: who suspended or reactivated it, when and why (SU-12). */
export function SupplierAuditDialog({ supplier, onClose }: { supplier: AdminSupplier; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useSupplierAudit(supplier.orgId);

  let body;
  if (isLoading) {
    body = (
      <div className="space-y-2" data-testid="supplier-audit-loading" aria-busy="true" aria-label={t('admin.suppliers.loading')}>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  } else if (isError || !data) {
    body = (
      <div className="flex flex-wrap items-center gap-3" role="alert" data-testid="supplier-audit-error">
        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
        <p className="flex-1 text-sm text-destructive">{getProblemMessage(error, t) ?? t('admin.suppliers.audit.loadError')}</p>
        <Button size="sm" variant="outline" onClick={() => void refetch()}>
          {t('admin.suppliers.retry')}
        </Button>
      </div>
    );
  } else if (data.length === 0) {
    body = (
      <p className="text-sm text-muted-foreground" data-testid="supplier-audit-empty">
        {t('admin.suppliers.audit.empty')}
      </p>
    );
  } else {
    body = (
      <ol className="space-y-3 border-l pl-4" data-testid="supplier-audit-list">
        {data.map((entry) => (
          <li key={entry.id} data-testid={`supplier-audit-${entry.id}`}>
            <p className="font-medium">{t(`admin.suppliers.audit.action.${entry.action}`)}</p>
            <p className="text-xs text-muted-foreground">
              {formatRomeDateTime(entry.occurredAt, i18n.language, AUDIT_DATE_TIME)} ·{' '}
              {t('admin.suppliers.audit.by', { actor: entry.actorName ?? entry.actorUserId })}
            </p>
            {entry.previousStatus && entry.newStatus && (
              <p className="text-xs text-muted-foreground">
                {getSupplierStatusLabel(entry.previousStatus, t)} → {getSupplierStatusLabel(entry.newStatus, t)}
              </p>
            )}
            {entry.reason && <p className="text-sm">{t('admin.suppliers.audit.reason', { reason: entry.reason })}</p>}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="supplier-audit-dialog">
        <DialogHeader>
          <DialogTitle>{t('admin.suppliers.audit.title', { name: supplier.legalName })}</DialogTitle>
          <DialogDescription>{t('admin.suppliers.audit.description')}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">{body}</div>
      </DialogContent>
    </Dialog>
  );
}
