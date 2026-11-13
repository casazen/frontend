import { useTranslation } from 'react-i18next';
import { useState, useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { AgencyAccessRefused, AgencyFinanceGate } from '@/components/finance/agency-finance-gate';
import { StaleReadNotice } from '@/components/finance/stale-read-notice';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Select } from '@/components/ui/select';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatementDetail } from '@/components/statements/StatementDetail';
import { useExactMoney } from '@/hooks/use-exact-money';
import { getHttpStatus } from '@/lib/api-errors';
import { useStatements } from '@/queries/statements';
import type { StatementStatus } from '@/types';

/**
 * «Rendiconti» of the Amministrazione (E06/F05/US01/T02, NF-25): the monthly statements of the agency's owners with the step each one is at, and for each the
 * real PDF and CSV. Every amount is shown in the currency of its statement, exactly as the server wrote it. The backend gives the statements only to the owner
 * and the administrators of an org on the agency plan, so the role and the plan are checked before anything is read (`AgencyFinanceGate`): for anyone else the
 * page says why, and asks nothing.
 */
export function StatementsPage() {
  const { t } = useTranslation();
  return (
    <AgencyFinanceGate testId="statements-page" title={t('statement.title')} description={t('statement.description')} loadingLabel={t('statement.loading')}>
      <StatementsBody />
    </AgencyFinanceGate>
  );
}

function StatementsBody() {
  const { t } = useTranslation();
  const money = useExactMoney();
  const [statusFilter, setStatusFilter] = useState<StatementStatus | 'all'>('all');
  // The statement on screen is looked up in the list every time it is drawn, never kept as a copy: after a step (or someone else's) the list is read again
  // and the detail shows what the server has, not the state it had when the person opened it.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: statements, isPending, error, isError, refetch } = useStatements();

  const filteredStatements = useMemo(() => {
    if (!statements) return [];

    if (statusFilter === 'all') return statements;

    return statements.filter((s) => s.status === statusFilter);
  }, [statements, statusFilter]);

  const header = <PageHeader title={t('statement.title')} description={t('statement.description')} crumbs="auto" />;
  // A read that failed with the last answer still in memory (a 404 is told before): the old list is drawn, and says it may be out of date.
  const stale = isError && statements !== undefined && statements !== null;

  if (isPending) {
    return (
      <div className="space-y-6" data-testid="statements-page">
        {header}
        <SkeletonCard lines={4} label={t('statement.loading')} />
      </div>
    );
  }

  // A 404 is «not found» whatever the cache still holds (a failed read keeps the old data): the page says so instead of drawing the old list.
  if (isError && (!statements || getHttpStatus(error) === 404)) {
    return (
      <div className="space-y-6" data-testid="statements-page">
        {header}
        <ErrorState
          title={getHttpStatus(error) === 404 ? t('statement.notFound') : t('statement.loadError')}
          error={getHttpStatus(error) === 404 ? undefined : error}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  // The server refuses the list (a 403 the read accepts, so that the app stays here): the access is not there, and nothing of the page is offered.
  if (statements === null) {
    return (
      <div className="space-y-6" data-testid="statements-page">
        {header}
        <AgencyAccessRefused />
      </div>
    );
  }

  if (selectedId) {
    const selected = statements?.find((statement) => statement.id === selectedId);
    if (selected) {
      return (
        <div className="space-y-6">
          {stale && <StaleReadNotice onRetry={() => void refetch()} />}
          <StatementDetail statement={selected} onBack={() => setSelectedId(null)} />
        </div>
      );
    }
    return (
      <div className="space-y-6" data-testid="statements-page">
        {header}
        <Alert variant="warning" title={t('statement.notFound')} action={<Button size="sm" variant="outline" onClick={() => setSelectedId(null)}>{t('shared.back')}</Button>}>
          {t('statement.notFoundHint')}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="statements-page">
      {header}
      {stale && <StaleReadNotice onRetry={() => void refetch()} />}

      <div className="flex flex-wrap gap-4 items-end">
        <div className="w-full sm:w-64">
          <label htmlFor="status-filter" className="text-sm font-medium mb-2 block">
            {t('statement.filter.status')}
          </label>
          <Select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatementStatus | 'all')}
          >
            <option value="all">{t('statement.filter.allStatuses')}</option>
            <option value="Draft">{t('statement.status.draft')}</option>
            <option value="Approved">{t('statement.status.approved')}</option>
            <option value="Published">{t('statement.status.published')}</option>
          </Select>
        </div>
      </div>

      {filteredStatements.length === 0 ? (
        <Alert variant="info" title={t('statement.emptyTitle')} icon={AlertCircle}>
          {statements && statements.length > 0
            ? t('statement.emptyFiltered')
            : t('statement.emptyList')}
        </Alert>
      ) : (
        <div className="space-y-4" data-testid="statements-list">
          {filteredStatements.map((statement) => (
            <div
              key={statement.id}
              data-testid={`statement-row-${statement.id}`}
              className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">
                      {statement.propertyName}
                    </h3>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        statement.status === 'Draft'
                          ? 'bg-gray-100 text-gray-800'
                          : statement.status === 'Approved'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {t(`statement.status.${statement.status.toLowerCase()}`)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {statement.ownerName}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('statement.period')}:</span>{' '}
                      <span className="font-medium">
                        {statement.month}/{statement.year}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('statement.revenue')}:</span>{' '}
                      <span className="font-medium">
                        {money(statement.totalRevenue, statement.currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('statement.commission')}:</span>{' '}
                      <span className="font-medium">
                        {money(statement.commission, statement.currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('statement.netPayable')}:</span>{' '}
                      <span className="font-medium">
                        {money(statement.netPayable, statement.currency)}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedId(statement.id)}
                >
                  {t('statement.viewDetails')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
