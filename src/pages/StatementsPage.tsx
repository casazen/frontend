import { useTranslation } from 'react-i18next';
import { useState, useMemo } from 'react';
import { useStatements } from '@/queries/statements';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Alert } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { StatementDetail } from '@/components/statements/StatementDetail';
import type { OwnerStatement, StatementStatus } from '@/types';

export function StatementsPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<StatementStatus | 'all'>('all');
  const [selectedStatement, setSelectedStatement] = useState<OwnerStatement | null>(null);

  const { data: statements, isLoading, error } = useStatements();

  const filteredStatements = useMemo(() => {
    if (!statements) return [];

    if (statusFilter === 'all') return statements;

    return statements.filter((s) => s.status === statusFilter);
  }, [statements, statusFilter]);

  if (isLoading) {
    return <LoadingScreen message={t('statement.loading')} />;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="danger" title={t('shared.error')} icon={AlertCircle}>
          {t('statement.loadError')}
        </Alert>
      </div>
    );
  }

  if (selectedStatement) {
    return (
      <StatementDetail
        statement={selectedStatement}
        onBack={() => setSelectedStatement(null)}
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('statement.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('statement.description')}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-4 items-end">
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
        <div className="space-y-4">
          {filteredStatements.map((statement) => (
            <div
              key={statement.id}
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
                        {statement.currency} {statement.totalRevenue.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('statement.commission')}:</span>{' '}
                      <span className="font-medium">
                        {statement.currency} {statement.commission.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('statement.netPayable')}:</span>{' '}
                      <span className="font-medium text-green-600">
                        {statement.currency} {statement.netPayable.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedStatement(statement)}
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
