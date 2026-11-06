import { useId } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { formatStayDate } from '@/lib/stay-dates';
import type { TouristTaxRemittance } from '@/types';
import { formatCents } from './tourist-tax-model';

const SHORT_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

interface RemittanceListProps {
  comune: string;
  /** The payments of the comune that the summary lists (oldest period first), as the server sends them. */
  remittances: readonly TouristTaxRemittance[];
  /** The person may delete a payment (`payment.write`); the server decides again. */
  canWrite: boolean;
  /** The payment whose receipt is on its way: its button waits. */
  downloadingId: string | null;
  onDownloadReceipt: (remittance: TouristTaxRemittance) => void;
  onDelete: (remittance: TouristTaxRemittance) => void;
}

/**
 * The payments of one comune (NF-100): the amount, the period it pays, the day it was paid and the reference, with the receipt to
 * download and, for who may write payments, the button that deletes a wrong entry. The page asks for the confirmation; this list
 * only says which payment the person chose.
 */
export function RemittanceList({ comune, remittances, canWrite, downloadingId, onDownloadReceipt, onDelete }: RemittanceListProps) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const date = (value: string) => formatStayDate(value, i18n.language, SHORT_DATE);

  return (
    <div className="rounded-md bg-muted/40 p-3" data-testid="tourist-tax-remittances">
      <p id={titleId} className="text-sm font-medium">
        {t('reports.touristTax.remittances.title', { comune })}
      </p>
      <ul aria-labelledby={titleId} className="mt-1 divide-y divide-border">
        {remittances.map((remittance) => {
          const amount = formatCents(remittance.amountCents, i18n.language);
          const paidOn = date(remittance.paidOn);
          const details = [
            t('reports.touristTax.remittances.period', { from: date(remittance.periodFrom), to: date(remittance.periodTo) }),
            t('reports.touristTax.remittances.paidOn', { date: paidOn }),
            ...(remittance.reference ? [t('reports.touristTax.remittances.reference', { reference: remittance.reference })] : []),
          ];

          return (
            <li
              key={remittance.id}
              className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-2"
              data-testid="tourist-tax-remittance"
            >
              <div className="min-w-0 text-sm">
                <p className="font-medium tabular-nums">{amount}</p>
                <p className="break-words text-foreground/70">{details.join(' · ')}</p>
                {remittance.notes ? <p className="break-words text-foreground/70">{remittance.notes}</p> : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {remittance.hasReceipt ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={downloadingId === remittance.id}
                    aria-label={t('reports.touristTax.remittances.receiptLabel', { amount, date: paidOn })}
                    onClick={() => onDownloadReceipt(remittance)}
                    data-testid="tourist-tax-receipt"
                  >
                    <Download aria-hidden="true" className="size-4" />
                    {t('reports.touristTax.remittances.receipt')}
                  </Button>
                ) : (
                  <span className="text-sm text-foreground/70" data-testid="tourist-tax-no-receipt">
                    {t('reports.touristTax.remittances.noReceipt')}
                  </span>
                )}
                {canWrite ? (
                  <Button
                    type="button"
                    variant="danger-outline"
                    size="sm"
                    aria-label={t('reports.touristTax.remittances.delete.label', { amount, date: paidOn })}
                    onClick={() => onDelete(remittance)}
                    data-testid="tourist-tax-delete"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    {t('reports.touristTax.remittances.delete.button')}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
