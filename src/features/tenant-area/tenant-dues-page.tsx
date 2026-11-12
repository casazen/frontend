import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Receipt } from 'lucide-react';
import { RentComposition } from '@/features/leases/components/rent-composition';
import { rentBreakdown, type RentBreakdown } from '@/features/leases/lib/rent-breakdown';
import { bankLinkDebitAvailable } from '@/features/bank-transfer/bank-link-currency';
import { TenantSepaSettings, TenantSepaPayment } from './tenant-sepa';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/shared/empty-state';
import { getProblemMessage } from '@/lib/api-errors';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { todayInZurich } from '@/lib/stay-dates';
import { useDeclareTransfer } from '@/queries/use-tenant-area';
import type { TenantDue, TenantPaymentDeclaration } from '@/types';
import { TenantBankDetailsCard } from './tenant-bank-details';
import { TenantGate } from './tenant-gate';
import { withoutUnacceptedExtraordinary } from './lib/extraordinary';
import { tenantDuesPath } from './paths';
import { useTenantContractPage } from './use-tenant-contract';

const PAY_BUTTON = 'h-auto min-h-11 w-full whitespace-normal sm:w-auto';

/** Below one cent the due is settled: a credit that covers the installment is not a payment to start. */
const CENT = 0.01;

function notable(value: number | null): value is number {
  return value !== null && Math.abs(value) >= CENT;
}

function closedDue(due: TenantDue): boolean {
  return due.status === 'Paid' || due.status === 'Cancelled';
}

function settledDue(parts: RentBreakdown): boolean {
  return parts.residual <= CENT;
}

function dueStatusKey(status: string): string {
  return ['Scheduled', 'Processing', 'Paid', 'Failed', 'Cancelled'].includes(status) ? status : 'Scheduled';
}

export function TenantDuesPage() {
  const { t } = useTranslation();
  const { dueId } = useParams();
  const page = useTenantContractPage();
  if (page.status !== 'ready') return <TenantGate status={page.status} error={page.error} refetch={page.refetch} />;
  const area = page.area;
  const dues = area.dues.map(withoutUnacceptedExtraordinary);
  const selected = dueId ? dues.find((due) => due.id === dueId) : undefined;
  const next = dues.find((due) => {
    if (closedDue(due)) return false;
    return !settledDue(rentBreakdown(due));
  });

  return (
    <div className="space-y-4" data-testid="tenant-dues">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{t('tenantArea.dues.title')}</h1>
        <p className="text-sm text-foreground/70">{t('tenantArea.dues.lead')}</p>
      </header>
      <TenantSepaSettings leaseId={area.contract.id} />
      {dues.length > 0 ? <PaymentReport dues={dues} /> : null}
      {dues.length === 0 ? (
        <div data-testid="tenant-dues-empty">
          <EmptyState icon={Receipt} title={t('tenantArea.dues.emptyTitle')} description={t('tenantArea.dues.emptyDescription')} />
        </div>
      ) : (
        <ul className="min-w-0 space-y-2" aria-label={t('tenantArea.dues.listLabel')}>
          {dues.map((due) => (
            <TenantDueRow key={due.id} leaseId={area.contract.id} due={due} current={selected?.id === due.id} />
          ))}
        </ul>
      )}
      {dueId && !selected ? (
        <p role="alert" data-testid="tenant-due-missing" className="text-sm">
          {t('tenantArea.dues.missing')}{' '}
          <Link to={tenantDuesPath(area.contract.id)} className="font-medium text-primary underline underline-offset-2">
            {t('tenantArea.dues.backToList')}
          </Link>
        </p>
      ) : null}
      {!selected && next ? <NextDue leaseId={area.contract.id} due={next} /> : null}
      {selected ? <TenantDueDetail key={selected.id} leaseId={area.contract.id} due={selected} /> : null}
    </div>
  );
}

