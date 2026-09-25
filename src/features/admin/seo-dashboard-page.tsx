import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
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
  useGenerateSeoPages,
  usePlatformAiBudget,
  useSeoComuni,
  useSeoPages,
} from '@/queries/use-admin-seo';
import type { LegalReviewStatus, SeoPageAdmin } from '@/types/seo.types';
import { SeoLatestRevisionStatus, SeoPublicationBadge } from './components/seo-status';
import { SEO_PAGE_TYPE_KEY } from './components/seo-review-helpers';
import { SeoReviewDialog } from './components/seo-review-dialog';
import { SeoWithdrawDialog } from './components/seo-withdraw-dialog';
import { formatDate } from '@/lib/utils';
import i18n from '@/i18n/config';

const SEO_PAGE_SIZE = 20;

type StatusFilter = '' | LegalReviewStatus;

/**
 * Admin SEO dashboard (US-020, SE-01): paginated pages with their publication state, review with preview and explicit
 * approval of the revision read, withdrawal, link to the public page, AI generation (drafts only) and AI budget.
 */
export function SeoDashboardPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('');
  const { data, isLoading, isError, isPlaceholderData } = useSeoPages({
    page,
    pageSize: SEO_PAGE_SIZE,
    ...(status ? { legalReviewStatus: status } : {}),
  });
  const { data: comuni } = useSeoComuni();
  const budget = usePlatformAiBudget();
  const generateMutation = useGenerateSeoPages();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewPageId, setReviewPageId] = useState<string | null>(null);
  const [withdrawPage, setWithdrawPage] = useState<SeoPageAdmin | null>(null);

  const comuneCount = comuni?.length ?? 0;
  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / SEO_PAGE_SIZE)) : 1;

  function handleGenerate() {
    setConfirmOpen(false);
    generateMutation.mutate({
      comuneCodes: [],
      pageTypes: ['ComplianceGuide', 'TouristTaxCalc'],
      forceRegenerate: false,
    });
  }

  return (
    <div className="space-y-6" data-testid="seo-dashboard-page">
      <PageHeader
        title={t('admin.seo.title')}
        description={t('admin.seo.description')}
        action={
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={generateMutation.isPending}
            data-testid="seo-regenerate-button"
          >
            {t('admin.seo.generateAll')}
          </Button>
        }
      />

      <Card data-testid="seo-ai-budget-card">
        <CardHeader>
          <CardTitle>{t('admin.seo.aiBudget')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {budget.isLoading ? (
            t('admin.seo.budgetLoading')
          ) : budget.isError || !budget.data ? (
            <span className="text-destructive" data-testid="seo-ai-budget-error">
              {t('admin.seo.budgetError')}
            </span>
          ) : (
            t('admin.seo.budgetTokens', {
              used: budget.data.tokensUsedThisMonth.toLocaleString(i18n.language),
              cap: budget.data.monthlyTokenCap.toLocaleString(i18n.language),
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <label className="flex items-center gap-2 text-sm">
            <span>{t('admin.seo.filter.label')}</span>
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter);
                setPage(1);
              }}
              data-testid="seo-status-filter"
            >
              <option value="">{t('admin.seo.filter.all')}</option>
              <option value="Draft">{t('admin.seo.filter.draft')}</option>
              <option value="Reviewed">{t('admin.seo.filter.reviewed')}</option>
            </select>
          </label>

          {isError ? (
            <p className="py-8 text-center text-destructive" data-testid="seo-pages-error">
              {t('admin.seo.loadError')}
            </p>
          ) : isLoading ? (
            <p className="py-8 text-center text-muted-foreground">{t('admin.seo.loading')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="seo-pages-table" aria-busy={isPlaceholderData}>
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">{t('admin.seo.table.comune')}</th>
                    <th className="pb-2 pr-4">{t('admin.seo.table.type')}</th>
                    <th className="pb-2 pr-4">{t('admin.seo.table.status')}</th>
                    <th className="pb-2 pr-4">{t('admin.seo.table.content')}</th>
                    <th className="pb-2 pr-4">{t('admin.seo.table.lastRefresh')}</th>
                    <th className="pb-2">{t('admin.seo.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.items ?? []).map((item) => (
                    <tr key={item.id} className="border-b last:border-0" data-testid={`seo-page-row-${item.id}`}>
                      <td className="py-3 pr-4">
                        <div className="font-medium">{item.comuneName}</div>
                        <div className="text-xs text-muted-foreground">{item.slug}</div>
                      </td>
                      <td className="py-3 pr-4">{t(SEO_PAGE_TYPE_KEY[item.pageType])}</td>
                      <td className="py-3 pr-4">
                        <SeoPublicationBadge page={item} />
                      </td>
                      <td className="py-3 pr-4">
                        <SeoLatestRevisionStatus page={item} />
                      </td>
                      <td className="py-3 pr-4">{item.lastRefreshedAt ? formatDate(item.lastRefreshedAt) : '—'}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReviewPageId(item.id)}
                            data-testid={`seo-review-${item.id}`}
                          >
                            {t('admin.seo.table.review')}
                          </Button>
                          {item.isPublished && item.publicPath && (
                            <Button size="sm" variant="ghost" asChild>
                              <a
                                href={item.publicUrl ?? item.publicPath}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-testid={`seo-open-public-${item.id}`}
                              >
                                <ExternalLink className="mr-1 h-4 w-4" aria-hidden />
                                {t('admin.seo.table.openPublic')}
                              </a>
                            </Button>
                          )}
                          {item.isPublished && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setWithdrawPage(item)}
                              data-testid={`seo-withdraw-${item.id}`}
                            >
                              {t('admin.seo.table.withdraw')}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data && data.items.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">{t('admin.seo.table.empty')}</p>
              )}
              {data && data.totalCount > SEO_PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                  <span data-testid="seo-pagination">
                    {t('admin.seo.pagination', { page, totalPages, totalCount: data.totalCount })}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1 || isPlaceholderData}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      data-testid="seo-page-previous"
                    >
                      {t('admin.seo.previous')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= totalPages || isPlaceholderData}
                      onClick={() => setPage((p) => p + 1)}
                      data-testid="seo-page-next"
                    >
                      {t('admin.seo.next')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <SeoReviewDialog key={reviewPageId ?? 'none'} pageId={reviewPageId} onClose={() => setReviewPageId(null)} />
      <SeoWithdrawDialog key={withdrawPage?.id ?? 'none'} page={withdrawPage} onClose={() => setWithdrawPage(null)} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent data-testid="seo-regenerate-dialog">
          <DialogHeader>
            <DialogTitle>{t('admin.seo.confirmDialog.title')}</DialogTitle>
            <DialogDescription>{t('admin.seo.confirmDialog.description', { count: comuneCount })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t('admin.seo.confirmDialog.cancel')}
            </Button>
            <Button onClick={handleGenerate} data-testid="seo-regenerate-confirm">
              {t('admin.seo.confirmDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
