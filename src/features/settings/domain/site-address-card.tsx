import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage } from '@/lib/api-errors';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { useCurrentUser } from '@/queries/use-users';
import type { OrgDomainConfig } from '@/types/domain.types';
import { DomainStatusBadge } from './domain-status-badge';
import { describeDomainIssue, getDomainState } from './domain-state';
import { useOrgDomain } from './use-org-domain';

export const DOMAIN_SETTINGS_PATH = '/app/short-rent/settings/domain';

const DISMISS_KEY_PREFIX = 'casazen.site-address-card.dismissed.';

function readDismissed(orgId: string): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY_PREFIX + orgId) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(orgId: string): void {
  try {
    window.localStorage.setItem(DISMISS_KEY_PREFIX + orgId, '1');
  } catch {
    // Storage blocked: the card comes back on the next visit, nothing is lost.
  }
}

/**
 * The step of the host's first days that is about the address of the booking site (BK-17, A3-25, CD-AC9): the site
 * answers on the CasaZen path from the start; this card suggests an address of their own and, once a custom domain is
 * chosen, follows it honestly until it works (waiting for DNS, being activated, failed). It disappears once the address
 * is settled (a subdomain, a verified domain) or when the host dismisses the suggestion. Only for the org billing
 * administrator, the only one the domain endpoints answer to.
 */
export function SiteAddressCard() {
  const { contexts, hasPermission } = useWorkspace();
  const { org } = useCurrentUser();
  const isAdmin = isOrgBillingAdmin(contexts) && hasPermission('short-rent', 'property.write');
  const domain = useOrgDomain(org?.id, isAdmin);
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (!isAdmin || !org) return null;
  if (domain.isLoading) return <SiteAddressSkeleton />;
  if (domain.isError && !domain.data) return <SiteAddressError error={domain.error} onRetry={() => void domain.refetch()} />;
  if (!domain.data) return null;

  const config = domain.data;
  const needsAttention =
    config.publicHostMode === 'CustomDomain' && config.domainVerificationStatus !== 'Verified';
  const suggestion = config.publicHostMode === 'CasazenPath';
  if (!needsAttention && !suggestion) return null;
  if (suggestion && (dismissed === org.id || readDismissed(org.id))) return null;

  return (
    <SiteAddressContent
      config={config}
      suggestion={suggestion}
      onDismiss={() => {
        writeDismissed(org.id);
        setDismissed(org.id);
      }}
    />
  );
}

function SiteAddressSkeleton() {
  return (
    <Card data-testid="site-address-loading" aria-busy="true">
      <CardHeader>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
    </Card>
  );
}

function SiteAddressError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Card role="alert" data-testid="site-address-error">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <p className="text-sm text-destructive">{getProblemMessage(error, t) ?? t('domain.siteAddress.loadError')}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {t('domain.settings.retry')}
        </Button>
      </CardContent>
    </Card>
  );
}

interface SiteAddressContentProps {
  config: OrgDomainConfig;
  suggestion: boolean;
  onDismiss: () => void;
}

function SiteAddressContent({ config, suggestion, onDismiss }: SiteAddressContentProps) {
  const { t } = useTranslation();
  const state = getDomainState(config.domainVerificationStatus, config.status?.detail);
  const explanation = describeDomainIssue(config.status?.detail, config.status?.message, t);

  return (
    <Card data-testid="site-address-card" data-mode={suggestion ? 'suggestion' : 'domain'} data-state={suggestion ? undefined : state}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" aria-hidden="true" />
            {suggestion ? t('domain.siteAddress.title') : t('domain.siteAddress.domainTitle', { domain: config.customDomain })}
            {!suggestion && (
              <DomainStatusBadge status={config.domainVerificationStatus} detail={config.status?.detail} />
            )}
          </CardTitle>
          <CardDescription>
            {suggestion
              ? t('domain.siteAddress.suggestion', { url: config.publicUrls.pathUrl })
              : (explanation ?? t(`domain.stateDescription.${state}`))}
          </CardDescription>
        </div>
        {suggestion && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('domain.siteAddress.dismiss')}
            data-testid="site-address-dismiss"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Button asChild size="sm" variant={suggestion ? 'default' : 'secondary'}>
          <Link to={DOMAIN_SETTINGS_PATH} data-testid="site-address-link">
            {suggestion ? t('domain.siteAddress.choose') : t('domain.siteAddress.manage')}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
