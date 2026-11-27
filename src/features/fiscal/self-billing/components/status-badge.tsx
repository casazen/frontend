import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

/**
 * The state of the TD17 itself: a draft, issued, a discarded draft, an original a correction replaced («Sostituita»), an original whose replacement was closed as «non più dovuta» (it is not replaced by any invoice: the
 * rejection of the SDI stays, `RejectedClosed`), or a replacement closed as «non più dovuta»; a state this client does not know is shown as it came.
 */
export function StatusBadge({ status }: { status: string }) {
  const { t, i18n } = useTranslation();
  return (
    <Badge variant={status === 'Issued' ? 'success' : status === 'Draft' ? 'warning' : 'outline'} data-testid="self-billing-status" data-status={status}>
      {i18n.exists(`selfBilling.status.${status}`) ? t(`selfBilling.status.${status}`) : status}
    </Badge>
  );
}
