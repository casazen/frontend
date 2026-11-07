import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/shared/error-state';
import { formatDate } from '@/lib/utils';
import { useTenantContracts } from '@/queries/use-tenant-area';
import { tenantContractPath, tenantDuesPath } from './paths';
import { TenantBankDetailsCard } from './tenant-bank-details';
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
      <p data-testid="tenant-no-contracts" className="text-sm text-muted-foreground">
        {t('tenantArea.noContracts')}
      </p>
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
  const nextDue = area.dues.find((due) => due.status !== 'Paid' && due.status !== 'Cancelled') ?? area.dues[0];

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
      {nextDue?.bank ? <TenantBankDetailsCard bank={nextDue.bank} currency={nextDue.currency} /> : null}
      {nextDue ? (
        <Button asChild variant="outline">
          <Link to={tenantDuesPath(area.contract.id, nextDue.id)}>{t('tenantArea.contract.openDue')}</Link>
        </Button>
      ) : null}
    </div>
  );
}

