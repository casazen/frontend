import { useTranslation } from 'react-i18next';
import { Info, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SeoTopComuniWidget } from './components/seo-top-comuni-widget';

export function MarketingPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6" data-testid="marketing-page">
      <PageHeader
        title={t('admin.marketing.title')}
        description={t('admin.marketing.description')}
      />

      <SeoTopComuniWidget />

      <p className="flex items-start gap-3 rounded-lg bg-surface-2 px-4 py-3 text-sm text-muted-foreground" data-testid="marketing-scope-notice">
        <Info className="mt-0.5 size-4 shrink-0 text-primary-text" aria-hidden />
        {t('admin.marketing.scopeNotice')}
      </p>

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
