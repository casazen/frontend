import { AlertTriangle, CheckCircle2, CircleAlert } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { CheckInIssue, CheckInWizardState } from '@/types/checkin-wizard.types';
import { FOCUS_PARAM, ISSUE_FIELD_LABEL_KEYS, ISSUE_TEXT_KEYS, issueTarget, sortedIssues } from '../lib/checkin-wizard-model';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/** The name of the guest an issue is about: their name, or "Guest N" while it is not known. */
function guestLabel(state: CheckInWizardState, position: number | null, t: TranslateFn): string {
  const guest = position === null ? undefined : state.guests.find((candidate) => candidate.position === position);
  const name = `${guest?.firstName ?? ''} ${guest?.lastName ?? ''}`.trim();
  return name || t('checkin.guestHeading', { index: (position ?? 0) + 1 });
}

/** One issue in plain words: what is missing or odd, and for whom. Unknown codes and fields still read as a sentence. */
function issueSentence(issue: CheckInIssue, state: CheckInWizardState, t: TranslateFn): string {
  if (issue.field === 'guests') return t('checkin.wizard.checks.issue.noGuests');
  const registered = state.guests.filter((guest) => guest.saved).length;
  const key = ISSUE_TEXT_KEYS[issue.code] ?? 'checkin.wizard.checks.issue.unknown';
  const field = t(ISSUE_FIELD_LABEL_KEYS[issue.field ?? ''] ?? 'checkin.wizard.field.unknown');
  return t(key, {
    guest: guestLabel(state, issue.position, t),
    field,
    declared: state.booking.declaredGuests,
    registered,
  });
}

interface IssueListProps {
  issues: readonly CheckInIssue[];
  state: CheckInWizardState;
  tone: 'blocking' | 'warning';
  onFix: (issue: CheckInIssue) => void;
}

function IssueList({ issues, state, tone, onFix }: IssueListProps) {
  const { t } = useTranslation();
  const Icon = tone === 'blocking' ? CircleAlert : AlertTriangle;

  return (
    <ul className="space-y-2" data-testid={`checkin-wizard-issues-${tone}`}>
      {issues.map((issue, index) => {
        const sentence = issueSentence(issue, state, t);
        return (
          <li
            key={`${issue.code}-${issue.position ?? 'stay'}-${issue.field ?? 'none'}-${index}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border p-3"
            data-testid="checkin-wizard-issue"
            data-blocking={issue.blocking}
          >
            <Icon
              aria-hidden="true"
              className={tone === 'blocking' ? 'size-5 shrink-0 text-destructive' : 'size-5 shrink-0 text-orange-600'}
            />
            <span className="min-w-0 flex-1 break-words text-sm">{sentence}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11"
              aria-label={t('checkin.wizard.checks.fixFor', { problem: sentence })}
              onClick={() => onFix(issue)}
              data-testid="checkin-wizard-issue-fix"
            >
              {t('checkin.wizard.checks.fix')}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The checks step: what the checks found on the data of the stay, blocking issues first, each in plain words with a "Fix" that moves to the
 * step of the field, with the field in focus (never to another page). A warning (an expired document, a guest count that differs) may be left
 * as it is: "Continue anyway". With nothing to say: "Everything is in place".
 */
export function ChecksStep({ state }: { state: CheckInWizardState }) {
  const { t } = useTranslation();
  const [, setSearchParams] = useSearchParams();
  const issues = sortedIssues(state.issues);
  const blocking = issues.filter((issue) => issue.blocking);
  const warnings = issues.filter((issue) => !issue.blocking);

  const fix = (issue: CheckInIssue) => {
    const target = issueTarget(issue);
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set('step', target.step);
      if (target.fieldId) next.set(FOCUS_PARAM, target.fieldId);
      else next.delete(FOCUS_PARAM);
      return next;
    });
  };

  if (issues.length === 0) {
    return (
      <Alert variant="success" icon={CheckCircle2} title={t('checkin.wizard.checks.allGood')} data-testid="checkin-wizard-checks-ok">
        {t('checkin.wizard.checks.allGoodText')}
      </Alert>
    );
  }

  return (
    <div className="space-y-6" data-testid="checkin-wizard-checks">
      {blocking.length > 0 && (
        <section className="space-y-3" aria-labelledby="checkin-wizard-blocking-title">
          <h3 id="checkin-wizard-blocking-title" className="text-base font-semibold">
            {t('checkin.wizard.checks.blockingTitle', { count: blocking.length })}
          </h3>
          <p className="text-sm text-muted-foreground">{t('checkin.wizard.checks.blockingText')}</p>
          <IssueList issues={blocking} state={state} tone="blocking" onFix={fix} />
        </section>
      )}
      {warnings.length > 0 && (
        <section className="space-y-3" aria-labelledby="checkin-wizard-warnings-title">
          <h3 id="checkin-wizard-warnings-title" className="text-base font-semibold">
            {t('checkin.wizard.checks.warningsTitle', { count: warnings.length })}
          </h3>
          <p className="text-sm text-muted-foreground">{t('checkin.wizard.checks.warningsText')}</p>
          <IssueList issues={warnings} state={state} tone="warning" onFix={fix} />
        </section>
      )}
    </div>
  );
}
