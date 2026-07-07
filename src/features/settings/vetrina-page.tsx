import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { useCurrentUser } from '@/queries/use-users';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { VetrinaPreviewPanel } from './components/vetrina-preview-panel';
import { VetrinaUrlCopy } from './components/vetrina-url-copy';

export function VetrinaPage() {
  const { t } = useTranslation();
  const { org } = useCurrentUser();
  const bookingSitePath = org?.slug ? `/book/${org.slug}` : null;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title={t('directBooking.title')}
          description={t('directBooking.description')}
        />

        {bookingSitePath ? (
          <div className="space-y-6">
            <VetrinaUrlCopy bookingSitePath={bookingSitePath} />
            <VetrinaPreviewPanel bookingSitePath={bookingSitePath} />
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Globe className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('directBooking.noOrg')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
