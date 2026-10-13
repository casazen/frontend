import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AdminSupplier } from '@/types/admin-suppliers';

/** Longest reason the API accepts (`SuspendSupplierRequest.Reason`). */
export const SUSPEND_REASON_MAX_LENGTH = 500;

/**
 * Asks the admin why a supplier is suspended: the reason is required, recorded in the audit trail and never shown to the
 * supplier. Warns about the requests the supplier still has open, which stay as they are (SU-12).
 */
export function SuspendSupplierDialog({
  supplier,
  isPending,
  onCancel,
  onConfirm,
}: {
  supplier: AdminSupplier;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onCancel()}>
      <DialogContent data-testid="suspend-supplier-dialog">
        <DialogHeader>
          <DialogTitle>{t('admin.suppliers.suspendDialog.title', { name: supplier.legalName })}</DialogTitle>
          <DialogDescription>{t('admin.suppliers.suspendDialog.description')}</DialogDescription>
        </DialogHeader>
        {supplier.openRequests > 0 && (
          <p
            className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
            role="status"
            data-testid="suspend-open-requests"
          >
            {t('admin.suppliers.suspendDialog.openRequests', { count: supplier.openRequests })}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="suspend-reason">{t('admin.suppliers.suspendDialog.reason')}</Label>
          <Textarea
            id="suspend-reason"
            value={reason}
            maxLength={SUSPEND_REASON_MAX_LENGTH}
            onChange={(e) => setReason(e.target.value)}
            aria-describedby="suspend-reason-hint"
            data-testid="suspend-reason"
          />
          <p id="suspend-reason-hint" className="text-xs text-muted-foreground">
            {t('admin.suppliers.suspendDialog.reasonHint')}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            {t('admin.suppliers.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(trimmed)}
            disabled={!trimmed || isPending}
            data-testid="suspend-confirm"
          >
            {isPending ? t('admin.suppliers.suspendDialog.suspending') : t('admin.suppliers.suspend')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
