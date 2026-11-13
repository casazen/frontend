import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { PlainSection } from '@/components/shared/calm';
import { InvoiceDataSubstep } from '@/components/shared/invoice-data-substep';
import { useWorkspace } from '@/hooks/use-workspace';
import { getCountryOptions } from '@/lib/countries';
import { invoiceDataFormOf, missingIdentification } from '@/lib/invoice-data-schema';
import { useInvoiceData } from '@/queries/use-invoice-data';
import { INVOICE_DATA_SOURCES, type BookingInvoiceData } from '@/types';
import { Fact, Facts } from './booking-facts';

/** The address on one line, the way it is written on an envelope; a country other than Italy is named in the language of the page. */
function addressLine(data: BookingInvoiceData, language: string): string {
  const street = [data.addressStreet, data.addressCivic].filter(Boolean).join(' ');
  const town = [data.postalCode, data.city].filter(Boolean).join(' ');
  const place = data.province ? `${town} (${data.province})` : town;
  const country =
    data.countryCode && data.countryCode !== 'IT'
      ? (getCountryOptions(language).find((option) => option.code === data.countryCode)?.name ?? data.countryCode)
      : '';
  return [street, place.trim(), country].filter(Boolean).join(', ');
}

/**
 * «Dati di fatturazione» in the tab Pagamento of a booking (FIS-01, NF-81): who the invoice is made out to, in words, and where the data comes from
 * («dal tuo channel manager», «dall'ospite al check-in», «modificati da te»), with the button that opens the sub-step where the host checks and
 * corrects it. A guest who asked for an invoice at the check-in is said, and so is what is still missing for the recipient to be identified.
 *
 * It is for who may read payments (`payment.read`: the API refuses the data to the others, so the section is not there for them); who may not
 * write them (`payment.write`) reads the data and finds no button.
 */
export function BookingInvoiceDataSection({ bookingId }: { bookingId: string }) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canRead = hasPermission('short-rent', 'payment.read');
  const canWrite = hasPermission('short-rent', 'payment.write');
  const invoice = useInvoiceData(bookingId, { enabled: canRead });
  const [editing, setEditing] = useState(false);

  // When the sub-step closes the focus goes back to the button that opened it, not to the top of the page.
  const opener = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  useEffect(() => {
    if (editing || !returnFocus.current) return;
    returnFocus.current = false;
    opener.current?.focus();
  }, [editing]);
  const close = () => {
    returnFocus.current = true;
    setEditing(false);
  };

  if (!canRead) return null;

  const data = invoice.data;
  const form = invoiceDataFormOf(data);
  const hasRecipient = Boolean(
    data && [data.name, data.fiscalCode, data.vatNumber, data.addressStreet, data.addressCivic, data.postalCode, data.city, data.sdiRecipientCode, data.pec].some(Boolean),
  );
  const missing = hasRecipient ? missingIdentification(form) : null;
  const source = data?.source !== undefined && (INVOICE_DATA_SOURCES as readonly string[]).includes(data.source) ? data.source : null;
  const address = data ? addressLine(data, i18n.language) : '';
  const company = form.recipientKind === 'Company';

  return (
    <PlainSection title={t('invoiceData.section.title')} data-testid="booking-invoice-data">
      <div className="max-w-xl space-y-3">
        {editing ? (
          <InvoiceDataSubstep bookingId={bookingId} onDone={close} onCancel={close} />
        ) : invoice.isPending ? (
          <p role="status" className="text-sm text-foreground/70" data-testid="booking-invoice-data-loading">
            {t('invoiceData.section.loading')}
          </p>
        ) : invoice.isError ? (
          <div className="flex flex-col items-start gap-2" data-testid="booking-invoice-data-failed">
            <p role="alert" className="text-sm text-destructive">
              {t('invoiceData.section.loadFailed')}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void invoice.refetch()}>
              {t('invoiceData.retry')}
            </Button>
          </div>
        ) : (
          <>
            {data?.invoiceRequested ? (
              <p className="text-sm font-medium" data-testid="booking-invoice-requested">
                {t('invoiceData.section.requested')}
              </p>
            ) : null}

            {hasRecipient ? (
              <>
                <p data-testid="booking-invoice-kind" data-kind={form.recipientKind}>
                  {t(`invoiceData.section.kind.${form.recipientKind}`)}
                </p>
                <Facts>
                  {form.name ? <Fact label={t(`invoiceData.fields.name.${form.recipientKind}`)}>{form.name}</Fact> : null}
                  {form.vatNumber && company ? <Fact label={t('invoiceData.fields.vatNumber.label')}>{form.vatNumber}</Fact> : null}
                  {form.fiscalCode ? <Fact label={t('invoiceData.fields.fiscalCode.label')}>{form.fiscalCode}</Fact> : null}
                  {form.vatNumber && !company ? <Fact label={t('invoiceData.fields.vatNumber.label')}>{form.vatNumber}</Fact> : null}
                  {address ? <Fact label={t('invoiceData.fields.address.legend')}>{address}</Fact> : null}
                  {form.sdiRecipientCode ? <Fact label={t('invoiceData.fields.sdiRecipientCode.label')}>{form.sdiRecipientCode}</Fact> : null}
                  {form.pec ? <Fact label={t('invoiceData.fields.pec.label')}>{form.pec}</Fact> : null}
                </Facts>
                {missing ? (
                  <p className="text-sm text-orange-700" data-testid="booking-invoice-missing" data-field={missing}>
                    {t(`invoiceData.section.missing.${missing === 'vatNumber' ? 'vatNumber' : 'fiscalCode'}`)}
                  </p>
                ) : null}
                {source ? (
                  <p className="text-sm text-foreground/70" data-testid="booking-invoice-source" data-source={source}>
                    {t(`invoiceData.source.${source}`)}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-foreground/70" data-testid="booking-invoice-empty">
                {data?.invoiceRequested ? t('invoiceData.section.requestedNoData') : t('invoiceData.section.empty')}
              </p>
            )}

            {canWrite ? (
              <Button ref={opener} type="button" variant="outline" onClick={() => setEditing(true)} data-testid="booking-invoice-open">
                {hasRecipient ? t('invoiceData.section.edit') : t('invoiceData.section.add')}
              </Button>
            ) : (
              <p className="text-sm text-foreground/70" data-testid="booking-invoice-readonly">
                {t('invoiceData.section.readOnly')}
              </p>
            )}
          </>
        )}
      </div>
    </PlainSection>
  );
}
