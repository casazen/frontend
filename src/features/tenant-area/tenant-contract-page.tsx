import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { FocusBlock } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { formatCurrency, formatDate } from '@/lib/utils';
import { rentBreakdown } from '@/features/leases/lib/rent-breakdown';
import { useTenantContracts } from '@/queries/use-tenant-area';
import type { TenantDue } from '@/types';
import { withoutUnacceptedExtraordinary } from './lib/extraordinary';
import { tenantContractPath, tenantDuesPath } from './paths';
import { TenantGate, TenantLoading } from './tenant-gate';
import { useTenantContractPage } from './use-tenant-contract';

export function TenantContractsPage() {
  const { t } = useTranslation();
  const contracts = useTenantContracts();

  if (contracts.isLoading) return <TenantLoading />;
  if (contracts.isError) {
    return <ErrorState title={t('tenantArea.loadError')} error={contracts.error} onRetry={() => void contracts.refetch()} testId="tenant-error" />;
  }

  const items = contracts.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title={t('tenantArea.nav.contracts')} />
      {items.length === 0 ? (
        <div data-testid="tenant-no-contracts">
          <EmptyState icon={FileText} title={t('tenantArea.noContracts')} description={t('tenantArea.noContractsHint')} />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2" data-testid="tenant-contracts">
          {items.map((contract) => (
            <li key={contract.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{contract.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">{contract.propertyName}</p>
                  <Button asChild size="sm">
                    <Link to={tenantContractPath(contract.id)}>{t('tenantArea.openContract')}</Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TenantContractPage() {
  const { t } = useTranslation();
  const contract = useTenantContractPage();
  if (contract.status !== 'ready') return <TenantGate status={contract.status} error={contract.error} refetch={contract.refetch} />;
  const area = contract.area;
  const openDues = area.dues.map(withoutUnacceptedExtraordinary).filter((due) => due.status !== 'Paid' && due.status !== 'Cancelled');
  const payable = openDues.find((due) => rentBreakdown(due).residual > 0.01);
  const openDue = openDues[0];
  const term = area.contract.startDate
    ? t('tenantArea.contract.term', {
        from: formatDate(area.contract.startDate),
        to: area.contract.endDate ? formatDate(area.contract.endDate) : t('tenantArea.contract.openEnd'),
      })
    : null;

  // The head of every page (UX round 2026-11): the contract, then the house, its address and the term in one line of facts; under it
  // the one thing to do, the next payment.
  return (
    <div className="space-y-6" data-testid="tenant-contract">
      <PageHeader title={area.contract.label} description={[area.property.name, area.property.address, term].filter(Boolean).join(' · ')} />
      {payable ? (
        <NextPayment leaseId={area.contract.id} due={payable} />
      ) : openDue ? (
        <Button asChild variant="outline">
          <Link to={tenantDuesPath(area.contract.id, openDue.id)}>{t('tenantArea.contract.openDue')}</Link>
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="tenant-contract-no-payment">
          {t('tenantArea.contract.noPayment')}
        </p>
      )}
    </div>
  );
}

/** The contract names the next amount, as the one block of the page (a late one in the tone of a warning). The payment itself stays on Canoni. */
function NextPayment({ leaseId, due }: { leaseId: string; due: TenantDue }) {
  const { t } = useTranslation();
  return (
    <FocusBlock
      data-testid="tenant-contract-next"
      tone={due.isOverdue ? 'warning' : 'neutral'}
      kicker={t('tenantArea.contract.nextDue')}
      title={`${formatDate(due.dueDate)} · ${formatCurrency(rentBreakdown(due).residual, due.currency)}`}
      when={due.isOverdue ? t('tenantArea.dues.overdue') : undefined}
      primary={{ label: t('tenantArea.contract.payDue'), href: tenantDuesPath(leaseId, due.id) }}
    />
  );
}