function PaymentReport({ dues }: { dues: TenantDue[] }) {
  const { t } = useTranslation();
  const currency = dues[0]?.currency ?? 'EUR';
  const open = dues.filter((due) => !closedDue(due) && !settledDue(rentBreakdown(due)));
  const paid = dues.filter((due) => due.status === 'Paid');
  const openSum = open.reduce((total, due) => total + rentBreakdown(due).residual, 0);
  const paidSum = paid.reduce((total, due) => total + rentBreakdown(due).paid, 0);

  return (
    <section aria-labelledby="tenant-report-title" data-testid="tenant-payment-report" className="grid min-w-0 grid-cols-2 gap-3">
      <h2 id="tenant-report-title" className="sr-only">
        {t('tenantArea.dues.reportTitle')}
      </h2>
      <div className="min-w-0 rounded-md border border-border p-3">
        <p className="text-sm text-foreground/70">{t('tenantArea.dues.reportOpen')}</p>
        <p className="break-words text-lg font-semibold" data-testid="tenant-report-open">
          {formatCurrency(openSum, currency)}
        </p>
        <p className="text-sm text-foreground/70">{t('tenantArea.dues.reportCount', { count: open.length })}</p>
      </div>
      <div className="min-w-0 rounded-md border border-border p-3">
        <p className="text-sm text-foreground/70">{t('tenantArea.dues.reportPaid')}</p>
        <p className="break-words text-lg font-semibold" data-testid="tenant-report-paid">
          {formatCurrency(paidSum, currency)}
        </p>
        <p className="text-sm text-foreground/70">{t('tenantArea.dues.reportCount', { count: paid.length })}</p>
      </div>
    </section>
  );
}

function TenantDueRow({ leaseId, due, current }: { leaseId: string; due: TenantDue; current: boolean }) {
  const { t } = useTranslation();
  const parts = rentBreakdown(due);
  const line = compositionLine(due, parts, {
    rent: t('rent.composition.rent'),
    advance: t('rent.composition.advance'),
    settlement: t('rent.composition.settlement'),
  });
  const late = !closedDue(due) && !settledDue(parts) && due.isOverdue;

  return (
    <li>
      <Link
        to={tenantDuesPath(leaseId, due.id)}
        aria-current={current ? 'page' : undefined}
        className={cn(
          'block min-w-0 rounded-md border p-3 hover:bg-muted',
          current ? 'border-primary bg-muted' : 'border-border',
        )}
        data-testid={`tenant-due-${due.id}`}
      >
        <span className="flex min-w-0 items-baseline justify-between gap-3">
          <span className="font-medium">{formatDate(due.dueDate)}</span>
          <span className="shrink-0 font-medium">{formatCurrency(parts.residual, due.currency)}</span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-foreground/70">
          <span>{t(`tenantArea.dues.status.${dueStatusKey(due.status)}`)}</span>
          {late ? (
            <span className="font-medium text-danger-foreground" data-testid={`tenant-due-late-${due.id}`}>
              {t('tenantArea.dues.overdue')}
            </span>
          ) : null}
        </span>
        {line ? <span className="mt-1 block break-words text-sm text-foreground/70">{line}</span> : null}
      </Link>
    </li>
  );
}

function compositionLine(
  due: TenantDue,
  parts: RentBreakdown,
  labels: { rent: string; advance: string; settlement: string },
): string | null {
  const bits: string[] = [];
  if (parts.rent !== null) bits.push(`${labels.rent} ${formatCurrency(parts.rent, due.currency)}`);
  if (notable(parts.condominiumAdvance)) bits.push(`${labels.advance} ${formatCurrency(parts.condominiumAdvance, due.currency)}`);
  if (notable(parts.condominiumSettlement)) bits.push(`${labels.settlement} ${formatCurrency(parts.condominiumSettlement, due.currency)}`);
  return bits.length > 0 ? bits.join(' · ') : null;
}

