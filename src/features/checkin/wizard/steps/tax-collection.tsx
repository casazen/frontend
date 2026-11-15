import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/use-workspace';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { TouristTaxCollection } from '@/types/checkin-wizard.types';
import {
  canRecordPaidAtProperty,
  collectionOutlook,
  formatTaxMoney,
  hasTaxCurrency,
  moneyLocaleOf,
  type CollectionOutlook,
} from '../../lib/tourist-tax-model';

interface TaxCollectionProps {
  collection: TouristTaxCollection;
  /** Any write of the card is under way (an exemption, the collector, this button): the buttons wait, none starts a second one. */
  busy: boolean;
  /** The write of «Pagata in struttura» is under way. */
  recording: boolean;
  onRecordPaidAtProperty: () => void;
}

/**
 * The collection of the tourist tax of the stay, as the host reads it in the tax step (E25/F01/US02/T01, NF-119): where it stands («Da incassare», «Pagata online il …», «Pagata in struttura»,
 * «Incassata dal portale», «Compresa nel pagamento della prenotazione», «Non dovuta»), what the guest paid online and what was given back, what is owed back to the guest (the host gives
 * it back: a «To do» says so, nothing is refunded here), and «Segna come pagata in struttura». The button is for who holds `payment.write` and only where the server would accept it; with
 * it the guest can no longer pay the tax online, so it is never paid twice. Every amount is the API's, in the currency of the API (`currency`): with none, the number alone and a sentence
 * that says so. The block exists only while the server sends it (the flag `touristTaxOnlinePayment` is on): with the flag off the step is the one it always was.
 */
export function TaxCollection({ collection, busy, recording, onRecordPaidAtProperty }: TaxCollectionProps) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const outlook = collectionOutlook(collection);
  if (outlook === null) return null;

  const money = (amount: number) => formatTaxMoney(amount, collection.currency, moneyLocaleOf(i18n.language));
  const day = collection.collectedAt ? formatRomeDateTime(collection.collectedAt, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const canRecord = canRecordPaidAtProperty(collection) && hasPermission('short-rent', 'payment.write');

  const state: Record<CollectionOutlook, string> = {
    toCollect: t('checkin.wizard.tax.collection.state.toCollect'),
    paidOnline: day ? t('checkin.wizard.tax.collection.state.paidOnline', { date: day }) : t('checkin.wizard.tax.collection.state.paidOnlineNoDate'),
    paidOnlinePartly: t('checkin.wizard.tax.collection.state.paidOnlinePartly'),
    paidAtProperty: t('checkin.wizard.tax.collection.state.paidAtProperty'),
    collectedByChannel: t('checkin.wizard.tax.collection.state.collectedByChannel'),
    includedInBooking: t('checkin.wizard.tax.collection.state.includedInBooking'),
    notDue: t('checkin.wizard.tax.collection.state.notDue'),
  };

  const detail: Record<CollectionOutlook, string> = {
    toCollect:
      collection.toCollect > 0
        ? t('checkin.wizard.tax.collection.detail.toCollect', { amount: money(collection.toCollect) })
        : t('checkin.wizard.tax.collection.detail.amountUnknown'),
    paidOnline: t('checkin.wizard.tax.collection.detail.paidOnline', { amount: money(collection.collectedAmount) }),
    paidOnlinePartly: t('checkin.wizard.tax.collection.detail.paidOnlinePartly', {
      paid: money(collection.collectedAmount),
      rest: money(collection.toCollect),
    }),
    paidAtProperty: day
      ? t('checkin.wizard.tax.collection.detail.paidAtPropertyOn', { date: day })
      : t('checkin.wizard.tax.collection.detail.paidAtProperty'),
    collectedByChannel: t('checkin.wizard.tax.collection.detail.collectedByChannel'),
    includedInBooking: t('checkin.wizard.tax.collection.detail.includedInBooking', { amount: money(collection.includedInBooking) }),
    notDue: t('checkin.wizard.tax.collection.detail.notDue'),
  };

  // The guest can still pay online what the host has not collected: said, so the host does not collect it as well (or records it as paid at the property, below).
  const guestMayPay = outlook === 'toCollect' && collection.onlinePaymentAvailable && collection.onlinePayable > 0;

  return (
    <section
      aria-labelledby="tax-collection-title"
      className="space-y-2 rounded-md border p-3"
      data-testid="checkin-wizard-tax-collection"
      data-outlook={outlook}
    >
      <h3 id="tax-collection-title" className="text-base font-semibold">
        {t('checkin.wizard.tax.collection.title')}
      </h3>
      <p className="font-medium" data-testid="tax-collection-state">
        {state[outlook]}
      </p>
      <p className="text-sm text-muted-foreground" data-testid="tax-collection-detail">
        {detail[outlook]}
      </p>
      {guestMayPay && (
        <p className="text-sm text-muted-foreground" data-testid="tax-collection-online">
          {t('checkin.wizard.tax.collection.guestMayPay', { amount: money(collection.onlinePayable) })}
        </p>
      )}
      {collection.refundedAmount > 0 && (
        <p className="text-sm text-muted-foreground" data-testid="tax-collection-refunded">
          {t('checkin.wizard.tax.collection.refunded', { amount: money(collection.refundedAmount) })}
        </p>
      )}
      {collection.refundDue > 0 && (
        <Alert variant="warning" title={t('checkin.wizard.tax.collection.refundDueTitle')} data-testid="tax-collection-refund-due">
          {t('checkin.wizard.tax.collection.refundDue', { amount: money(collection.refundDue) })}
        </Alert>
      )}
      {!hasTaxCurrency(collection.currency) && (
        <p className="text-sm text-muted-foreground" data-testid="tax-collection-currency-missing">
          {t('checkin.wizard.tax.collection.currencyMissing')}
        </p>
      )}
      {canRecord && (
        <div className="space-y-1 pt-1">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            loading={recording}
            onClick={onRecordPaidAtProperty}
            data-testid="tax-collection-paid-at-property"
          >
            {t('checkin.wizard.tax.collection.markPaid')}
          </Button>
          <p className="text-xs text-muted-foreground">{t('checkin.wizard.tax.collection.markPaidHint')}</p>
        </div>
      )}
    </section>
  );
}
