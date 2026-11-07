import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RentComposition } from '@/features/leases/components/rent-composition';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/utils';
import { todayInZurich } from '@/lib/stay-dates';
import { useDeclareTransfer } from '@/queries/use-tenant-area';
import type { TenantDue, TenantPaymentDeclaration } from '@/types';
import { rentBreakdown } from '@/features/leases/lib/rent-breakdown';
import { TenantBankDetailsCard } from './tenant-bank-details';
import { TenantGate } from './tenant-gate';
import { tenantDuesPath } from './paths';
import { useTenantContractPage } from './use-tenant-contract';

export function TenantDuesPage() {
  const { t } = useTranslation();
  const { dueId } = useParams();
  const page = useTenantContractPage();
  if (page.status !== 'ready') return <TenantGate status={page.status} error={page.error} refetch={page.refetch} />;
  const area = page.area;
  const selected = dueId ? area.dues.find((due) => due.id === dueId) : undefined;

  return (
    <div className="space-y-4" data-testid="tenant-dues">
      <ul className="space-y-2">
        {area.dues.length === 0 ? <li className="text-sm text-muted-foreground">{t('tenantArea.dues.empty')}</li> : null}
        {area.dues.map((due) => (
          <li key={due.id}>
            <Link
              to={tenantDuesPath(area.contract.id, due.id)}
              className="block rounded-md border border-border p-3 hover:bg-muted"
              data-testid={`tenant-due-${due.id}`}
            >
              <span className="font-medium">{formatDate(due.dueDate)}</span>
              <span className="ml-2 text-sm text-foreground/70">{t(`tenantArea.dues.status.${dueStatusKey(due.status)}`)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {selected ? <TenantDueDetail leaseId={area.contract.id} due={selected} /> : null}
    </div>
  );
}

function dueStatusKey(status: string): string {
  return ['Scheduled', 'Processing', 'Paid', 'Failed', 'Cancelled'].includes(status) ? status : 'Scheduled';
}

function TenantDueDetail({ leaseId, due }: { leaseId: string; due: TenantDue }) {
  const { t } = useTranslation();
  const declare = useDeclareTransfer(leaseId, due.id);
  const declaration = declare.data ?? due.declaration;
  const canDeclare = !declaration || declaration.status === 'Rejected' || declaration.status === 'Superseded';

  return (
    <div className="space-y-4" data-testid="tenant-due-detail">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('tenantArea.dues.period', { from: formatDate(due.periodStart), to: formatDate(due.periodEnd) })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p data-testid="tenant-due-status">{t(`tenantArea.dues.status.${dueStatusKey(due.status)}`)}</p>
          <RentComposition row={due} currency={due.currency} />
        </CardContent>
      </Card>
      {due.bank ? <TenantBankDetailsCard bank={due.bank} currency={due.currency} /> : null}
      {declaration ? <DeclarationStatus declaration={declaration} /> : null}
      {canDeclare ? <DeclarationForm due={due} onSubmit={(input) => declare.mutate(input)} pending={declare.isPending} /> : null}
      <p className="text-sm text-muted-foreground" data-testid="tenant-declaration-note">
        {t('tenantArea.declaration.notPaid')}
      </p>
    </div>
  );
}

function DeclarationStatus({ declaration }: { declaration: TenantPaymentDeclaration }) {
  const { t } = useTranslation();
  return (
    <p data-testid="tenant-declaration-status" className="rounded-md border border-border px-3 py-2 text-sm">
      {t(`tenantArea.declaration.status.${declaration.status}`)}
    </p>
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
      className="space-y-3"
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
      <div className="space-y-1">
        <Label htmlFor="tenant-declaration-amount">{t('tenantArea.declaration.amount')}</Label>
        <Input id="tenant-declaration-amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tenant-declaration-date">{t('tenantArea.declaration.date')}</Label>
        <Input id="tenant-declaration-date" type="date" value={transferDate} onChange={(event) => setTransferDate(event.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tenant-declaration-reference">{t('tenantArea.declaration.reference')}</Label>
        <Input id="tenant-declaration-reference" value={bankReference} onChange={(event) => setBankReference(event.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tenant-declaration-note">{t('tenantArea.declaration.note')}</Label>
        <Textarea id="tenant-declaration-note" value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tenant-declaration-receipt">{t('tenantArea.declaration.receipt')}</Label>
        <Input
          id="tenant-declaration-receipt"
          type="file"
          accept="image/*,.pdf"
          onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}
        />
      </div>
      <Button type="submit" disabled={!valid || pending} data-testid="tenant-declare-transfer">
        {t('tenantArea.declaration.submit')}
      </Button>
    </form>
  );
}
