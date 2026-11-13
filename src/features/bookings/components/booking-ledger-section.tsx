import { Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { PaymentLedgerTable } from '@/features/payments/components/payment-ledger-table';
import { documentLinkOf, ledgerReadOf } from '@/features/payments/lib/payment-ledger';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { useBookingLedger } from '@/queries/use-payment-ledger';
import type { PaymentLedgerLine } from '@/types';

const NO_LINES: readonly PaymentLedgerLine[] = [];

/**
 * «Incassi» in the tab Pagamento of a booking (FIS-05, NF-85, E06/F04/US01/T04): everything collected for the booking, card, manual and channel payments in one
 * table, each with its commission, its net, the day it is credited, its state in words and the fiscal document of the booking. It reads the ledger of the booking
 * and shows what the server sends, as it sends it.
 *
 * It is for who may read payments (`payment.read`: the API refuses the ledger to the others, so nothing is asked and the section is not there for them: they get
 * the state of the payment without any amount, as the rest of the tab). A booking the caller does not reach is a 404 and is told as not found, whatever an earlier
 * read left in the cache; a refusal is told as such; a read that failed is told as failed, with a retry, and is never an empty ledger. When the collections of the
 * channel could not be read the server answers the amounts it had stored and says so: a calm notice, not an error. «Registra incasso» (above) marks the payments stale
 * when it succeeds, and the ledger is read again.
 */
export function BookingLedgerSection({ bookingId }: { bookingId: string }) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const canRead = hasPermission('short-rent', 'payment.read');
  const ledger = useBookingLedger(bookingId, { enabled: canRead });

  if (!canRead) return null;

  const read = ledgerReadOf({ enabled: canRead, isError: ledger.isError, status: getHttpStatus(ledger.error), hasData: ledger.data !== undefined });
  const ledgerData = read === 'ok' ? ledger.data : undefined;

  return (
    <PlainSection title={t('paymentLedger.section.title')} data-testid="booking-payment-ledger">
      {read === 'notFound' ? (
        <p className="text-sm text-foreground/70" data-testid="payment-ledger-not-found">
          {t('paymentLedger.section.notFound')}
        </p>
      ) : read === 'forbidden' ? (
        <p className="text-sm text-foreground/70" data-testid="payment-ledger-forbidden">
          {t('paymentLedger.section.forbidden')}
        </p>
      ) : (
        <div className="space-y-3">
          {ledgerData?.degraded ? (
            <Alert variant="info" data-testid="payment-ledger-degraded">
              {t('paymentLedger.degraded')}
            </Alert>
          ) : null}
          <PaymentLedgerTable
            lines={ledgerData?.lines ?? NO_LINES}
            label={t('paymentLedger.section.label')}
            documentHref={documentLinkOf(hasPermission, flags)}
            isLoading={read === 'loading'}
            isError={read === 'failed'}
            error={ledger.error}
            errorTitle={t('paymentLedger.section.loadError')}
            onRetry={() => void ledger.refetch()}
            isRefreshing={read === 'ok' && ledger.isFetching}
            empty={{ icon: Wallet, title: t('paymentLedger.section.emptyTitle'), description: t('paymentLedger.section.emptyDescription') }}
            testId="booking-payment-ledger-table"
          />
        </div>
      )}
    </PlainSection>
  );
}
