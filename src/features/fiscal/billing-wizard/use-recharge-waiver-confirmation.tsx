import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';

interface RechargeWaiverConfirmation {
  confirm: () => Promise<boolean>;
  dialog: ReactNode;
}

/**
 * The confirmation of the waiver of the recharge (FIX/FE-V2-INFORMATIONAL-WAIVER): turning the recharge of the portal commissions off while the agency holds an account of a portal, making
 * the agency the default holder while the recharge is off, or giving it its first listing in the bulk write of the holders, is a renunciation of the reimbursement the law gives the agency
 * and of the document that would justify the deduction. The server refuses such a write (422 `recharge_waiver_not_acknowledged`) unless it carries the explicit acknowledgement of the person,
 * so the wizard asks here, in plain words, and sends the acknowledgement only after the yes: from now on the commission of the portals paid by the agency is its own cost and is not charged to
 * the owner; the mandate has to allow it; the change does not touch the statements already made; who confirmed and when is recorded. The words are the same whichever write asked.
 */
export function useRechargeWaiverConfirmation(): RechargeWaiverConfirmation {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const pending = useRef<((confirmed: boolean) => void) | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    setOpen(false);
    resolve?.(confirmed);
  }, []);

  const confirm = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        pending.current?.(false);
        pending.current = resolve;
        setOpen(true);
      }),
    [],
  );

  const dialog = (
    <ConfirmationDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) settle(false);
      }}
      title={t('billingWizard.channels.waiver.title')}
      description={t('billingWizard.channels.waiver.description')}
      consequences={[t('billingWizard.channels.waiver.mandate'), t('billingWizard.channels.waiver.notRetroactive'), t('billingWizard.channels.waiver.recorded')]}
      confirmLabel={t('billingWizard.channels.waiver.confirm')}
      onConfirm={() => settle(true)}
    />
  );

  return { confirm, dialog };
}
