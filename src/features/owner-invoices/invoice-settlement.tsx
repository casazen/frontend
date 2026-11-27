import { useTranslation } from 'react-i18next';
import type { OwnerInvoiceListItem } from '@/types';
import { settlementOf } from './owner-invoice-model';
import { useInvoiceMoney } from './use-invoice-money';

/**
 * How an issued invoice is paid, in words: offset in the statement, to pay with the amount, or credited. Nothing for a draft, which has no payment, and never «paid»: a state this app
 * does not know is told by its code.
 */
export function InvoiceSettlement({ invoice }: { invoice: Pick<OwnerInvoiceListItem, 'creditedInFull' | 'payment' | 'currency'> }) {
  const { t } = useTranslation();
  const money = useInvoiceMoney();
  const settlement = settlementOf(invoice);
  if (settlement === null) return null;

  switch (settlement.kind) {
    case 'offset':
      return <span data-testid="invoice-settlement" data-state="offset">{t('ownerInvoice.settlement.offset')}</span>;
    case 'toPay':
      return (
        <span data-testid="invoice-settlement" data-state="to_pay">
          {t('ownerInvoice.settlement.toPay', { amount: money(settlement.amountDue, invoice.currency) })}
        </span>
      );
    case 'credited':
      return <span data-testid="invoice-settlement" data-state="credited">{t('ownerInvoice.settlement.credited')}</span>;
    default:
      return (
        <span data-testid="invoice-settlement" data-state="unknown">
          {t('ownerInvoice.settlement.unknown', { state: settlement.state })}
        </span>
      );
  }
}
