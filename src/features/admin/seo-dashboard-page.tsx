import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useApproveAllSeoDrafts,
  useGenerateSeoPages,
  usePlatformAiBudget,
  useSeoComuni,
  useSeoPages,
  useUpdateSeoReviewStatus,
} from '@/queries/use-admin-seo';
import { SeoReviewStatusBadge } from './components/seo-review-status-badge';
import { formatDate } from '@/lib/utils';

export function SeoDashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useSeoPages({ page: 1, pageSize: 50 });
  const { data: comuni } = useSeoComuni();
  const { data: budget } = usePlatformAiBudget();
  const generateMutation = useGenerateSeoPages();
  const reviewMutation = useUpdateSeoReviewStatus();
  const approveAllMutation = useApproveAllSeoDrafts();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const comuneCount = comuni?.length ?? 0;

  async function handleRegenerate() {
    setConfirmOpen(false);
    await generateMutation.mutateAsync({
      comuneCodes: [],
      pageTypes: ['ComplianceGuide', 'TouristTaxCalc'],
      forceRegenerate: false,
      autoApproveCounsel: true,
    });
  }

  return (
    <div className="space-y-6" data-testid="seo-dashboard-page">
      <PageHeader
        title={t('admin.seo.title')}
        description={t('admin.seo.description')}
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => void approveAllMutation.mutateAsync(true)}
              disabled={approveAllMutation.isPending}
              data-testid="seo-approve-all-button"
            >
              {t('admin.seo.approveAll')}
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={generateMutation.isPending}
              data-testid="seo-regenerate-button"
            >
              {t('admin.seo.generateAll')}
            </Button>
          </div>
        }
      />

      {budget && (
        <Card data-testid="seo-ai-budget-card">
          <CardHeader>
            <CardTitle>{t('admin.seo.aiBudget')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t('admin.seo.budgetTokens', {
              used: budget.tokensUsedThisMonth.toLocaleString('it-IT'),
              cap: budget.monthlyTokenCap.toLocaleString('it-IT'),
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {isError ? (
            <p className="py-8 text-center text-destructive">
              {t('admin.seo.loadError')}
            </p>
          ) : isLoading ? (
            <p className="py-8 text-center text-muted-foreground">{t('admin.seo.loading')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="seo-pages-table">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">{t('admin.seo.table.comune')}</th>
                    <th className="pb-2 pr-4">{t('admin.seo.table.type')}</th>
                    <th className="pb-2 pr-4">{t('admin.seo.table.status')}</th>
                    <th className="pb-2 pr-4">{t('admin.seo.table.lastRefresh')}</th>
                    <th className="pb-2">{t('admin.seo.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.items ?? []).map((item) => (
                    <tr
                      key={item.id}
                      className="border-b last:border-0"
                      data-testid={`seo-page-row-${item.id}`}
                    >
                      <td className="py-3 pr-4">
                        <div className="font-medium">{item.comuneName}</div>
                        <div className="text-xs text-muted-foreground">{item.slug}</div>
                      </td>
                      <td className="py-3 pr-4">{item.pageType}</td>
                      <td className="py-3 pr-4">
                        <SeoReviewStatusBadge status={item.legalReviewStatus} />
                      </td>
                      <td className="py-3 pr-4">
                        {item.lastRefreshedAt
                          ? formatDate(item.lastRefreshedAt)
                          : '—'}
                      </td>
                      <td className="py-3">
                        {item.legalReviewStatus === 'Draft' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reviewMutation.isPending}
                            data-testid={`seo-approve-${item.id}`}
                            onClick={() =>
                              void reviewMutation.mutateAsync({
                                pageId: item.id,
                                body: {
                                  legalReviewStatus: 'Reviewed',
                                  counselApproved: true,
                                },
                              })
                            }
                          >
                            {t('admin.seo.table.approve')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data && data.items.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">{t('admin.seo.table.empty')}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent data-testid="seo-regenerate-dialog">
          <DialogHeader>
            <DialogTitle>{t('admin.seo.confirmDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('admin.seo.confirmDialog.description', { count: comuneCount })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t('admin.seo.confirmDialog.cancel')}
            </Button>
            <Button onClick={() => void handleRegenerate()} data-testid="seo-regenerate-confirm">
              {t('admin.seo.confirmDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
