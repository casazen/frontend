import { useTranslation } from 'react-i18next';
import { Loader2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getProblemMessage } from '@/lib/api-errors';
import { useSeoTopComuni } from '@/queries/use-admin-seo';

/** Window of the widget: the last 30 days (#300 AC9). */
const TOP_COMUNI_DAYS = 30;

/**
 * Which comuni bring signups (SE-04, #300 AC9, A8-11): the SEO pages' CTA clicks by comune in the last 30 days, with the
 * signups that started from them and the host signups attributed to the comune. The events carry no personal data and
 * are deleted after the retention period, which the widget says. Loading, error (with retry) and empty states: an
 * error is never shown as "no data".
 */
export function SeoTopComuniWidget() {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, error, refetch, isFetching } = useSeoTopComuni(TOP_COMUNI_DAYS);
  const number = new Intl.NumberFormat(i18n.language);

  return (
    <Card data-testid="seo-top-comuni-widget">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" aria-hidden />
          {t('admin.seo.topComuni.title')}
        </CardTitle>
        <CardDescription>{t('admin.seo.topComuni.description', { days: TOP_COMUNI_DAYS })}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2" data-testid="seo-top-comuni-loading" aria-busy="true">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isError || !data ? (
          <div className="space-y-2" role="alert" data-testid="seo-top-comuni-error">
            <p className="text-sm text-destructive">{getProblemMessage(error, t) ?? t('admin.seo.topComuni.loadError')}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
              {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {t('admin.seo.topComuni.retry')}
            </Button>
          </div>
        ) : data.items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground" data-testid="seo-top-comuni-empty">
            {t('admin.seo.topComuni.empty', { days: data.days })}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="seo-top-comuni-table">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">{t('admin.seo.topComuni.columns.comune')}</th>
                  <th className="pb-2 pr-4 text-right">{t('admin.seo.topComuni.columns.ctaClicks')}</th>
                  <th className="pb-2 pr-4 text-right">{t('admin.seo.topComuni.columns.signupStarts')}</th>
                  <th className="pb-2 text-right">{t('admin.seo.topComuni.columns.signups')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.comuneCode} className="border-b last:border-0" data-testid={`seo-top-comune-${item.comuneCode}`}>
                    <td className="py-2 pr-4 font-medium">{item.comuneName}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{number.format(item.ctaClicks)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{number.format(item.signupStarts)}</td>
                    <td className="py-2 text-right tabular-nums">{number.format(item.signups)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <p className="mt-3 text-xs text-muted-foreground" data-testid="seo-top-comuni-retention">
            {t('admin.seo.topComuni.retention', { days: data.retentionDays })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
