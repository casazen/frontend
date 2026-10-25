import { Link } from 'react-router-dom';
import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/shared/error-state';
import { getLeaseContractTypeLabel, getLeaseTaxRegimeLabel } from '@/lib/i18n-labels';
import { formatRomeDateTime, formatStayDate } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import { useProperty } from '@/queries/use-properties';
import type { LeaseReview, LeaseReviewCheck, LeaseReviewSeverity, LongRentRules } from '@/types';
import { needMessage } from './wizard-messages';
import { isBlankRow, isDataStep, type WizardValues } from './wizard-model';
import { contractStory, partyName } from './wizard-story';

const BLOCK: LeaseReviewSeverity = 'Block';
const NOT_BLOCKING: LeaseReviewSeverity[] = ['Warn', 'Info'];

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
        <Button asChild variant="ghost" size="sm" className="min-h-11 shrink-0">
          <Link to={href}>{t('leaseWizard.review.goToStep')}</Link>
        </Button>
      ) : null}
    </li>
  );
}

/** «650 €», «1.234,50 €»: the cents only when there are some. */
function money(amount: number, language: string): string {
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

interface DataRow {
  label?: string;
  lines: string[];
}

interface DataGroup {
  id: string;
  title: string;
  step: number;
  rows: DataRow[];
}

/**
 * The review (LR-06a, LR-WIZ-1): the contract told in a few sentences, then the data it is made of in four groups, each with its
 * «Modifica»; under them what the server checks, worst first (a block, a thing still missing, comes before everything: it is what to do).
 * A block (a thing still missing) must be put right at its step before the confirmation; a warning is to look at and does not stop;
 * what is to know needs nothing. The confirmation itself is the main button of the wizard. A later change of the first steps withdraws
 * it and asks for it again. The tinted block of the screen is the story; the rest is plain.
 */
export function ReviewStep({
  review,
  hrefOfStep,
  values,
  rules,
}: {
  review: UseQueryResult<LeaseReview>;
  hrefOfStep: (step: number) => string;
  /** What the form holds: the review is reached when the steps before it are saved, so these are the values of the contract. */
  values: WizardValues;
  rules: LongRentRules;
}) {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, error, refetch } = review;
  const property = useProperty(values.propertyId).data;

  if (isLoading) return <p role="status" className="text-sm text-muted-foreground">{t('leaseWizard.review.loading')}</p>;
  if (isError || !data) {
    return <ErrorState testId="lease-review-error" title={t('leaseWizard.review.loadError')} error={error} onRetry={() => void refetch()} />;
  }

  const language = i18n.language;
  const blocks = data.counts.block;
  const confirmedAt = data.reviewConfirmedAt ? formatRomeDateTime(data.reviewConfirmedAt, language) : '';
  const ok = data.checks.filter((check) => check.severity === 'Ok');
  const list = (names: string[]) => new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(names);
  const day = (date: string) => formatStayDate(date, language);
  const length = (months: number) => (months % 12 === 0 ? t('leaseWizard.dates.years', { count: months / 12 }) : t('leaseWizard.dates.months', { count: months }));

  // ---- the story: one short sentence for each thing the contract says
  const story = contractStory(values, rules, property?.name ?? '');
  const sentences: string[] = [];
  if (story.tenants.length > 0) {
    sentences.push(
      t('leaseWizardGuide.review.story.parties', {
        count: Math.max(story.landlords.length, 1),
        property: story.property || t('leaseWizardGuide.review.story.thisProperty'),
        tenants: list(story.tenants),
      }),
    );
  }
  if (story.start) {
    const dates = { from: day(story.start), to: story.end ? day(story.end) : '' };
    sentences.push(
      story.end && story.months !== null
        ? t('leaseWizardGuide.review.story.term', { ...dates, length: length(story.months) })
        : story.end
          ? t('leaseWizardGuide.review.story.termSpan', dates)
          : t('leaseWizardGuide.review.story.termFrom', dates),
    );
  }
  if (story.rent !== null) {
    const rent = money(story.rent, language);
    sentences.push(
      story.deposit === null
        ? t('leaseWizardGuide.review.story.moneyRentOnly', { rent })
        : story.deposit === 0
          ? t('leaseWizardGuide.review.story.moneyNoDeposit', { rent })
          : t('leaseWizardGuide.review.story.money', { rent, deposit: money(story.deposit, language) }),
    );
  }
  if (story.contractType && story.taxRegime) {
    sentences.push(
      t('leaseWizardGuide.review.story.kind', {
        type: getLeaseContractTypeLabel(story.contractType, t),
        regime: t(`leaseWizardGuide.review.story.regime.${story.taxRegime}`),
      }),
    );
  }

  // ---- the data, in four groups; each one is edited at its own step
  const people = (rows: WizardValues['landlords']) =>
    rows.filter((row) => !isBlankRow(row)).map((row) => [partyName(row), row.fiscalCode.trim().toUpperCase()].filter(Boolean).join(' · '));
  const groups: DataGroup[] = [
    {
      id: 'house',
      title: t('leaseWizardGuide.review.groups.house'),
      step: 1,
      rows: [{ lines: [property?.name ?? '', [property?.address, property?.city].filter(Boolean).join(', ')].filter(Boolean) }],
    },
    {
      id: 'people',
      title: t('leaseWizardGuide.review.groups.people'),
      step: 2,
      rows: [
        { label: t('leaseWizardGuide.review.rows.landlords'), lines: people(values.landlords) },
        { label: t('leaseWizardGuide.review.rows.tenants'), lines: people(values.tenants) },
      ],
    },
    {
      id: 'terms',
      title: t('leaseWizardGuide.review.groups.terms'),
      step: 3,
      rows: [
        { label: t('leaseWizardGuide.review.rows.type'), lines: values.contractType ? [getLeaseContractTypeLabel(values.contractType, t)] : [] },
        { label: t('leaseWizardGuide.review.rows.regime'), lines: values.taxRegime ? [getLeaseTaxRegimeLabel(values.taxRegime, t)] : [] },
        { label: t('leaseWizardGuide.review.rows.rent'), lines: story.rent !== null ? [money(story.rent, language)] : [] },
        { label: t('leaseWizardGuide.review.rows.deposit'), lines: story.deposit !== null ? [money(story.deposit, language)] : [] },
      ],
    },
    {
      id: 'dates',
      title: t('leaseWizardGuide.review.groups.dates'),
      step: 4,
      rows: [
        { label: t('leaseWizardGuide.review.rows.start'), lines: story.start ? [day(story.start)] : [] },
        { label: t('leaseWizardGuide.review.rows.end'), lines: story.end ? [day(story.end)] : [] },
      ],
    },
  ];

  const checksOf = (severity: LeaseReviewSeverity) => {
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
  };

  return (
    <div className="space-y-6" data-testid="lease-review">
      {data.reviewConfirmedAt ? (
        <p className="flex items-start gap-2 text-sm text-[color:var(--color-success-foreground,#166534)]" data-testid="lease-review-confirmed">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">{t('leaseWizard.review.confirmed', { date: confirmedAt })}</span>
        </p>
      ) : blocks > 0 ? (
        <p className="text-sm font-medium" data-testid="lease-review-blocked">
          {t('leaseWizard.review.blocked', { count: blocks })}
        </p>
      ) : null}

      {/* A thing still missing comes first: it is what there is to do. */}
      {checksOf(BLOCK)}

      {sentences.length > 0 ? (
        <section className="space-y-2" aria-labelledby="lw-story-title" data-testid="lease-review-story">
          <h3 id="lw-story-title" className="text-sm font-semibold">
            {t('leaseWizardGuide.review.story.title')}
          </h3>
          <div className="space-y-1.5 rounded-xl bg-muted/50 p-4 text-base">
            {sentences.map((sentence, index) => (
              <p key={index} className="break-words">
                {sentence}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <div className="divide-y rounded-xl ring-1 ring-inset ring-border" data-testid="lease-review-data">
        {groups.map((group) => (
          <section key={group.id} aria-labelledby={`lw-data-${group.id}`} className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0 space-y-1">
              <h3 id={`lw-data-${group.id}`} className="text-sm font-semibold">
                {group.title}
              </h3>
              <dl className="space-y-1 text-sm">
                {group.rows
                  .filter((row) => row.lines.length > 0)
                  .map((row, index) => (
                    <div key={row.label ?? index} className="flex flex-wrap gap-x-2">
                      {row.label ? <dt className="text-muted-foreground">{row.label}</dt> : null}
                      <dd className="min-w-0 break-words font-medium">
                        {row.lines.map((line) => (
                          <span key={line} className="block">
                            {line}
                          </span>
                        ))}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
            <Link
              to={hrefOfStep(group.step)}
              aria-label={t('leaseWizardGuide.review.editGroup', { group: group.title })}
              className="inline-flex min-h-11 shrink-0 items-center rounded-md px-1 text-sm font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t('leaseWizardGuide.review.edit')}
            </Link>
          </section>
        ))}
      </div>

      {NOT_BLOCKING.map(checksOf)}

      {ok.length > 0 ? (
        <details className="space-y-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">{t('leaseWizard.review.group.Ok', { count: ok.length })}</summary>
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
