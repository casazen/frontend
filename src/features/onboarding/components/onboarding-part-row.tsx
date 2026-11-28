import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  CircleDashed,
  Home,
  IdCard,
  Landmark,
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
  normalizePartState,
  partPath,
  partReasonTextKey,
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
  Landmark,
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
  remindAt: string | null;
}

export function PartStateBadge({ state, remindAt }: PartStateBadgeProps) {
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
  parts: readonly OnboardingPart[];
  highlighted: boolean;
  canDefer: boolean;
  canLaunch: boolean;
  adminNoteId?: string;
  onDefer: (part: OnboardingPart) => void;
}

export function OnboardingPartRow({ part, parts, highlighted, canLaunch, canDefer, adminNoteId, onDefer }: OnboardingPartRowProps) {
  const { t, i18n } = useTranslation();
  const state = normalizePartState(part.state);
  const title = t(partTitleKey(part.code));
  const PartIcon = PART_ICONS[ONBOARDING_PART_ICONS[part.code]];
  const showProgress = part.total > 0;

  const waitingFor = state === 'blocked' || state === 'deferred' ? partsWaitedFor(part, parts).map((waited) => t(partTitleKey(waited.code))) : [];
  let reason: string | null = null;
  if (state === 'blocked') {
    reason = waitingFor.length > 0 ? t(reasonKey('required_part_not_done'), { parts: waitingFor.join(', ') }) : t('onboardingPlan.reasons.unknown');
  } else if (state === 'deferred' && waitingFor.length > 0) {
    reason = t(reasonKey('required_part_not_done'), { parts: waitingFor.join(', ') });
  } else if (state !== 'done') {
    const keyOfReason = partReasonTextKey(part);
    reason = keyOfReason && i18n.exists(keyOfReason) ? t(keyOfReason) : t('onboardingPlan.reasons.unknown');
  }

  const canOpen = state === 'open' || (state === 'deferred' && waitingFor.length === 0);
  const resuming = state === 'deferred' || (part.done > 0 && part.done < part.total);
  const actionLabel = t(!canLaunch ? 'onboardingPlan.workspace.details' : resuming ? 'onboardingPlan.actions.resume'
    : highlighted && part.code === 'octorateConnection' ? 'onboardingPlan.workspace.connect'
    : 'onboardingPlan.actions.doNow');
  const canPutOff = state === 'open' || state === 'blocked';
  const notDeferrable = part.deferrable === false;
  const deferDisabled = notDeferrable || !canDefer;
  const deferNoteId = `onboarding-part-${part.code}-defer-note`;

  return (
    <li
      id={`passo-${part.code}`}
      tabIndex={-1}
      className={cn('min-w-0 scroll-mt-5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring', highlighted ? 'space-y-5' : 'py-3.5')}
      data-testid={`onboarding-part-${part.code}`}
      data-state={state}
      data-highlighted={highlighted ? 'true' : undefined}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className={cn('mt-0.5 grid shrink-0 place-items-center', highlighted ? 'size-11 rounded-xl bg-primary/10 text-primary-text' : 'size-7 text-foreground/60')}>
          <PartIcon className={highlighted ? 'size-6' : 'size-4'} />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className={cn('break-words font-semibold leading-snug', highlighted ? 'text-xl sm:text-2xl' : 'text-sm')}>{title}</h3>
            <PartStateBadge state={state} remindAt={part.remindAt} />
            {showProgress ? (
              <span className="text-sm text-foreground/70" data-testid="onboarding-part-progress">
                {t('onboardingPlan.progress', { done: part.done, total: part.total })}
              </span>
            ) : null}
          </div>
          {highlighted && <p className="max-w-prose break-words text-sm leading-relaxed text-foreground/75">{t(partWhatKey(part.code))}</p>}
          {reason ? (
            <p className={cn('break-words text-sm', highlighted ? 'text-foreground' : 'text-foreground/70')} data-testid="onboarding-part-reason">
              {reason}
            </p>
          ) : null}
        </div>
      </div>

      {canOpen || canPutOff ? (
        <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2', highlighted ? 'border-t pt-4' : 'mt-2 sm:pl-10')}>
          {canOpen ? (
            <Button asChild variant={highlighted ? 'default' : 'link'} className={TOUCH_TARGET}>
              <Link to={partPath(part.code)} aria-label={`${actionLabel}: ${title}`} data-testid={`onboarding-part-${part.code}-open`}>
                {actionLabel}{highlighted && <ArrowRight className="size-4" aria-hidden="true" />}
              </Link>
            </Button>
          ) : null}
          {canPutOff && !(highlighted && deferDisabled) ? (
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
          {canPutOff && notDeferrable && !highlighted ? (
            <p id={deferNoteId} className="min-w-0 basis-full text-sm text-foreground/70" data-testid={`onboarding-part-${part.code}-later-note`}>
              {t('onboardingPlan.defer.notDeferrable')}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
