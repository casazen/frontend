import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';

const OFFLINE_REASON_MAX_LENGTH = 500;

const T = 'supplier.requests.payment.record';

export function RecordPaymentDialog({
  online,
  isPending,
  onCancel,
  onConfirm,
}: {
  online: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title={t(`${T}.title`)}
      description={t(online ? `${T}.descriptionOnline` : `${T}.description`)}
      confirmLabel={t(`${T}.confirm`)}
      consequences={[t(`${T}.noCommission`), t(`${T}.customerTold`), t(`${T}.noUndo`)]}
      confirmDisabled={online && !trimmed}
      isLoading={isPending}
      onConfirm={() => onConfirm(trimmed)}
    >
      <Field
        label={t(`${T}.reason`)}
        optional={!online}
        hint={t(online ? `${T}.reasonHintOnline` : `${T}.reasonHint`)}
        counter={`${reason.length}/${OFFLINE_REASON_MAX_LENGTH}`}
      >
        <Textarea
          value={reason}
          maxLength={OFFLINE_REASON_MAX_LENGTH}
          onChange={(event) => setReason(event.target.value)}
          data-testid="record-payment-reason"
        />
      </Field>
    </ConfirmationDialog>
  );
}
