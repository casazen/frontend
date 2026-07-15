import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrentUser, useEntitlement } from '@/queries/use-users';
import { needsOrgSetup } from '@/lib/onboarding';
import type { PublicHostMode } from '@/types/domain.types';
import { DnsInstructionsPanel } from './dns-instructions-panel';
import { DomainStatusBadge } from './domain-status-badge';
import { useOrgDomain, useSetOrgDomain, useVerifyOrgDomain } from './use-org-domain';

export function CustomDomainSettingsPage() {
  const { t } = useTranslation();
  const { org, user } = useCurrentUser();
  const { data: entitlement } = useEntitlement();
  const { data: domainConfig, isLoading } = useOrgDomain(org?.id);
  const setDomain = useSetOrgDomain(org?.id);
  const verifyDomain = useVerifyOrgDomain(org?.id);

  const [hostMode, setHostMode] = useState<PublicHostMode>('CasazenPath');
  const [subdomain, setSubdomain] = useState('');
  const [customDomain, setCustomDomain] = useState('');

  useEffect(() => {
    if (!domainConfig) return;
    setHostMode(domainConfig.publicHostMode);
    setSubdomain(domainConfig.subdomain ?? '');
    setCustomDomain(domainConfig.customDomain ?? '');
  }, [domainConfig]);

  if (user && needsOrgSetup(user)) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!org) {
    return (
      <AppShell>
        <p className="text-muted-foreground">{t('domain.settings.noOrg')}</p>
      </AppShell>
    );
  }

  const canUseCustomDomain = entitlement?.canUseCustomDomain ?? domainConfig?.canUseCustomDomain ?? false;
  const effectiveMode = domainConfig?.publicHostMode ?? hostMode;

  const handleSave = async () => {
    await setDomain.mutateAsync({
      hostMode,
      subdomain: hostMode === 'CasazenSubdomain' ? subdomain || org.slug : undefined,
      customDomain: hostMode === 'CustomDomain' ? customDomain : undefined,
    });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6" data-testid="custom-domain-settings-page">
        <PageHeader
          title={t('domain.settings.title')}
          description={t('domain.settings.description')}
        />

        {isLoading ? (
          <p className="text-muted-foreground">{t('domain.settings.loading')}</p>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{t('domain.settings.modeTitle')}</CardTitle>
                <CardDescription>{t('domain.settings.modeDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="host-mode">{t('domain.settings.modeTitle')}</Label>
                  <select
                    id="host-mode"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={hostMode}
                    onChange={(e) => setHostMode(e.target.value as PublicHostMode)}
                    data-testid="host-mode-radio"
                  >
                    <option value="CasazenPath">{t('domain.modes.path')}</option>
                    <option value="CasazenSubdomain">{t('domain.modes.subdomain')}</option>
                    <option value="CustomDomain" disabled={!canUseCustomDomain}>
                      {t('domain.modes.custom')}
                    </option>
                  </select>
                </div>

                {!canUseCustomDomain && (
                  <p className="text-sm text-muted-foreground" data-testid="upgrade-cta">
                    {t('domain.settings.upgradeCta')}{' '}
                    <Link to="/app/short-rent/settings/plan" className="underline">
                      {t('domain.settings.upgradeLink')}
                    </Link>
                  </p>
                )}

                {hostMode === 'CasazenSubdomain' && (
                  <div className="space-y-2">
                    <Label htmlFor="subdomain">{t('domain.settings.subdomainLabel')}</Label>
                    <Input
                      id="subdomain"
                      data-testid="subdomain-input"
                      placeholder={org.slug}
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value)}
                    />
                  </div>
                )}

                {hostMode === 'CustomDomain' && canUseCustomDomain && (
                  <div className="space-y-2">
                    <Label htmlFor="custom-domain">{t('domain.settings.customDomainLabel')}</Label>
                    <Input
                      id="custom-domain"
                      data-testid="custom-domain-input"
                      placeholder="www.tuovilla.it"
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                    />
                  </div>
                )}

                <Button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={setDomain.isPending}
                  data-testid="save-domain-settings"
                >
                  {t('domain.settings.save')}
                </Button>
              </CardContent>
            </Card>

            {domainConfig && (
              <Card data-testid="domain-current-config">
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle>{t('domain.settings.currentTitle')}</CardTitle>
                    <CardDescription>
                      {t(`domain.modes.${effectiveMode === 'CasazenPath' ? 'path' : effectiveMode === 'CasazenSubdomain' ? 'subdomain' : 'custom'}`)}
                    </CardDescription>
                  </div>
                  {domainConfig.customDomain && (
                    <DomainStatusBadge status={domainConfig.domainVerificationStatus} />
                  )}
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p>
                    <span className="font-medium">{t('domain.settings.pathUrl')}:</span>{' '}
                    <a href={domainConfig.publicUrls.pathUrl} className="underline" target="_blank" rel="noreferrer">
                      {domainConfig.publicUrls.pathUrl}
                    </a>
                  </p>
                  {domainConfig.publicUrls.subdomainUrl && (
                    <p>
                      <span className="font-medium">{t('domain.settings.subdomainUrl')}:</span>{' '}
                      {domainConfig.publicUrls.subdomainUrl}
                    </p>
                  )}
                  {domainConfig.publicUrls.customDomainUrl && (
                    <p>
                      <span className="font-medium">{t('domain.settings.customDomainUrl')}:</span>{' '}
                      {domainConfig.publicUrls.customDomainUrl}
                    </p>
                  )}

                  {domainConfig.dnsInstructions && (
                    <DnsInstructionsPanel instructions={domainConfig.dnsInstructions} />
                  )}

                  {domainConfig.publicHostMode === 'CustomDomain' &&
                    domainConfig.domainVerificationStatus !== 'Verified' && (
                      <Button
                        type="button"
                        variant="secondary"
                        data-testid="verify-domain-button"
                        disabled={verifyDomain.isPending}
                        onClick={() => void verifyDomain.mutateAsync()}
                      >
                        {t('domain.settings.verify')}
                      </Button>
                    )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
