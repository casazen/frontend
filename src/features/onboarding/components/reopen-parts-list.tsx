import { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage } from '@/lib/api-errors';
import { resolveLaunchTarget, type LaunchFocus } from '@/lib/onboarding-part-launch';
import { isOnboardingPartKey, normalizePartState, partTitleKey } from '@/lib/onboarding-parts';
import { useReopenPart } from '@/queries/use-onboarding-integration';
import type { ChannelStatusCount, IntegrationPart, OnboardingPartKey, SenderCounts } from '@/types/onboarding.types';
import { PartStateBadge } from './onboarding-part-row';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

/** The three things a host comes back to change: who sends the Alloggiati communications, a channel and the properties (AC-NF108-2, AC-NF108-3). */
const QUICK_ACTIONS: ReadonlyArray<{ part: OnboardingPartKey; focus?: LaunchFocus; labelKey: string }> = [
  { part: 'compliance', focus: 'sender', labelKey: 'onboardingPlan.integration.quick.sender' },
  { part: 'channels', labelKey: 'onboardingPlan.integration.quick.channel' },
  { part: 'properties', labelKey: 'onboardingPlan.integration.quick.properties' },
];

/** The senders in the order the page lists them, with the key of their words. */
const SENDER_ROWS: ReadonlyArray<{ field: keyof SenderCounts; labelKey: string }> = [
  { field: 'channelManager', labelKey: 'onboardingPlan.integration.senders.channelManager' },
  { field: 'casaZen', labelKey: 'onboardingPlan.integration.senders.casaZen' },
  { field: 'manual', labelKey: 'onboardingPlan.integration.senders.manual' },
  { field: 'notSet', labelKey: 'onboardingPlan.integration.senders.notSet' },
];

const CHANNEL_STATUSES: ReadonlySet<string> = new Set(['Draft', 'Sending', 'Accepted', 'Published', 'ToFix', 'ManagedOnChannel']);

/** The parts of the overview this version knows, in the order of the plan and once each: a part it does not know has no title to show, never a bare key. */
function knownIntegrationParts(parts: readonly IntegrationPart[] | undefined): IntegrationPart[] {
  if (!Array.isArray(parts)) return [];
  const seen = new Set<string>();
  const known: IntegrationPart[] = [];
  for (const part of parts) {
    if (!part || !isOnboardingPartKey(part.code) || seen.has(part.code)) continue;
    seen.add(part.code);
    known.push(part);
  }
  return known.sort((a, b) => a.order - b.order);
}

/** A count the server sent as a number; anything else is 0 (never `NaN` on screen). */
function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

interface ReopenPartsListProps {
  parts: readonly IntegrationPart[];
  senders: SenderCounts;
  channels: readonly ChannelStatusCount[];
}

/**
 * What a host can change after the first set up (E10/F03/US03/T01, NF-108, ONB-05): three quick actions («Cambia chi invia le schedine», «Aggiungi un canale»,
 * «Aggiungi strutture»), the eleven parts of the plan with their state and «Riapri», and two blocks of figures, who sends the Alloggiati communications for how
 * many properties and how the listings stand on each channel. The page only reopens: `POST /onboarding/parts/{key}/reopen` clears the deferral and says where to
 * continue, and the wizard that owns the part does the work. A part nobody provides cannot be reopened and says so; a target that has no page yet keeps the person
 * here with «Non ancora disponibile», never a dead link.
 *
 * Every button of the page is off while a reopen is on its way (one at a time: a second press would reopen again), and a refusal of the server is said where the
 * person looks.
 */
