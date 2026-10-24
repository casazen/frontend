import { Link } from 'react-router-dom';
import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/shared/error-state';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import type { LeaseReview, LeaseReviewCheck, LeaseReviewSeverity } from '@/types';
import { needMessage } from './wizard-messages';
import { isDataStep } from './wizard-model';

const SEVERITIES: LeaseReviewSeverity[] = ['Block', 'Warn', 'Info'];

const ICONS: Record<LeaseReviewSeverity, { Icon: LucideIcon; tone: string }> = {
  Block: { Icon: AlertCircle, tone: 'text-[color:var(--color-danger-foreground,#b4232a)]' },
  Warn: { Icon: AlertTriangle, tone: 'text-[color:var(--color-warning-foreground,#8a4b05)]' },
  Info: { Icon: Info, tone: 'text-[color:var(--color-info-foreground,#1f4fa8)]' },
  Ok: { Icon: CheckCircle2, tone: 'text-[color:var(--color-success-foreground,#166534)]' },
};

function CheckLine({ check, href }: { check: LeaseReviewCheck; href?: string }) {
  const { t, i18n } = useTranslation();
  const { Icon, tone } = ICONS[check.severity];
  return (
    <li className="flex items-start gap-3 text-sm" data-testid={`lease-review-check-${check.code}`}>
      <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', tone)} />
      <span className="min-w-0 flex-1 break-words">{needMessage(t, i18n, check)}</span>
      {href ? (
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link to={href}>{t('leaseWizard.review.goToStep')}</Link>
        </Button>
      ) : null}
    </li>
  );
}

/**
 * The review (LR-06a): what the server checks before a contract can be confirmed, worst first. A block (a thing still missing) must be
 * put right at its step before the confirmation; a warning is to look at and does not stop; what is to know needs nothing. The
 * confirmation itself is the main button of the wizard. A later change of the first steps withdraws it and asks for it again.
 */
export function ReviewStep({ review, hrefOfStep }: { review: UseQueryResult<LeaseReview>; hrefOfStep: (step: number) => string }) {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, error, refetch } = review;

  if (isLoading) return <p role="status" className="text-sm text-muted-foreground">{t('leaseWizard.review.loading')}</p>;
  if (isError || !data) {
    return <ErrorState testId="lease-review-error" title={t('leaseWizard.review.loadError')} error={error} onRetry={() => void refetch()} />;
  }

  const blocks = data.counts.block;
  const confirmedAt = data.reviewConfirmedAt ? formatRomeDateTime(data.reviewConfirmedAt, i18n.language) : '';
  const ok = data.checks.filter((check) => check.severity === 'Ok');

  return (
    <div className="space-y-6" data-testid="lease-review">
      {data.reviewConfirmedAt ? (
        <Alert variant="success" data-testid="lease-review-confirmed">
          {t('leaseWizard.review.confirmed', { date: confirmedAt })}
        </Alert>
      ) : blocks > 0 ? (
        <Alert variant="danger" data-testid="lease-review-blocked">
          {t('leaseWizard.review.blocked', { count: blocks })}
        </Alert>
      ) : (
        <Alert variant="info" data-testid="lease-review-ready">
          {t('leaseWizard.review.ready')}
        </Alert>
      )}

      {SEVERITIES.map((severity) => {
        const checks = data.checks.filter((check) => check.severity === severity);
        if (checks.length === 0) return null;
        return (
          <section key={severity} className="space-y-3" aria-labelledby={`lw-review-${severity}`}>
            <h3 id={`lw-review-${severity}`} className="text-sm font-semibold">
              {t(`leaseWizard.review.group.${severity}`)}
            </h3>
            <ul className="space-y-3">
              {checks.map((check, position) => (
                <CheckLine key={`${check.code}-${position}`} check={check} href={isDataStep(check.step) ? hrefOfStep(check.step) : undefined} />
              ))}
            </ul>
          </section>
        );
      })}

      {ok.length > 0 ? (
        <details className="space-y-3">
          <summary className="cursor-pointer text-sm font-semibold">{t('leaseWizard.review.group.Ok', { count: ok.length })}</summary>
          <ul className="mt-3 space-y-3">
            {ok.map((check, position) => (
              <CheckLine key={`${check.code}-${position}`} check={check} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
