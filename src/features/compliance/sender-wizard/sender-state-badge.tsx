import { CheckCircle2, CircleHelp, Hand, Hourglass, XCircle, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { SenderOutcome } from './sender-wizard-model';

/**
 * The look of an outcome: an icon, a word and a colour together (the colour is never the only sign). Only `active` is green, and `active` is only ever the word of the
 * server; the host's own word («Dichiarato attivo») and what CasaZen cannot tell are shown as what they are, never as working.
 */
const LOOK: Record<SenderOutcome, { Icon: LucideIcon; tone: string }> = {
  active: {
    Icon: CheckCircle2,
    tone: 'bg-[color:var(--color-success-soft,#eaf7ee)] text-[color:var(--color-success-foreground,#166534)] ring-[color:var(--color-success-border,#b7e2c3)]',
  },
  declared: {
    Icon: Hand,
    tone: 'bg-[color:var(--color-info-soft,#ecf2fd)] text-[color:var(--color-info-foreground,#1f4fa8)] ring-[color:var(--color-info-border,#b9cdf3)]',
  },
  unverified: {
    Icon: CircleHelp,
    tone: 'bg-[color:var(--color-warning-soft,#fef4e2)] text-[color:var(--color-warning-foreground,#8a4b05)] ring-[color:var(--color-warning-border,#f5d49a)]',
  },
  inactive: {
    Icon: XCircle,
    tone: 'bg-[color:var(--color-danger-soft,#fdedee)] text-[color:var(--color-danger-foreground,#b4232a)] ring-[color:var(--color-danger-border,#f4b8bb)]',
  },
  manual: {
    Icon: Hand,
    tone: 'bg-muted text-foreground ring-border',
  },
  notAvailable: {
    Icon: Hourglass,
    tone: 'bg-muted text-foreground ring-border',
  },
};

interface SenderStateBadgeProps {
  outcome: SenderOutcome;
  testId?: string;
}

/** «Attivo», «Dichiarato attivo», «Non verificato», «Non attivo», «Invio a mano» or «Non ancora disponibile»: the state of the sender in one word. */
export function SenderStateBadge({ outcome, testId = 'sender-state' }: SenderStateBadgeProps) {
  const { t } = useTranslation();
  const { Icon, tone } = LOOK[outcome];

  return (
    <span
      data-testid={testId}
      data-state={outcome}
      className={cn('inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset', tone)}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 break-words">{t(`compliance.sender.state.${outcome}`)}</span>
    </span>
  );
}
