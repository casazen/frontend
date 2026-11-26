import { CheckCircle2 } from 'lucide-react';
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
  const byGuest = new Map<number | null, CheckInIssue[]>();
  for (const issue of issues) {
    const group = byGuest.get(issue.position);
    if (group) group.push(issue);
    else byGuest.set(issue.position, [issue]);
  }

  return (
    <div className="space-y-4" data-testid={`checkin-wizard-issues-${tone}`}>
      {Array.from(byGuest, ([position, group]) => {
        const label = position === null ? t('checkin.wizard.checks.entireStay') : guestLabel(state, position, t);
        const headingId = `checkin-issues-${tone}-${position ?? -1}`;
        return (
          <section key={headingId} aria-labelledby={headingId} className="overflow-hidden rounded-2xl border bg-card">
            <h4 id={headingId} className="break-words border-b border-border bg-muted/50 px-4 py-3 font-semibold">{label}</h4>
            <ul className="divide-y divide-border">
              {group.map((issue, index) => {
                const sentence = issueSentence(issue, state, t);
                return (
                  <li
                    key={`${issue.code}-${issue.field ?? 'none'}-${index}`}
                    data-testid="checkin-wizard-issue"
                    data-blocking={issue.blocking}
                    className="grid min-w-0 items-center gap-x-4 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <span className="break-words">{sentence}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="link"
                      className="min-h-11 justify-self-start px-0 text-primary-text"
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
          </section>
        );
      })}
    </div>
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
