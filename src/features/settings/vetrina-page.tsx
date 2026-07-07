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
      {bookingSitePath ? (
        <div className="-m-4 flex min-h-[calc(100svh-9rem)] flex-col overflow-hidden max-md:min-h-[calc(100svh-9rem-var(--bottom-nav-height))] md:-m-6 md:min-h-[calc(100svh-5.5rem)]">
          <div className="shrink-0 space-y-4 border-b bg-background px-4 py-4 md:px-6">
            <PageHeader
              title={t('directBooking.title')}
              description={t('directBooking.description')}
            />
            <VetrinaUrlCopy bookingSitePath={bookingSitePath} variant="inline" />
          </div>
          <VetrinaPreviewPanel bookingSitePath={bookingSitePath} />
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          <PageHeader
            title={t('directBooking.title')}
            description={t('directBooking.description')}
          />
          <Card className="mt-6">
            <CardContent className="py-12 text-center">
              <Globe className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('directBooking.noOrg')}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
