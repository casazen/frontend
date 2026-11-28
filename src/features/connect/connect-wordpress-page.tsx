import { useId, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Link2, ShieldAlert, TriangleAlert } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { FEATURE_FLAGS_QUERY_KEY } from '@/contexts/feature-flags-context';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { PublicAccessFrame } from '@/pages/public-access-frame';
import { useCurrentUser } from '@/queries/use-users';
import { readConnectRequest } from './connect-params';
import { useAuthorizeSiteConnection } from './use-authorize-site-connection';

const PAGE_TEST_ID = 'connect-wordpress-page';

/**
 * The page the plugin for WordPress opens to be linked to the agency account (`/app/connect/wordpress?site=…&return=…&state=…&challenge=…&method=S256`, PLG-FE-CONSOLE, NF-201, site
 * integration plan §10.2): inside the signed-in app (a visitor who is not signed in goes to the sign-in and comes back to this very address, query included), outside every area. It shows ONE block:
 * «Collegare il sito <host in full> a <agency>?», what the plugin will and will not be able to do, and «Collega» / «Annulla».
 *
 * «Collega» asks the server to confirm (`POST /orgs/{orgId}/site-connections/authorize`) and then takes the whole window to the address the server answers, which carries the one-time code; the page
 * never builds that address and never follows the `return` of its own. «Annulla» only says that the tab can be closed: nobody is sent anywhere and nothing is created. While the call is on its
 * way both buttons are off, and a second click sends nothing more. A request that is not valid (here or for the server: 400) is told so, with no button; so is a person who is not an
 * administrator of the agency (the server says 401 or 403), who can do nothing here. While the embeddable pages (`SiteEmbed`) are off the page does not exist: back to the area, as any page behind that flag.
 */
export function ConnectWordPressPage() {
  const { t } = useTranslation();
  const allowedId = useId();
  const notAllowedId = useId();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { flags, isLoading: flagsLoading, isError: flagsError } = useFeatureFlags();
  const { contexts, isReady, getDefaultRoute } = useWorkspace();
  const { org, isLoading: userLoading } = useCurrentUser();
  const authorize = useAuthorizeSiteConnection(org?.id);
  const sent = useRef(false);
  const [cancelled, setCancelled] = useState(false);

  if (flagsLoading || !isReady || userLoading) {
    return (
      <div data-testid="connect-loading">
        <LoadingScreen message={t('siteConnect.wordpress.loading')} />
      </div>
    );
  }
  if (flagsError) {
    return (
      <PublicAccessFrame
        icon={TriangleAlert}
        testId={PAGE_TEST_ID}
        outcome="unavailable"
        title={t('siteConnect.wordpress.unavailable.title')}
        description={t('siteConnect.wordpress.unavailable.description')}
      >
        <Button type="button" onClick={() => void queryClient.refetchQueries({ queryKey: FEATURE_FLAGS_QUERY_KEY })} data-testid="connect-flags-retry">
          {t('siteConnect.wordpress.unavailable.retry')}
        </Button>
      </PublicAccessFrame>
    );
  }
  if (contexts.length === 0) return <Navigate to="/app/no-access" replace />;
  if (!flags.siteEmbed) return <Navigate to={getDefaultRoute(contexts[0].contextKey)} replace />;

  const request = readConnectRequest(searchParams);
  if (request === null || authorize.error?.status === 400) {
    return (
      <PublicAccessFrame
        icon={TriangleAlert}
        testId={PAGE_TEST_ID}
        outcome="invalid"
        title={t('siteConnect.wordpress.invalid.title')}
        description={t('siteConnect.wordpress.invalid.description')}
      />
    );
  }

  const refused = authorize.error?.status === 401 || authorize.error?.status === 403;
  if (!org || !isOrgBillingAdmin(contexts) || refused) {
    return (
      <PublicAccessFrame
        icon={ShieldAlert}
        testId={PAGE_TEST_ID}
        outcome="admin-only"
        title={t('siteConnect.wordpress.adminOnly.title')}
        description={t('siteConnect.wordpress.adminOnly.description')}
      />
    );
  }

  if (cancelled) {
    return (
      <PublicAccessFrame
        icon={Link2}
        testId={PAGE_TEST_ID}
        outcome="cancelled"
        title={t('siteConnect.wordpress.cancelled.title')}
        description={<span role="status">{t('siteConnect.wordpress.cancelled.description')}</span>}
      />
    );
  }

  if (authorize.isSuccess) {
    return (
      <PublicAccessFrame
        icon={Link2}
        testId={PAGE_TEST_ID}
        outcome="leaving"
        title={t('siteConnect.wordpress.leaving.title')}
        description={<span role="status">{t('siteConnect.wordpress.leaving.description')}</span>}
      />
    );
  }

  const connect = () => {
    if (sent.current) return;
    sent.current = true;
    authorize.mutate(request, {
      onSuccess: (target) => window.location.assign(target),
      onError: () => {
        sent.current = false;
      },
    });
  };

  return (
    <PublicAccessFrame
      icon={Link2}
      testId={PAGE_TEST_ID}
      outcome="consent"
      title={
        <Trans
          i18nKey="siteConnect.wordpress.question"
          values={{ site: request.siteHost, agency: org.name }}
          components={{ strong: <strong className="break-all font-bold" /> }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
        />
      }
      description={t('siteConnect.wordpress.verifySite')}
    >
      <div className="space-y-4 text-sm">
        <section aria-labelledby={allowedId} className="space-y-1.5">
          <h2 id={allowedId} className="font-semibold">
            {t('siteConnect.wordpress.allowed.title')}
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground" data-testid="connect-allowed">
            <li>{t('siteConnect.wordpress.allowed.domain')}</li>
            <li>{t('siteConnect.wordpress.allowed.surfaces')}</li>
          </ul>
        </section>
        <section aria-labelledby={notAllowedId} className="space-y-1.5">
          <h2 id={notAllowedId} className="font-semibold">
            {t('siteConnect.wordpress.notAllowed.title')}
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground" data-testid="connect-not-allowed">
            <li>{t('siteConnect.wordpress.notAllowed.data')}</li>
          </ul>
        </section>
        <p className="text-muted-foreground">{t('siteConnect.wordpress.disconnectAnytime')}</p>
      </div>

      {authorize.isError ? (
        <Alert variant="danger" data-testid="connect-error">
          {authorize.error.userMessage ?? t('siteConnect.wordpress.failed')}
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={connect} loading={authorize.isPending} disabled={authorize.isPending} data-testid="connect-confirm">
          {t('siteConnect.wordpress.connect')}
        </Button>
        <Button type="button" variant="outline" onClick={() => setCancelled(true)} disabled={authorize.isPending} data-testid="connect-cancel">
          {t('shared.cancel')}
        </Button>
      </div>
    </PublicAccessFrame>
  );
}
