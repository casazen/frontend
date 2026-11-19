import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getHttpStatus } from '@/lib/api-errors';
import { useOwnerInvoice } from '@/queries/use-owner-invoices';
import type { OwnerInvoice } from '@/types';
import { OwnerAccountingError } from '@/features/owner-accounting/components/owner-accounting-error';
import { shortId } from '@/features/owner-accounting/owner-accounting-model';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import { InvoiceLines } from './invoice-lines';
import { isDraft, isIssued } from './owner-invoice-model';
import { hasNoCurrency } from './use-invoice-money';

interface OwnerInvoiceDrawerProps {
  /** The invoice to open; `null` closes the drawer, and nothing is read while it is closed. */
  invoiceId: string | null;
  onClose: () => void;
}

/**
 * One invoice of the agency to an owner, opened by its id (`GET api/owner-invoices/{id}`): its lines with their VAT by rate and its totals, whether it is a draft or already issued. It reads only,
 * and opening it never makes, makes again or issues anything. The invoice that is no longer there (404) and the one the person may not see (403) are told as such, in words, and an
 * invoice read earlier is never drawn over them; a failed read says so and offers to read again, never an empty drawer.
 */
export function OwnerInvoiceDrawer({ invoiceId, onClose }: OwnerInvoiceDrawerProps) {
  return (
    <Sheet open={invoiceId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl" data-testid="owner-invoice-drawer">
        {invoiceId !== null ? <DrawerBody invoiceId={invoiceId} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ invoiceId }: { invoiceId: string }) {
  const { t } = useTranslation();
  const { month } = useOwnerFormat();
  const query = useOwnerInvoice(invoiceId);
  const invoice = query.data ?? null;

  let title = t('ownerInvoice.detail.title');
  let description = t('ownerInvoice.detail.description');
  let content;
  if (getHttpStatus(query.error) === 404) {
    // A 404 is the invoice that is no longer there, whatever the cache still holds from an earlier read (a failed read keeps the old data).
    content = (
      <Alert variant="warning" role="alert" title={t('ownerInvoice.detail.notFound')} data-testid="owner-invoice-detail-not-found">
        {t('ownerInvoice.detail.notFoundBody')}
      </Alert>
    );
  } else if (query.isPending) {
    content = (
      <p role="status" className="text-sm text-foreground/70">
        {t('ownerInvoice.panel.loading')}
      </p>
    );
  } else if (query.isError) {
    content = <OwnerAccountingError error={query.error} title={t('ownerInvoice.panel.loadError')} onRetry={() => void query.refetch()} />;
  } else if (invoice === null) {
    // The server refused the read to this person (403): the access is not there, and nothing is drawn in its place.
    content = (
      <Alert variant="warning" role="alert" title={t('ownerInvoice.detail.forbiddenTitle')} data-testid="owner-invoice-detail-forbidden">
        {t('ownerInvoice.detail.forbidden')}
      </Alert>
    );
  } else {
    title = invoice.number ? t('ownerInvoice.page.row.number', { number: invoice.number }) : t('ownerInvoice.page.row.draft');
    description = ownerAndPeriodOf(invoice, t, month);
    content = <InvoiceDetail invoice={invoice} />;
  }

  return (
    <div className="space-y-5 pb-6">
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>{description}</SheetDescription>
      </SheetHeader>
      <div className="space-y-4 px-6" data-testid="owner-invoice-detail">
        {content}
      </div>
    </div>
  );
}

/** «Marta Rossi · novembre 2026»: whose invoice it is and for which month, from what the server sent (an owner without a name by the start of its id, a month it does not give is left out). */
function ownerAndPeriodOf(invoice: OwnerInvoice, t: ReturnType<typeof useTranslation>['t'], month: (year: number, month: number) => string): string {
  const owner = invoice.ownerName?.trim() || (invoice.ownerId ? t('ownerAccounting.owner.unnamed', { id: shortId(invoice.ownerId) }) : '');
  const period = invoice.periodYear !== null && invoice.periodMonth !== null ? month(invoice.periodYear, invoice.periodMonth) : '';
  return [owner, period].filter(Boolean).join(' · ') || t('ownerInvoice.detail.description');
}

function InvoiceDetail({ invoice }: { invoice: OwnerInvoice }) {
  const { t } = useTranslation();
  const { date } = useOwnerFormat();

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {invoice.creditedInFull ? (
          <Badge variant="outline">{t('ownerInvoice.status.Credited')}</Badge>
        ) : isDraft(invoice) ? (
          <Badge variant="warning">{t('ownerInvoice.status.Draft')}</Badge>
        ) : isIssued(invoice) ? (
          <Badge variant="success">{t('ownerInvoice.status.Issued')}</Badge>
        ) : (
          // A state of a later server: told by its code, never as an invoice that is complete.
          <Badge variant="outline">{invoice.status}</Badge>
        )}
        {invoice.kind === 'CreditNote' ? <Badge variant="outline">{t('ownerInvoice.detail.creditNote')}</Badge> : null}
        {isIssued(invoice) && invoice.issueDate ? <span className="break-words">{t('ownerInvoice.detail.issuedOn', { date: date(invoice.issueDate) })}</span> : null}
      </div>
      {hasNoCurrency(invoice) ? (
        <p className="break-words text-sm text-foreground/70" data-testid="owner-invoice-detail-currency-missing">
          {t('ownerInvoice.currencyMissing')}
        </p>
      ) : null}
      <InvoiceLines invoice={invoice} />
    </>
  );
}
