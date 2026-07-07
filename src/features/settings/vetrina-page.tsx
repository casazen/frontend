import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { useCurrentUser } from '@/queries/use-users';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Globe } from 'lucide-react';

export function VetrinaPage() {
  const { t } = useTranslation();
  const { org } = useCurrentUser();
  const bookingSiteUrl = org?.slug ? `/book/${org.slug}` : null;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title={t('directBooking.title')}
          description={t('directBooking.description')}
        />

        {bookingSiteUrl ? (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold">{t('directBooking.yourSite')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('directBooking.visitDescription')}
                  </p>
                  <a
                    href={bookingSiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
                  >
                    {t('publicSite.preview')}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Globe className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">{t('directBooking.noOrg')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
