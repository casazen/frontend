import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/hooks/useOrg';
import { getHttpStatus } from '@/lib/api-errors';
import { OWNER_STEP_PATH, ownerFactsToComplete } from '@/lib/owner-onboarding';
import { useOwnerReadiness } from '@/queries/use-owner-onboarding';
import { ReadyMark } from './owner-readiness-table';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

/**
 * The owner step in the plan «Inizia con CasaZen» (E10/F03/US05/T01, NF-109): a row after the properties and before the fiscal documents and the summary, for an
 * organization on the agency plan whose administrator reads it (the plan page decides: this component is not mounted otherwise, so nothing is read). It is a
 * plain row, never the highlighted block, because it is the accounting for the owners and never waits for, or holds up, the activation of the channels. It says where
 * the step stands only when the server said so: while it reads it says it is checking, and when the read fails it says it could not read, never «ready». The server
 * answering 404 (the module is off there) leaves no row at all.
 */
export function OwnerStepRow() {
  const { t } = useTranslation();
  const readiness = useOwnerReadiness(true);

  if (readiness.isError && getHttpStatus(readiness.error) === 404) return null;

  const report = readiness.isError ? null : (readiness.data ?? null);
  let state: boolean | undefined;
  let line: string;
  if (readiness.isError) {
    line = t('ownerOnboarding.step.readError');
  } else if (report === null) {
    line = t('ownerOnboarding.step.checking');
  } else {
    state = report.summary.financialReady;
    line = report.summary.owners === 0 ? t('ownerOnboarding.step.noOwners') : t('ownerOnboarding.step.counts', { count: report.summary.owners, toComplete: ownerFactsToComplete(report.summary) });
  }

  return (
    <li className="min-w-0 rounded-lg border p-4" data-testid="onboarding-owners-step" data-state={state === undefined ? 'unknown' : state ? 'done' : 'toComplete'}>
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-background ring-1 ring-inset ring-border">
          <Users className="size-5 text-foreground/80" />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="break-words text-base font-semibold leading-snug">{t('ownerOnboarding.step.title')}</h3>
            {state === undefined ? null : <ReadyMark ready={state} testId="onboarding-owners-step-state" />}
          </div>
          <p className="break-words text-sm text-foreground/70">{t('ownerOnboarding.step.what')}</p>
          <p className="break-words text-sm" data-testid="onboarding-owners-step-line">
            {line}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 pl-0 sm:pl-[3.25rem]">
        <Button asChild variant="outline" className={TOUCH_TARGET}>
          <Link to={OWNER_STEP_PATH} aria-label={`${t('ownerOnboarding.step.open')}: ${t('ownerOnboarding.step.title')}`} data-testid="onboarding-owners-step-open">
            {t('ownerOnboarding.step.open')}
          </Link>
        </Button>
      </div>
    </li>
  );
}

/**
 * The owner step of the plan for an org that is on the agency plan: the readiness is asked only when the entitlement of the org says so (`isAgency`, the plan the
 * server's agency policies ask for), because a read refused by the server (403) sends the whole app to the page of no access. While the plan is not known, and for any
 * other plan, nothing is drawn and nothing is read.
 */
export function OwnerStep() {
  const { isAgency } = useOrg();
  return isAgency ? <OwnerStepRow /> : null;
}