export function ReopenPartsList({ parts, senders, channels }: ReopenPartsListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useWorkspace();
  const reopen = useReopenPart();
  const listId = useId();
  const [unavailablePart, setUnavailablePart] = useState<OnboardingPartKey | null>(null);

  const known = useMemo(() => knownIntegrationParts(parts), [parts]);
  const reopenableByCode = useMemo(() => new Map(known.map((part) => [part.code, part.reopenable === true])), [known]);
  const busy = reopen.isPending;

  function open(code: OnboardingPartKey, focus?: LaunchFocus) {
    setUnavailablePart(null);
    reopen.mutate(code, {
      onSuccess: (answer) => {
        // The wizard of the part, and for the compliance wizard the step of the sender the server names (or the one the quick action is about).
        const target = resolveLaunchTarget(answer.launchTarget, answer.focus === 'sender' ? 'sender' : (focus ?? null), null, hasPermission);
        if (target) navigate(target.to);
        else setUnavailablePart(code);
      },
    });
  }

  const sendersTotal = SENDER_ROWS.reduce((sum, row) => sum + count(senders?.[row.field]), 0);
  const channelRows = (Array.isArray(channels) ? channels : []).filter((row) => row && typeof row.status === 'string');
  const channelsTotal = channelRows.reduce((sum, row) => sum + count(row.count), 0);

  return (
    <div className="space-y-6" data-testid="reopen-parts">
      <section aria-labelledby={`${listId}-quick`} className="min-w-0 space-y-3" data-testid="reopen-quick-actions">
        <h2 id={`${listId}-quick`} className="text-lg font-semibold">
          {t('onboardingPlan.integration.quick.title')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => {
            const reopenable = reopenableByCode.get(action.part) === true;
            return (
              <Button
                key={action.part}
                type="button"
                variant="outline"
                className={TOUCH_TARGET}
                disabled={!reopenable || (busy && reopen.variables !== action.part)}
                loading={busy && reopen.variables === action.part}
                aria-describedby={!reopenable ? `${listId}-${action.part}-note` : undefined}
                onClick={() => open(action.part, action.focus)}
                data-testid={`reopen-quick-${action.part}`}
              >
                {t(action.labelKey)}
              </Button>
            );
          })}
        </div>
      </section>

      {reopen.isError ? (
        <p role="alert" className="text-sm text-danger-foreground" data-testid="reopen-error">
          {getProblemMessage(reopen.error, t) ?? t('onboardingPlan.integration.parts.error')}
        </p>
      ) : null}

      <section aria-labelledby={`${listId}-parts`} className="min-w-0 space-y-3">
        <h2 id={`${listId}-parts`} className="text-lg font-semibold">
          {t('onboardingPlan.integration.parts.title')}
        </h2>
        {known.length === 0 ? (
          <p className="text-sm text-foreground/70" data-testid="reopen-empty">
            {t('onboardingPlan.integration.parts.empty')}
          </p>
        ) : (
          <ol role="list" className="space-y-2" data-testid="reopen-parts-list">
            {known.map((part) => {
              const reopenable = part.reopenable === true;
              const noteId = `${listId}-${part.code}-note`;
              return (
                <li key={part.code} className="min-w-0 rounded-lg border bg-card p-3" data-testid={`reopen-part-${part.code}`}>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="break-words font-medium">{t(partTitleKey(part.code))}</p>
                      <PartStateBadge state={normalizePartState(part.state)} remindAt={part.remindAt ?? null} />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className={TOUCH_TARGET}
                      disabled={!reopenable || (busy && reopen.variables !== part.code)}
                      loading={busy && reopen.variables === part.code}
                      aria-label={t('onboardingPlan.integration.parts.reopenLabel', { part: t(partTitleKey(part.code)) })}
                      aria-describedby={!reopenable || unavailablePart === part.code ? noteId : undefined}
                      onClick={() => open(part.code)}
                      data-testid={`reopen-part-${part.code}-action`}
                    >
                      {t('onboardingPlan.integration.parts.reopen')}
                    </Button>
                  </div>
                  {!reopenable ? (
                    <p id={noteId} className="mt-2 text-sm text-foreground/70" data-testid={`reopen-part-${part.code}-note`}>
                      {t('onboardingPlan.integration.parts.notReopenable')}
                    </p>
                  ) : unavailablePart === part.code ? (
                    <p id={noteId} role="status" className="mt-2 text-sm text-foreground/70" data-testid={`reopen-part-${part.code}-unavailable`}>
                      {t('onboardingPlan.integration.parts.unavailable')}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
        <section aria-labelledby={`${listId}-senders`} className="min-w-0 space-y-3 rounded-lg border bg-card p-4" data-testid="integration-senders">
          <h2 id={`${listId}-senders`} className="text-lg font-semibold">
            {t('onboardingPlan.integration.senders.title')}
          </h2>
          {sendersTotal === 0 ? (
            <p className="text-sm text-foreground/70" data-testid="integration-senders-empty">
              {t('onboardingPlan.integration.senders.empty')}
            </p>
          ) : (
            <dl className="space-y-1 text-sm">
              {SENDER_ROWS.map((row) => (
                <div key={row.field} className="flex items-baseline justify-between gap-3" data-testid={`integration-sender-${row.field}`}>
                  <dt className="min-w-0 break-words">{t(row.labelKey)}</dt>
                  <dd className="shrink-0 font-semibold tabular-nums">{count(senders?.[row.field])}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section aria-labelledby={`${listId}-channels`} className="min-w-0 space-y-3 rounded-lg border bg-card p-4" data-testid="integration-channels">
          <h2 id={`${listId}-channels`} className="text-lg font-semibold">
            {t('onboardingPlan.integration.channels.title')}
          </h2>
          {channelRows.length === 0 || channelsTotal === 0 ? (
            <p className="text-sm text-foreground/70" data-testid="integration-channels-empty">
              {t('onboardingPlan.integration.channels.empty')}
            </p>
          ) : (
            <dl className="space-y-1 text-sm">
              {channelRows.map((row) => (
                <div key={row.status} className="flex items-baseline justify-between gap-3" data-testid={`integration-channel-${row.status}`}>
                  <dt className="min-w-0 break-words">
                    {CHANNEL_STATUSES.has(row.status) ? t(`onboardingPlan.integration.channels.status.${row.status}`) : t('onboardingPlan.integration.channels.status.other')}
                  </dt>
                  <dd className="shrink-0 font-semibold tabular-nums">{count(row.count)}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>
    </div>
  );
}
