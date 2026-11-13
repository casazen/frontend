import { useContext, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Info, Loader2, RotateCw, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import { useCalendarChange, useRetryCalendarChange } from '@/queries/use-calendar-changes';
import type { CalendarChange } from '@/types/calendar-changes.types';
import { changeReadOf, propertyLineOf, type ChangeLineKind } from '../lib/calendar-change-words';

/** How a line stands. It is said in words (a hidden label) and by an icon, never by a color alone. */
type Tone = 'done' | 'working' | 'problem' | 'info';

const TONE_ICON: Record<Tone, LucideIcon> = { done: CheckCircle2, working: Loader2, problem: AlertTriangle, info: Info };

const TONE_COLOR: Record<Tone, string> = {
  done: 'text-[color:var(--color-success-foreground,#166534)]',
  working: 'text-[color:var(--color-info-foreground,#1f4fa8)] motion-safe:animate-spin',
  problem: 'text-[color:var(--color-warning-foreground,#8a4b05)]',
  info: 'text-foreground/70',
};

/** The words that say how a line stands, for who does not see the icon. The keys are written out so that the i18n test finds a missing translation. */
const TONE_LABEL_KEYS: Record<Tone, string> = {
  done: 'booking.calendar.change.tone.done',
  working: 'booking.calendar.change.tone.working',
  problem: 'booking.calendar.change.tone.problem',
  info: 'booking.calendar.change.tone.info',
};

const LINE_TONE: Record<ChangeLineKind, Tone> = {
  notConnected: 'info',
  waiting: 'working',
  sending: 'working',
  accepted: 'done',
  confirmed: 'done',
  failed: 'problem',
  noAnswer: 'problem',
  unreadable: 'problem',
  notFound: 'problem',
};

/** What each state of the change says about the channel manager, in plain words (never "published": accepted is not on the portals). */
const LINE_TEXT_KEYS: Record<ChangeLineKind, string> = {
  notConnected: 'booking.calendar.change.result.notConnected',
  waiting: 'booking.calendar.change.result.waiting',
  sending: 'booking.calendar.change.result.sending',
  accepted: 'booking.calendar.change.result.accepted',
  confirmed: 'booking.calendar.change.result.confirmed',
  failed: 'booking.calendar.change.result.failed',
  noAnswer: 'booking.calendar.change.result.noAnswer',
  unreadable: 'booking.calendar.change.result.unreadable',
  notFound: 'booking.calendar.change.result.notFound',
};

interface ResultLineProps {
  testId: string;
  tone: Tone;
  title: string;
  /** The state the line is in (`data-state`), for the tests and for whoever reads the page. */
  state: string;
  children: ReactNode;
  action?: ReactNode;
}

/** One line of the result: what it is about, how it stands and, when the host can do something about it, the button. */
function ResultLine({ testId, tone, title, state, children, action }: ResultLineProps) {
  const { t } = useTranslation();
  const Icon = TONE_ICON[tone];

  return (
    <li className="flex min-w-0 items-start gap-3 py-3" data-testid={testId} data-state={state} data-tone={tone}>
      <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', TONE_COLOR[tone])} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="break-words text-sm font-semibold">
          {title}
          <span className="sr-only">: {t(TONE_LABEL_KEYS[tone])}</span>
        </p>
        <div className="space-y-1 break-words text-sm text-foreground/80">{children}</div>
        {action ? <div className="flex flex-wrap items-center gap-2 pt-1">{action}</div> : null}
      </div>
    </li>
  );
}

interface CalendarChangeLinesProps {
  /** The change as the application answered it (the process of the API): it is on screen at once and then followed. */
  change: CalendarChange;
  /** The name of a property of the change. */
  propertyName: (propertyId: string) => string;
}

/**
 * What happened to a change of the calendar, one line per part with how it stands (E08/F05/US03/T02, T03, NF-36): "Saved in CasaZen" (the change is in the calendar of CasaZen
 * as soon as the API answers) and, for each property, what the channel manager did with it: waiting, being sent, accepted (never "published on the channels"), not sent with the
 * reason in words and "Retry now", or a property that is not connected, whose change stays in CasaZen. The change is followed every few seconds while it waits, up to a time
 * (then a neutral "no answer yet" with "Check again"). A part that is not completed is said as such, never as done. The buttons stay off while any request of the card is on its way.
 */
export function CalendarChangeLines({ change: initial, propertyName }: CalendarChangeLinesProps) {
  const { t } = useTranslation();
  const workspace = useContext(WorkspaceContext);
  // With the connector of the channel manager off nothing is sent or asked: a property that is not connected has nothing to say about it, and the change is just saved in CasaZen.
  const connectorOn = useFeatureFlags().flags.octorateConnector;
  // Without a workspace (a test) nothing is offered; the change is read only by who may read properties (a read they may not make would be a 403), and sent again only by who may write them.
  const mayRead = workspace?.hasPermission('short-rent', 'property.read') ?? false;
  const mayRetry = workspace?.hasPermission('short-rent', 'property.write') ?? false;

  const detail = useCalendarChange(initial.id, { enabled: mayRead, initial });
  const retry = useRetryCalendarChange();
  const change = detail.data ?? initial;
  const read = changeReadOf({ enabled: true, isError: detail.isError, notFound: getHttpStatus(detail.error) === 404, hasData: detail.data !== undefined });
  // Whoever may not read the change cannot follow it: what it was when the API answered is all there is, and it does not say more than that.
  const watchOver = detail.watchOver || (!mayRead && (change.state === 'Queued' || change.state === 'Sending'));
  const busy = retry.isPending;

  return (
    <ul className="divide-y rounded-lg border px-4" role="list" aria-live="polite" data-testid="calendar-change-lines">
      <ResultLine testId="calendar-change-saved" tone="done" state="saved" title={t('booking.calendar.change.result.savedTitle')}>
        <p>{t('booking.calendar.change.result.saved')}</p>
      </ResultLine>

      {change.properties.map((property) => {
        const line = propertyLineOf({ change, property, read, watchOver, mayRetry });
        if (line.kind === 'notConnected' && !connectorOn) return null;
        const reasonWithRetry = retry.isError && line.kind === 'failed';
        return (
          <ResultLine
            key={property.propertyId}
            testId="calendar-change-property"
            tone={LINE_TONE[line.kind]}
            state={line.kind}
            title={propertyName(property.propertyId)}
            action={
              (line.kind === 'noAnswer' || line.kind === 'unreadable') && mayRead ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  loading={detail.isFetching}
                  data-testid="calendar-change-check-again"
                  onClick={detail.checkAgain}
                >
                  {t('booking.calendar.change.result.checkAgain')}
                </Button>
              ) : line.canRetry ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  loading={retry.isPending}
                  data-testid="calendar-change-retry"
                  onClick={() => retry.mutate(change.id)}
                >
                  <RotateCw aria-hidden="true" className="size-4" />
                  {t('booking.calendar.change.result.retry')}
                </Button>
              ) : undefined
            }
          >
            <p>{t(LINE_TEXT_KEYS[line.kind])}</p>
            {line.reasonKey ? <p data-testid="calendar-change-reason">{t(line.reasonKey)}</p> : null}
            {/* The refusal of the last "Retry now", while there is still something to retry: once the state has moved on it is no longer the news. */}
            {reasonWithRetry ? (
              <p role="alert" className="text-destructive" data-testid="calendar-change-retry-error">
                {getProblemMessage(retry.error, t) ?? t('booking.calendar.change.result.retryFailed')}
              </p>
            ) : null}
          </ResultLine>
        );
      })}
    </ul>
  );
}
