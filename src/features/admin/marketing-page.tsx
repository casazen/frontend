import { useTranslation } from 'react-i18next';
import { Info, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SeoTopComuniWidget } from './components/seo-top-comuni-widget';

/**
 * Marketing section (SE-03): makes the tracking data already collected visible to admins.
 * No new events or pixels are added: the page surfaces existing signup attribution
 * (UTM, referrer host, comune) and the top-converting comuni from the SEO funnel.
 */
export function MarketingPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6" data-testid="marketing-page">
      <PageHeader
        title={t('admin.marketing.title')}
        description={t('admin.marketing.description')}
      />

      {/* Data-scope notice */}
      <Card data-testid="marketing-scope-notice">
        <CardContent className="flex items-start gap-3 pt-6">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">{t('admin.marketing.scopeNotice')}</p>
        </CardContent>
      </Card>

      {/* SEO funnel: top comuni by CTA clicks and signup conversions */}
      <SeoTopComuniWidget />

      {/* UTM / referrer attribution placeholder */}
      <Card data-testid="marketing-attributions-placeholder">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" aria-hidden />
            {t('admin.marketing.attributions.title')}
          </CardTitle>
          <CardDescription>{t('admin.marketing.attributions.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground" data-testid="marketing-attributions-api-note">
            {t('admin.marketing.attributions.apiNote')}
          </p>
          <code className="mt-2 block rounded bg-muted px-3 py-2 text-xs text-muted-foreground">
            GET /api/admin/attributions
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
