import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';

/** Longest reason the API accepts (`RecordOfflinePaymentRequest.Reason`, SP-15a). */
const OFFLINE_REASON_MAX_LENGTH = 500;

const T = 'supplier.requests.payment.record';

/**
 * «Ho incassato fuori da CasaZen» (SP-15a): the supplier records that the job was paid in another way. It cannot be undone, so the
 * dialog says what follows: no commission, the customer is told, no way back. A job that should have been paid in CasaZen needs the
 * reason (it is the trace of the exception); for one that is paid outside anyway the reason is optional.
 */
export function RecordPaymentDialog({
  online,
  isPending,
  onCancel,
  onConfirm,
}: {
  /** The job is paid inside CasaZen: the reason is required. */
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
