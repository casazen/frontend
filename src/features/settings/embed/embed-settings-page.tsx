import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { needsOrgSetup } from '@/lib/onboarding';
import { useCurrentUser } from '@/queries/use-users';
import { useOrgBookingSite } from '../domain/use-org-domain';
import { EmbedDomainStatus } from './embed-domain-status';
import { EmbedGtmField } from './embed-gtm-field';
import { EmbedPluginSteps } from './embed-plugin-steps';
import { resolveEmbedBase } from './embed-snippet';
import { EmbedWidgetBlock } from './embed-widget-block';

/**
 * «Incorpora nel tuo sito» (E41/F03/US01, NF-147, NF-149): where the agency takes a CasaZen widget to its own website. It EXTENDS the domain settings, it never repeats them: the
 * domain, what runs on it and the tracking are read from the same settings as the tab of the domain (`useOrgBookingSite`), and changing the domain is a link to that tab. The page is
 * for the account administrator, who is the only one that may read those settings (a refused read would send the whole app to the page of no access): anyone else is told so and
 * no request goes out. The code to paste names the agency's own domain when it has one that is served, else the address of CasaZen with the slug of the org.
 *
 * One block stands out (the choice of the widget, its code and its preview, together); the domain, the plugin for WordPress and the container of the tag manager are quiet rows.
 * While the settings are on their way, or could not be read, there is no code: it would name an address that is not confirmed.
 */
export function EmbedSettingsPage() {
  const { t } = useTranslation();
  const { org, user, isLoading: userLoading } = useCurrentUser();
  const bookingSite = useOrgBookingSite(org?.id, org?.slug ?? null);

  if (user && needsOrgSetup(user)) {
    return <Navigate to="/onboarding" replace />;
  }

  let body: React.ReactNode;
  if (userLoading) {
    body = <SkeletonLine lines={4} lineClassName="h-10" label={t('embed.settings.loading')} />;
  } else if (!org || !bookingSite) {
    body = (
      <p className="text-muted-foreground" data-testid="embed-no-org">
        {t('embed.settings.noOrg')}
      </p>
    );
  } else if (bookingSite.status === 'restricted') {
    body = (
      <Alert variant="info" role="alert" icon={ShieldAlert} title={t('embed.settings.restricted.title')} data-testid="embed-restricted">
        {t('embed.settings.restricted.description')}
      </Alert>
    );
  } else if (bookingSite.status === 'loading') {
    body = (
      <div data-testid="embed-loading">
        <SkeletonLine lines={4} lineClassName="h-10" label={t('embed.settings.loading')} />
      </div>
    );
  } else if (bookingSite.status === 'failed' || !bookingSite.config) {
    body = (
      <Alert
        variant="danger"
        data-testid="embed-load-error"
        action={
          <Button type="button" variant="outline" size="sm" onClick={bookingSite.retry}>
            {t('embed.settings.retry')}
          </Button>
        }
      >
        {t('embed.settings.loadError')}
      </Alert>
    );
  } else {
    const origin = resolveEmbedBase(bookingSite.site);
    body = (
      <div className="space-y-8" data-testid="embed-content">
        <EmbedDomainStatus site={bookingSite.site} config={bookingSite.config} />
        <EmbedWidgetBlock origin={origin} orgSlug={bookingSite.site.orgSlug} />
        <EmbedPluginSteps origin={origin} />
        <EmbedGtmField orgId={org.id} config={bookingSite.config} />
      </div>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6" data-testid="embed-settings-page">
        <PageHeader title={t('embed.settings.title')} description={t('embed.settings.description')} />
        {body}
      </div>
    </AppShell>
  );
}
