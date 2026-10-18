import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAiSettings } from '@/queries/use-admin-seo';

/** Status of the platform provider, with the way into the AI configuration section. */
export function SeoAiSettingsCard() {
  const { t } = useTranslation();
  const settings = useAiSettings();

  return (
    <Card id="seo-ai-settings" data-testid="seo-ai-settings-card">
      <CardHeader>
        <CardTitle>{t('admin.seo.ai.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {settings.isLoading ? (
          <p>{t('admin.seo.ai.loading')}</p>
        ) : settings.isError || !settings.data ? (
          <p className="text-destructive" data-testid="seo-ai-settings-error">
            {t('admin.seo.ai.loadError')}
          </p>
        ) : (
          <p data-testid="seo-ai-settings-status">
            {settings.data.externalActive
              ? t('admin.seo.ai.statusActive', { provider: settings.data.provider })
              : t('admin.seo.ai.statusInactive')}
          </p>
        )}
        <Button variant="outline" asChild>
          <Link to="/app/admin/ai" data-testid="seo-ai-settings-link">
            {t('admin.seo.ai.openSettings')}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
