import { useTranslation } from 'react-i18next';
import { Ban, CheckCircle2, CircleDashed, type LucideIcon } from 'lucide-react';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import { flowStateKey, normalizeFlowState } from '@/lib/onboarding-flows';
import type { StatusTone } from '@/lib/status-dictionary';
import { cn } from '@/lib/utils';
import type { OnboardingFlowState } from '@/types/onboarding.types';

/** How each state looks: a tone, an icon and (in the translations) its words, so that a state is never told by color alone (UX-09). */
const STATE_VIEW: Record<OnboardingFlowState, { tone: StatusTone; Icon: LucideIcon }> = {
  active: { tone: 'success', Icon: CheckCircle2 },
  toComplete: { tone: 'warning', Icon: CircleDashed },
  notAvailable: { tone: 'neutral', Icon: Ban },
};

interface FlowStateBadgeProps {
  state: OnboardingFlowState | string;
  className?: string;
  'data-testid'?: string;
}

/** Where a flow stands on a property: «Attivo», «Da completare» or «Non disponibile», with an icon and a tint (UX-09). */
export function FlowStateBadge({ state, className, 'data-testid': testId }: FlowStateBadgeProps) {
  const { t } = useTranslation();
  const known = normalizeFlowState(state);
  const { tone, Icon } = STATE_VIEW[known];

  return (
    <span
      data-testid={testId ?? 'flow-state'}
      data-state={known}
      className={cn('inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ring-inset', STATUS_TONE_CLASSES[tone], className)}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 break-words">{t(flowStateKey(known))}</span>
    </span>
  );
}
