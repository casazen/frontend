import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Ban,
  CheckCircle2,
  CircleDashed,
  Home,
  IdCard,
  Link2,
  ListChecks,
  Lock,
  MessageSquare,
  PauseCircle,
  Receipt,
  Rocket,
  Share2,
  ShieldCheck,
  Store,
  Tag,
  type LucideIcon,
} from 'lucide-react';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import { Button } from '@/components/ui/button';
import {
  ONBOARDING_PART_ICONS,
  isOnboardingPartReason,
  normalizePartState,
  partPath,
  partTitleKey,
  partWhatKey,
  partsWaitedFor,
  reasonKey,
  stateKey,
  type OnboardingPartIconName,
} from '@/lib/onboarding-parts';
import type { StatusTone } from '@/lib/status-dictionary';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import type { OnboardingPart, OnboardingPartState } from '@/types/onboarding.types';

const PART_ICONS: Record<OnboardingPartIconName, LucideIcon> = {
  Link2,
  Home,
  Share2,
  ListChecks,
  Tag,
  ShieldCheck,
  IdCard,
  MessageSquare,
  Receipt,
  Store,
  Rocket,
};

/**
 * How each state looks: a tone, an icon and (in the translations) its words, so that a state is never told by color alone (UX-09). The tones are
 * the semantic tokens of the redesign, the pairs of every status badge of the app (all meet AA).
 */
const STATE_VIEW: Record<OnboardingPartState, { tone: StatusTone; Icon: LucideIcon }> = {
  done: { tone: 'success', Icon: CheckCircle2 },
  open: { tone: 'info', Icon: CircleDashed },
  deferred: { tone: 'warning', Icon: PauseCircle },
  blocked: { tone: 'neutral', Icon: Lock },
  notAvailable: { tone: 'neutral', Icon: Ban },
};

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways (as the buttons of the calm blocks). */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

interface PartStateBadgeProps {
  state: OnboardingPartState;
  /** When the «Da fare» of a deferral is due (UTC): the badge of a deferred part says it. */
  remindAt: string | null;
}

/** The state of a part: an icon, a word and a tint. A deferred part says until when. */
function PartStateBadge({ state, remindAt }: PartStateBadgeProps) {
  const { t, i18n } = useTranslation();
  const { tone, Icon } = STATE_VIEW[state];
  const reminder = state === 'deferred' && remindAt ? formatRomeDateTime(remindAt, i18n.language, { day: 'numeric', month: 'long' }) : '';
  const label = reminder ? t('onboardingPlan.states.deferredUntil', { date: reminder }) : t(stateKey(state));

  return (
    <span
      data-testid="onboarding-part-state"
      className={cn('inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ring-inset', STATUS_TONE_CLASSES[tone])}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 break-words">{label}</span>
    </span>
  );
}

interface OnboardingPartRowProps {
  part: OnboardingPart;
  /** Every known part of the plan: a part that is blocked names the ones it waits for. */
  parts: readonly OnboardingPart[];
  /** The one highlighted block of the page: the first part that is open. */
  highlighted: boolean;
  /** An organization administrator may put a part off; anyone else sees the plan and no deferral (the server answers 403 to them). */
  canDefer: boolean;
  /** The sentence of the page that says why a deferral is not for this person, to tie the disabled button to. */
  adminNoteId?: string;
  onDefer: (part: OnboardingPart) => void;
}

/**
 * One part of the plan «Inizia con CasaZen» (NF-104, ONB-01): its title and what it is for, the state (icon, color and words), how far it is
 * («2 di 5»), the reason in plain words and the two actions, «Fai ora» (or «Riprendi») that opens the wizard that owns the part and «Lo faccio
 * dopo». A part that is done has nothing to do, one that is not available says why and has no button, one that is blocked names the part it
 * waits for. «Lo faccio dopo» is disabled, with its reason, for a part another part needs and for who is not an organization administrator.
 */
