import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Clock, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OrgDomainConfig } from '@/types/domain.types';
import { describeDomainIssue, getDomainState, type DomainState } from './domain-state';

interface DomainStatusPanelProps {
  config: OrgDomainConfig;
  verifying: boolean;
  onVerify: () => void;
}

const ICONS: Record<DomainState, typeof Clock> = {
  verified: CheckCircle2,
  waitingDns: Clock,
  activating: Info,
  failed: AlertCircle,
};

const TONES: Record<DomainState, string> = {
  verified: 'border-green-600/40 bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-200',
  waitingDns: 'border-border bg-muted/40',
  activating: 'border-border bg-muted/40',
  failed: 'border-destructive/50 bg-destructive/5 text-destructive',
};

function formatDateTime(value: string | null | undefined, locale: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Honest state of the custom domain (BK-17, A3-25): waiting for DNS, being activated, verified or failed, why, when it
 * was last checked, whether the automatic check still runs and, while the platform cannot activate domains at all, that
 * nothing the host does will change it.
 */
export function DomainStatusPanel({ config, verifying, onVerify }: DomainStatusPanelProps) {
  const { t, i18n } = useTranslation();
  const status = config.status;
  const state = getDomainState(config.domainVerificationStatus, status?.detail);
  const Icon = ICONS[state];
  const explanation = describeDomainIssue(status?.detail, status?.message, t);
  const checkedAt = formatDateTime(status?.checkedAt, i18n.language);
  const verifiedAt = formatDateTime(status?.verifiedAt, i18n.language);

  return (
    <div className="space-y-3" data-testid="domain-status-panel" data-state={state}>
      <div className={`flex items-start gap-3 rounded-md border p-3 ${TONES[state]}`} role={state === 'failed' ? 'alert' : 'status'}>
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-medium" data-testid="domain-state-title">
            {t(`domain.stateTitle.${state}`)}
          </p>
          <p className="text-sm" data-testid="domain-state-description">
            {state === 'verified' ? t('domain.stateDescription.verified') : (explanation ?? t(`domain.stateDescription.${state}`))}
          </p>
          {state === 'verified' && explanation && (
            <p className="text-xs opacity-80" data-testid="domain-verified-note">
              {explanation}
            </p>
          )}
        </div>
      </div>

      {status && !status.activationAvailable && (
        <p
          className="rounded-md border border-dashed p-3 text-sm text-muted-foreground"
          data-testid="domain-activation-unavailable"
        >
          {t('domain.activationUnavailable')}
        </p>
      )}

      <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div data-testid="domain-last-check">
          <dt className="inline font-medium">{t('domain.lastCheck')}: </dt>
          <dd className="inline">{checkedAt ?? t('domain.neverChecked')}</dd>
        </div>
        {state === 'verified' && verifiedAt && (
          <div data-testid="domain-verified-at">
            <dt className="inline font-medium">{t('domain.verifiedAt')}: </dt>
            <dd className="inline">{verifiedAt}</dd>
          </div>
        )}
        {status && (
          <div className="sm:col-span-2" data-testid="domain-auto-check">
            {status.autoCheckActive ? t('domain.autoCheck.active') : t('domain.autoCheck.stopped')}
          </div>
        )}
      </dl>

      {state !== 'verified' && (
        <Button
          type="button"
          variant="secondary"
          data-testid="verify-domain-button"
          disabled={verifying}
          onClick={onVerify}
        >
          {verifying ? t('domain.settings.verifying') : t('domain.settings.verify')}
        </Button>
      )}
    </div>
  );
}
