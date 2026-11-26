import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CinComplianceTable } from './components/cin-compliance-table';
import { useCinCompliance } from '@/queries/use-admin';

const PAGE_SIZE = 20;

type CinStatusFilter = '' | 'valid' | 'missing' | 'invalid';

export function AdminCinPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const filter = params.get('cinStatus');
  const cinStatus: CinStatusFilter = filter === 'valid' || filter === 'missing' || filter === 'invalid' ? filter : '';
  const rawPage = Number(params.get('page'));
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= Math.floor(2_147_483_647 / PAGE_SIZE) ? rawPage : 1;

  function showPage(value: number, status = cinStatus) {
    const next = new URLSearchParams(params);
    if (status) next.set('cinStatus', status);
    else next.delete('cinStatus');
    if (value > 1) next.set('page', String(value));
    else next.delete('page');
    setParams(next);
  }

  const { data, isLoading, isError, refetch } = useCinCompliance(
    page,
    PAGE_SIZE,
    cinStatus || undefined,
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      {/* The tax rates and the LTR reference data are the tabs of this section, drawn by the header. */}
      <PageHeader title={t('admin.cin.title')} description={t('admin.cin.description')} />

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.cin.filters')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            wrapperClassName="max-w-sm"
            aria-label={t('admin.cin.filters')}
            value={cinStatus}
            onChange={(event) => showPage(1, event.target.value as CinStatusFilter)}
            data-testid="cin-status-filter"
          >
            <option value="">{t('admin.cin.filter.allStatuses')}</option>
            <option value="valid">{t('admin.cin.filter.valid')}</option>
            <option value="missing">{t('admin.cin.filter.missing')}</option>
            <option value="invalid">{t('admin.cin.filter.invalid')}</option>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isError ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-destructive">{t('admin.cin.loadError')}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                {t('admin.cin.retry')}
              </Button>
            </div>
          ) : (
            <>
              <CinComplianceTable items={data?.items ?? []} isLoading={isLoading} />
              {data && (page > 1 || data.totalCount > PAGE_SIZE) && (
                <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {t('admin.cin.pagination', { page, totalPages, totalCount: data.totalCount })}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => showPage(Math.min(page - 1, Math.max(totalPages, 1)))}
                    >
                      {t('admin.cin.previous')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => showPage(page + 1)}
                    >
                      {t('admin.cin.next')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
