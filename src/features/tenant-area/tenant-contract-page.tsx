import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
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
import { TenantGate } from './tenant-gate';
import { useTenantContractPage } from './use-tenant-contract';

export function TenantContractsPage() {
  const { t } = useTranslation();
  const contracts = useTenantContracts();

  if (contracts.isLoading) return <p data-testid="tenant-loading">{t('tenantArea.loading')}</p>;
  if (contracts.isError) {
    return <ErrorState title={t('tenantArea.loadError')} error={contracts.error} onRetry={() => void contracts.refetch()} testId="tenant-error" />;
  }

  const items = contracts.data ?? [];
  if (items.length === 0) {
    return (
      <div data-testid="tenant-no-contracts">
        <EmptyState icon={FileText} title={t('tenantArea.noContracts')} description={t('tenantArea.noContractsHint')} />
      </div>
    );
  }

  return (
    <ul className="space-y-3" data-testid="tenant-contracts">
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

  return (
    <div className="space-y-4" data-testid="tenant-contract">
      <Card>
        <CardHeader>
          <CardTitle>{area.contract.label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p data-testid="tenant-property">{area.property.name}</p>
          {area.property.address ? <p>{area.property.address}</p> : null}
          {area.contract.startDate ? (
            <p>
              {t('tenantArea.contract.term', {
                from: formatDate(area.contract.startDate),
                to: area.contract.endDate ? formatDate(area.contract.endDate) : t('tenantArea.contract.openEnd'),
              })}
            </p>
          ) : null}
        </CardContent>
      </Card>
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

/** The contract names the next amount. The payment itself stays on Canoni. */
function NextPayment({ leaseId, due }: { leaseId: string; due: TenantDue }) {
  const { t } = useTranslation();
  return (
    <Card data-testid="tenant-contract-next">
      <CardHeader>
        <CardTitle className="text-base">{t('tenantArea.contract.nextDue')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          {formatDate(due.dueDate)} · {formatCurrency(rentBreakdown(due).residual, due.currency)}
        </p>
        <Button asChild className="h-auto min-h-11 w-full whitespace-normal sm:w-auto">
          <Link to={tenantDuesPath(leaseId, due.id)}>{t('tenantArea.contract.payDue')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

