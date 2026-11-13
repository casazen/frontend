import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { cn } from '@/lib/utils';
import { ownerReadStateOf, type OwnerReadState } from './owner-portal-model';
import { ownerPortalPaths } from './paths';

/** The title of a page of the portal and, under it, what the page is for. One `h1` for each page. */
export function PortalPageHeading({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="break-words text-2xl font-bold text-[#1f3a3d] sm:text-3xl">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex min-w-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** A section that waits for its read: one announced placeholder, never an empty list that would say «nothing here» before the server answered. */
export function PortalLoading({ label }: { label?: string }) {
  return <SkeletonCard lines={3} label={label} />;
}

/**
 * The touch target of a button or of a link made to look like one: at least 44 px high whatever the pointer, and a label that is long (in Italian, in English, on a phone) goes
 * to the next line instead of pushing the page sideways (a button does not wrap its label by itself).
 */
export const TOUCH = 'h-auto min-h-11 whitespace-normal py-2 text-center';

const STATE_VARIANT: Record<Exclude<OwnerReadState, 'failed'>, 'info' | 'warning'> = {
  unavailable: 'info',
  permission: 'warning',
  ownerOnly: 'info',
  forbidden: 'warning',
};

interface PortalReadProblemProps {
  error: unknown;
  /** What failed to load, for the case that can be tried again («Impossibile caricare il calendario»). */
  failedTitle: string;
  onRetry: () => void;
  testId?: string;
}

/** The honest state of a section that is refused or not open: what is true, and the way back. Never an empty list. */
export function PortalNotice({ state, testId = 'owner-read-problem' }: { state: Exclude<OwnerReadState, 'failed'>; testId?: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3" data-testid={testId} data-state={state}>
      <Alert variant={STATE_VARIANT[state]} title={t(`ownerPortal.states.${state}.title`)} role="status">
        {t(`ownerPortal.states.${state}.description`)}
      </Alert>
      <Button asChild variant="outline" className={TOUCH}>
        <Link to={ownerPortalPaths.home}>{t('ownerPortal.states.backHome')}</Link>
      </Button>
    </div>
  );
}

/**
 * What a section says when its read did not bring data (E07/F07/US01/T03). A refusal of the section is the section's own honest state, not «no access» for the
 * whole portal and not an empty list: the part is not open (404), the owner did not give the person this permission (403 `owner_portal_permission_missing`),
 * only an owner does this (403 `owner_contact_owner_only`), anything else is refused (403). Whatever can pass (no answer, a 5xx) is an error with «Riprova»,
 * never «everything is in order».
 */
export function PortalReadProblem({ error, failedTitle, onRetry, testId = 'owner-read-problem' }: PortalReadProblemProps) {
  const state = ownerReadStateOf(error);
  if (state === 'failed') return <ErrorState title={failedTitle} error={error} onRetry={onRetry} testId={testId} />;
  return <PortalNotice state={state} testId={testId} />;
}

interface CheckRowProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  testId?: string;
}

/**
 * A box with its words, the whole row being the target of a touch: at least 44 px high and as wide as its container, so that a finger finds it on a phone and the
 * label is read with the box. A native box: it is reached with the keyboard and announced as a checkbox with its name and its description.
 */
export function CheckRow({ id, checked, onChange, label, description, disabled = false, testId }: CheckRowProps) {
  return (
    <label htmlFor={id} className="flex min-h-11 w-full min-w-0 cursor-pointer items-start gap-3 rounded-md px-1 py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 accent-[#1f3a3d]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={description ? `${id}-description` : undefined}
        data-testid={testId}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description ? (
          <span id={`${id}-description`} className="block text-sm text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export type PillTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

// Dark text on a soft background with an edge, from the semantic tokens (the fallbacks are the values of the redesign): the text is the page foreground, so the pair meets AA
// whatever the tone. A filled badge with white text does not (white on green-500 is 2.2:1).
const PILL_TONE: Record<PillTone, string> = {
  success: 'bg-[color:var(--color-success-soft,#eaf7ee)] ring-[color:var(--color-success-border,#b7e2c3)]',
  warning: 'bg-[color:var(--color-warning-soft,#fef4e2)] ring-[color:var(--color-warning-border,#f5d49a)]',
  danger: 'bg-[color:var(--color-danger-soft,#fdedee)] ring-[color:var(--color-danger-border,#f4b8bb)]',
  info: 'bg-[color:var(--color-info-soft,#ecf2fd)] ring-[color:var(--color-info-border,#b9cdf3)]',
  neutral: 'bg-muted ring-border',
};

/** Where something stands, in a word: the tone says it at a glance and the word says it to everyone. */
export function StatusPill({ tone, className, children, ...rest }: { tone: PillTone } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-foreground ring-1 ring-inset', PILL_TONE[tone], className)} {...rest}>
      {children}
    </span>
  );
}
