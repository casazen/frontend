import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { BookingSite } from '@/lib/booking-link';
import type { OrgDomainConfig } from '@/types/domain.types';
import { getDomainState, ownerLoginState } from '../domain/domain-state';
import { resolveEmbedBase } from './embed-snippet';

/** The tab of the domain, where everything this line says is changed: this page shows it and never edits it. */
const DOMAIN_SETTINGS_PATH = '/app/short-rent/settings/domain';

interface EmbedDomainStatusProps {
  site: BookingSite;
  config: OrgDomainConfig;
}

function Row({ label, testId, children }: { label: string; testId: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words" data-testid={testId}>
        {children}
      </dd>
    </>
  );
}

/**
 * Where the code of this page comes from, in one quiet block (E41/F03/US01, NF-147): the domain and whether it is served, what runs on it (the guest area, the owner portal, the
 * sign-in of the owners, the links the agency sends) as the domain settings say it, and a link to the tab of the domain. It reads the settings and shows them with the words of
 * the tab of the domain; it has no form, and changes nothing. Without a verified domain it says so in one sentence: the code then names the address of CasaZen and the org.
 */
export function EmbedDomainStatus({ site, config }: EmbedDomainStatusProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const { base } = resolveEmbedBase(site);
  const customState = config.publicHostMode === 'CustomDomain' && config.customDomain ? getDomainState(config.domainVerificationStatus, config.status?.detail) : null;
  // The surfaces are the choices of a domain that is served; the tab of the domain shows them under the same condition.
  const surfaces = config.surfaces && config.domainVerificationStatus === 'Verified' ? config.surfaces : null;

  let domainValue: React.ReactNode;
  if (site.ownHost) {
    domainValue = (
      <span className="flex flex-wrap items-baseline gap-x-3">
        <span className="font-medium">{new URL(base).host}</span>
        <span className="text-muted-foreground">{customState ? t(`domain.state.${customState}`) : t('domain.modes.subdomain')}</span>
      </span>
    );
  } else if (config.customDomain && customState) {
    domainValue = (
      <span className="flex flex-wrap items-baseline gap-x-3">
        <span className="font-medium">{config.customDomain}</span>
        <span className="text-muted-foreground">{t(`domain.state.${customState}`)}</span>
      </span>
    );
  } else {
    domainValue = <span className="text-muted-foreground">{t('embed.settings.status.noDomainValue')}</span>;
  }

  return (
    <section className="space-y-3" aria-labelledby={titleId} data-testid="embed-status" data-domain={site.ownHost ? 'own' : 'casazen'}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={titleId} className="text-sm font-semibold">
          {t('embed.settings.status.title')}
        </h2>
        <Link to={DOMAIN_SETTINGS_PATH} className="text-sm underline underline-offset-4" data-testid="embed-status-manage">
          {t('embed.settings.status.manage')}
        </Link>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
        <Row label={t('embed.settings.status.domain')} testId="embed-status-domain">
          {domainValue}
        </Row>
        {surfaces ? (
          <>
            <Row label={t('embed.settings.status.guestArea')} testId="embed-status-guest-area">
              {surfaces.effective.guestArea ? t('embed.settings.status.surfaceOwn') : t('embed.settings.status.surfaceCasazen')}
            </Row>
            <Row label={t('embed.settings.status.ownerPortal')} testId="embed-status-owner-portal">
              {surfaces.effective.ownerPortal && surfaces.effective.ownerLoginReady ? t('embed.settings.status.surfaceOwn') : t('embed.settings.status.surfaceCasazen')}
            </Row>
            <Row label={t('domain.surfaces.ownerLogin.label')} testId="embed-status-owner-login">
              {t(`domain.surfaces.ownerLogin.state.${ownerLoginState(surfaces)}`)}
            </Row>
            <Row label={t('embed.settings.status.links')} testId="embed-status-links">
              {surfaces.effective.linksOnOwnDomain ? t('embed.settings.status.linksOwn') : t('embed.settings.status.linksCasazen')}
            </Row>
          </>
        ) : null}
      </dl>

      {!site.ownHost ? (
        <p className="text-sm text-muted-foreground" data-testid="embed-status-no-domain">
          {t('embed.settings.status.noDomain', { slug: site.orgSlug })}
        </p>
      ) : null}
    </section>
  );
}