function NextDue({ leaseId, due }: { leaseId: string; due: TenantDue }) {
  const { t } = useTranslation();
  const parts = rentBreakdown(due);
  return (
    <Card data-testid="tenant-next-due">
      <CardHeader>
        <CardTitle className="text-base">{t('tenantArea.dues.nextTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          {formatDate(due.dueDate)} · {formatCurrency(parts.residual, due.currency)}
        </p>
        <Button asChild className={PAY_BUTTON}>
          <Link to={tenantDuesPath(leaseId, due.id)}>{t('tenantArea.dues.pay')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function TenantDueDetail({ leaseId, due }: { leaseId: string; due: TenantDue }) {
  const { t } = useTranslation();
  const declare = useDeclareTransfer(leaseId, due.id);
  const declaration = declare.data ?? due.declaration;
  const parts = rentBreakdown(due);
  const closed = closedDue(due);
  const settled = settledDue(parts);
  const canPay = !closed && !settled;
  const canDeclare = canPay && (!declaration || declaration.status === 'Rejected' || declaration.status === 'Superseded');

  const euro = bankLinkDebitAvailable(due.currency);
  const showStripe = canPay && euro && (due.status === 'Scheduled' || due.status === 'Failed');
  const showManual = canPay;

  return (
    <div className="space-y-4" data-testid="tenant-due-detail">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('tenantArea.dues.period', { from: formatDate(due.periodStart), to: formatDate(due.periodEnd) })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p data-testid="tenant-due-amount">
            <span className="text-foreground/70">{t('tenantArea.dues.residual')}</span>{' '}
            <span className="text-lg font-semibold">{formatCurrency(parts.residual, due.currency)}</span>
          </p>
          <p data-testid="tenant-due-status">{t(`tenantArea.dues.status.${dueStatusKey(due.status)}`)}</p>
          {canPay && due.isOverdue ? (
            <p className="text-sm font-medium text-danger-foreground" data-testid="tenant-due-overdue">
              {t('tenantArea.dues.overdue')}
            </p>
          ) : null}
          {due.status === 'Failed' ? (
            <p role="alert" className="text-sm" data-testid="tenant-due-failed">
              {t('tenantArea.dues.failedHint')}
            </p>
          ) : null}
          {due.status === 'Processing' ? (
            <p className="text-sm text-foreground/70" data-testid="tenant-due-processing">
              {t('tenantArea.dues.processingHint')}
            </p>
          ) : null}
          <RentComposition row={due} currency={due.currency} />
          {notable(parts.condominiumAdvance) ? (
            <p className="text-sm text-foreground/70" data-testid="tenant-advance-note">
              {t('tenantArea.dues.advanceNote')}
            </p>
          ) : null}
          {notable(parts.condominiumSettlement) ? (
            <p className="text-sm text-foreground/70" data-testid="tenant-settlement-note">
              {parts.condominiumSettlement > 0 ? t('tenantArea.dues.settlementDebt') : t('tenantArea.dues.settlementCredit')}
            </p>
          ) : null}
          {settled && !closed ? (
            <p data-testid="tenant-due-settled">{t('tenantArea.dues.inBalance')}</p>
          ) : null}
        </CardContent>
      </Card>
      {showStripe ? (
        <section className="space-y-2" aria-labelledby="tenant-sepa-title" data-testid="tenant-sepa">
          <h2 id="tenant-sepa-title" className="text-base font-semibold">
            {t('tenantArea.dues.sepaTitle')}
          </h2>
          <p className="text-sm text-foreground/70">{t('tenantArea.dues.sepaHint')}</p>
          <TenantSepaPayment leaseId={leaseId} dueId={due.id} amount={parts.residual} currency={due.currency} />
        </section>
      ) : null}
      {canPay && !euro ? (
        <p role="status" className="text-sm" data-testid="tenant-sepa-unavailable">
          {t('tenantArea.dues.sepaEuroOnly')}
        </p>
      ) : null}
      {showManual ? (
        <section className="space-y-3" aria-labelledby="tenant-manual-title" data-testid="tenant-manual">
          <h2 id="tenant-manual-title" className="text-base font-semibold">
            {t('tenantArea.dues.manualTitle')}
          </h2>
          <p className="text-sm text-foreground/70">{t('tenantArea.dues.manualHint')}</p>
          {due.bank ? <TenantBankDetailsCard bank={due.bank} currency={due.currency} /> : (
            <p role="status" className="text-sm" data-testid="tenant-no-bank">
              {t('tenantArea.dues.noBank')}
            </p>
          )}
          {declaration ? <DeclarationStatus declaration={declaration} /> : null}
          {declare.isError ? (
            <p role="alert" className="text-sm text-destructive" data-testid="tenant-declaration-error">
              {getProblemMessage(declare.error, t) ?? t('tenantArea.declaration.failed')}
            </p>
          ) : null}
          {canDeclare ? (
            <DeclarationForm key={due.id} due={due} onSubmit={(input) => declare.mutate(input)} pending={declare.isPending} />
          ) : null}
          {canDeclare ? (
            <p className="text-sm text-muted-foreground" data-testid="tenant-declaration-note">
              {t('tenantArea.declaration.notPaid')}
            </p>
          ) : null}
        </section>
      ) : declaration ? (
        <DeclarationStatus declaration={declaration} />
      ) : null}
    </div>
  );
}

function DeclarationStatus({ declaration }: { declaration: TenantPaymentDeclaration }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <p data-testid="tenant-declaration-status" className="rounded-md border border-border px-3 py-2 text-sm">
        {t(`tenantArea.declaration.status.${declaration.status}`)}
      </p>
      {declaration.status === 'Rejected' ? (
        <p className="text-sm text-foreground/70" data-testid="tenant-declaration-rejected">
          {t('tenantArea.declaration.rejectedHint')}
        </p>
      ) : null}
    </div>
  );
}

function DeclarationForm({
  due,
  onSubmit,
  pending,
}: {
  due: TenantDue;
  onSubmit: (input: { amount: number; transferDate: string; bankReference?: string; note?: string; receipt?: File | null }) => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const parts = rentBreakdown(due);
  const [amount, setAmount] = useState(String(due.bank?.amount ?? parts.residual));
  const [transferDate, setTransferDate] = useState(() => todayInZurich());
  const [bankReference, setBankReference] = useState('');
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const parsed = Number(amount.replace(',', '.'));
  const valid = Number.isFinite(parsed) && parsed > 0 && transferDate !== '';

  return (
    <form
      className="min-w-0 space-y-3"
      data-testid="tenant-declaration-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid || pending) return;
        onSubmit({
          amount: parsed,
          transferDate,
          bankReference: bankReference.trim() || undefined,
          note: note.trim() || undefined,
          receipt,
        });
      }}
    >
      <div className="min-w-0 space-y-1">
        <Label htmlFor="tenant-declaration-amount">{t('tenantArea.declaration.amount')}</Label>
        <Input id="tenant-declaration-amount" className="w-full min-w-0 max-w-full" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </div>
      <div className="min-w-0 space-y-1">
        <Label htmlFor="tenant-declaration-date">{t('tenantArea.declaration.date')}</Label>
        <Input id="tenant-declaration-date" className="w-full min-w-0 max-w-full" type="date" value={transferDate} onChange={(event) => setTransferDate(event.target.value)} />
      </div>
      <div className="min-w-0 space-y-1">
        <Label htmlFor="tenant-declaration-reference">{t('tenantArea.declaration.reference')}</Label>
        <Input id="tenant-declaration-reference" className="w-full min-w-0 max-w-full" value={bankReference} onChange={(event) => setBankReference(event.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tenant-declaration-note">{t('tenantArea.declaration.note')}</Label>
        <Textarea id="tenant-declaration-note" value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tenant-declaration-receipt">{t('tenantArea.declaration.receipt')}</Label>
        <Input
          id="tenant-declaration-receipt"
          className="w-full min-w-0 max-w-full"
          type="file"
          accept="image/*,.pdf"
          onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}
        />
      </div>
      <Button type="submit" disabled={!valid || pending} className={PAY_BUTTON} data-testid="tenant-declare-transfer">
        {t('tenantArea.declaration.submit')}
      </Button>
    </form>
  );
}