export function OnboardingPartRow({ part, parts, highlighted, canDefer, adminNoteId, onDefer }: OnboardingPartRowProps) {
  const { t, i18n } = useTranslation();
  const state = normalizePartState(part.state);
  const title = t(partTitleKey(part.code));
  const PartIcon = PART_ICONS[ONBOARDING_PART_ICONS[part.code]];
  const showProgress = part.total > 0;

  // The reason in plain words; one this version has no text for falls back to a neutral line, never to the code.
  const waitingFor = state === 'blocked' ? partsWaitedFor(part, parts).map((waited) => t(partTitleKey(waited.code))) : [];
  let reason: string | null = null;
  if (state === 'blocked') {
    reason = waitingFor.length > 0 ? t(reasonKey('required_part_not_done'), { parts: waitingFor.join(', ') }) : t('onboardingPlan.reasons.unknown');
  } else if (state !== 'done') {
    const keyOfReason = isOnboardingPartReason(part.reason) ? reasonKey(part.reason) : null;
    reason = keyOfReason && i18n.exists(keyOfReason) ? t(keyOfReason) : t('onboardingPlan.reasons.unknown');
  }

  const canOpen = state === 'open' || state === 'deferred';
  const resuming = state === 'deferred' || (part.done > 0 && part.done < part.total);
  const actionLabel = t(resuming ? 'onboardingPlan.actions.resume' : 'onboardingPlan.actions.doNow');
  // «Lo faccio dopo» has a place on a part that is open or blocked; one already put off, done or not available has nothing to postpone.
  const canPutOff = state === 'open' || state === 'blocked';
  // The plan says `false` for a part another part needs; only that says it, so an answer without the field leaves the choice to the server.
  const notDeferrable = part.deferrable === false;
  const deferDisabled = notDeferrable || !canDefer;
  const deferNoteId = `onboarding-part-${part.code}-defer-note`;

  return (
    <li
      className={cn('min-w-0 rounded-lg border p-4', highlighted && 'border-primary/30 bg-primary/5')}
      data-testid={`onboarding-part-${part.code}`}
      data-state={state}
      data-highlighted={highlighted ? 'true' : undefined}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-background ring-1 ring-inset ring-border">
          <PartIcon className="size-5 text-foreground/80" />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="break-words text-base font-semibold leading-snug">{title}</h3>
            <PartStateBadge state={state} remindAt={part.remindAt} />
            {showProgress ? (
              <span className="text-sm text-foreground/70" data-testid="onboarding-part-progress">
                {t('onboardingPlan.progress', { done: part.done, total: part.total })}
              </span>
            ) : null}
          </div>
          <p className="break-words text-sm text-foreground/70">{t(partWhatKey(part.code))}</p>
          {reason ? (
            <p className="break-words text-sm" data-testid="onboarding-part-reason">
              {reason}
            </p>
          ) : null}
        </div>
      </div>

      {canOpen || canPutOff ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-0 sm:pl-[3.25rem]">
          {canOpen ? (
            <Button asChild variant={highlighted ? 'default' : 'outline'} className={TOUCH_TARGET}>
              <Link to={partPath(part.code)} aria-label={`${actionLabel}: ${title}`} data-testid={`onboarding-part-${part.code}-open`}>
                {actionLabel}
              </Link>
            </Button>
          ) : null}
          {canPutOff ? (
            <Button
              type="button"
              variant={highlighted ? 'outline' : 'ghost'}
              className={TOUCH_TARGET}
              disabled={deferDisabled}
              aria-label={`${t('onboardingPlan.actions.later')}: ${title}`}
              aria-describedby={notDeferrable ? deferNoteId : !canDefer ? adminNoteId : undefined}
              onClick={() => onDefer(part)}
              data-testid={`onboarding-part-${part.code}-later`}
            >
              {t('onboardingPlan.actions.later')}
            </Button>
          ) : null}
          {canPutOff && notDeferrable ? (
            <p id={deferNoteId} className="min-w-0 basis-full text-sm text-foreground/70" data-testid={`onboarding-part-${part.code}-later-note`}>
              {t('onboardingPlan.defer.notDeferrable')}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
