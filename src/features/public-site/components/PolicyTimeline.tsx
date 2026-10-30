import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatStayDate } from '@/lib/stay-dates';

type StageId = 'full' | 'partial' | 'none';

interface Stage {
  id: StageId;
  percent: number;
  /** Last day (included) of the stage, `YYYY-MM-DD`; `null` for the last stage, which has no end. */
  until: string | null;
}

interface PolicyTimelineProps {
  /** Last day (included) with the full refund; `null` when the policy never refunds in full. */
  fullRefundUntil: string | null;
  /** The share of the partial window; `null` when the policy has none. */
  partialRefundPercent: number | null;
  /** Last day (included) with the partial refund. */
  partialRefundUntil: string | null;
  /** The day the figures were worked out, `YYYY-MM-DD` (Europe/Rome): the stage it falls in is marked. */
  today: string;
  /** The text of the policy, shown in place of the stages when the policy has no date to draw. */
  description?: string | null;
  className?: string;
}

/** The stages of the policy of a stay, in order, with the real dates. The last one (no refund of the stay) always exists. */
function stagesOf({ fullRefundUntil, partialRefundPercent, partialRefundUntil }: PolicyTimelineProps): Stage[] {
  const stages: Stage[] = [];
  if (fullRefundUntil) stages.push({ id: 'full', percent: 100, until: fullRefundUntil });
  if (partialRefundPercent !== null && partialRefundUntil) {
    stages.push({ id: 'partial', percent: partialRefundPercent, until: partialRefundUntil });
  }
  stages.push({ id: 'none', percent: 0, until: null });
  return stages;
}

const BAR_TONE: Record<StageId, string> = {
  full: 'bg-primary',
  partial: 'bg-primary/50',
  none: 'bg-muted-foreground/30',
};

/**
 * The cancellation policy of a stay as stages with real dates (DB-08b; a public-site component so the property page and the checkout can
 * use the same one when they show the rules, DB-04a/DB-05): the full refund
 * up to a day, a share up to another, then nothing. The dates come from the backend (the last whole day of each window); the browser only
 * writes them. The stage of the day the figures were worked out is marked. With no window to draw (a policy that never refunds, or a
 * stay without a policy) it writes the description of the policy, or that nothing of the stay price is refunded. The list is the text
 * alternative of the bars. Colors come from the tokens of the site.
 */
export function PolicyTimeline(props: PolicyTimelineProps) {
  const { t, i18n } = useTranslation();
  const { today, description, className } = props;
  const stages = stagesOf(props);
  const day = (value: string) => formatStayDate(value, i18n.language, { day: 'numeric', month: 'long' });

  if (stages.length === 1) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)} data-testid="policy-timeline-none">
        {description ?? t('guestCancellation.timeline.noneOnly')}
      </p>
    );
  }

  const currentIndex = stages.findIndex((stage) => stage.until === null || today <= stage.until);

  const label = (stage: Stage): string => {
    if (stage.id === 'full') return t('guestCancellation.timeline.full', { date: day(stage.until ?? '') });
    if (stage.id === 'partial') {
      return t('guestCancellation.timeline.partial', { percent: stage.percent, date: day(stage.until ?? '') });
    }
    return t('guestCancellation.timeline.none');
  };

  return (
    <div className={cn('space-y-2', className)} data-testid="policy-timeline">
      <div className="flex gap-1" aria-hidden="true">
        {stages.map((stage, index) => (
          <div
            key={stage.id}
            className={cn('h-2 min-w-0 flex-1 rounded-full', BAR_TONE[stage.id], index === currentIndex && 'h-3 -my-0.5')}
          />
        ))}
      </div>
      <ol className="space-y-1 text-sm" aria-label={t('guestCancellation.timeline.label')}>
        {stages.map((stage, index) => (
          <li
            key={stage.id}
            aria-current={index === currentIndex ? 'step' : undefined}
            className={cn('min-w-0 break-words', index === currentIndex ? 'font-medium' : 'text-muted-foreground')}
            data-testid={`policy-timeline-${stage.id}`}
          >
            {label(stage)}
            {index === currentIndex && (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {t('guestCancellation.timeline.today')}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
