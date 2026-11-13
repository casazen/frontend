import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, CircleDashed, CircleHelp, Unplug, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supportConfig } from '@/config/support.config';
import { useWorkspace } from '@/hooks/use-workspace';
import { resolveLaunchTarget } from '@/lib/onboarding-part-launch';
import { ONBOARDING_PLAN_PATH } from '@/lib/onboarding-parts';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { StatusTone } from '@/lib/status-dictionary';
import { TODO_LIST_PATH } from '@/features/todo/lib/todo-model';
import type { ConnectionHealth } from '@/types/onboarding.types';
import { StatePill } from './state-pill';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

type ConnectionStateKey = 'connected' | 'disconnected' | 'error' | 'never' | 'unknown';

/** How each state of the connection looks: a tone, an icon and (in the translations) its words, so that it is never told by color alone (UX-09). */
const STATE_VIEW: Record<ConnectionStateKey, { tone: StatusTone; Icon: LucideIcon }> = {
  connected: { tone: 'success', Icon: CheckCircle2 },
  disconnected: { tone: 'danger', Icon: Unplug },
  error: { tone: 'danger', Icon: AlertTriangle },
  never: { tone: 'neutral', Icon: CircleDashed },
  unknown: { tone: 'warning', Icon: CircleHelp },
};

/**
 * The state of the connection as the card says it. A connection never made (`null`) is told as such; a status this version of the app does not know (the
 * server is newer) is never read as «connected»: it says the state is not available.
 */
function stateOf(status: ConnectionHealth['status'] | string | undefined): ConnectionStateKey {
  if (status === null || status === undefined) return 'never';
  if (status === 'Connected') return 'connected';
  if (status === 'Disconnected') return 'disconnected';
  if (status === 'Error') return 'error';
  return 'unknown';
}

interface ConnectionHealthCardProps {
  connection: ConnectionHealth;
}

/**
 * The health of the connection to the channel manager (E10/F03/US03/T01, NF-108, UX-09): its state in words, colour and icon, the last synchronisation and, when
 * the environment is not production, a «prova» label. When the access was revoked (`reconnectRequired`) a red notice says so with the one button that matters,
 * «Ricollega il canale», which opens the consent step of the connect wizard in the same tab; a wizard that does not exist yet says «Non ancora disponibile» with the
 * support address, never a dead link. The answer holds no token or secret and the card shows none.
 */
export function ConnectionHealthCard({ connection }: ConnectionHealthCardProps) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const state = stateOf(connection.status);
  const { tone, Icon } = STATE_VIEW[state];
  const synced = connection.lastSyncedAt ? formatRomeDateTime(connection.lastSyncedAt, i18n.language, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const isProduction = connection.environment === 'Production';
  const reconnectTarget = connection.reconnectRequired ? resolveLaunchTarget('connect', null, null, hasPermission) : null;
  const supportEmail = supportConfig.email;

  return (
    <section
      aria-labelledby="integration-connection-title"
      className="min-w-0 space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4"
      data-testid="connection-health-card"
      data-state={state}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="integration-connection-title" className="text-lg font-semibold">
          {t('onboardingPlan.integration.connection.title')}
        </h2>
        <StatePill tone={tone} icon={Icon} label={t(`onboardingPlan.integration.connection.state.${state}`)} data-testid="connection-state" data-state={state} />
        {!isProduction ? <Badge variant="outline" data-testid="connection-environment-test">{t('onboardingPlan.integration.connection.environmentTest')}</Badge> : null}
      </div>

      <p className="text-sm text-foreground/70" data-testid="connection-last-sync">
        {synced ? t('onboardingPlan.integration.connection.lastSync', { date: synced }) : t('onboardingPlan.integration.connection.neverSynced')}
      </p>

      {state === 'never' ? (
        <div className="space-y-2" data-testid="connection-never">
          <p className="text-sm">{t('onboardingPlan.integration.connection.neverConnected')}</p>
          <Button asChild variant="outline" className={TOUCH_TARGET}>
            <Link to={ONBOARDING_PLAN_PATH} data-testid="connection-to-plan">
              {t('onboardingPlan.integration.connection.toPlan')}
            </Link>
          </Button>
        </div>
      ) : null}

      {connection.reconnectRequired ? (
        <div role="alert" className="min-w-0 space-y-3 rounded-md border border-danger-border bg-danger-soft p-3 text-danger-foreground" data-testid="connection-reconnect">
          <p className="break-words text-sm font-medium">{t('onboardingPlan.integration.connection.reconnect.notice')}</p>
          {reconnectTarget ? (
            <>
              <Button asChild className={TOUCH_TARGET}>
                <Link to={reconnectTarget.to} data-testid="connection-reconnect-action">
                  {t('onboardingPlan.integration.connection.reconnect.action')}
                </Link>
              </Button>
              <p className="text-sm">
                {t('onboardingPlan.integration.connection.reconnect.todo')}{' '}
                <Link to={TODO_LIST_PATH} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4" data-testid="connection-reconnect-todo">
                  {t('onboardingPlan.summary.activation.toTodo')}
                </Link>
              </p>
            </>
          ) : (
            <div className="space-y-1 text-sm" data-testid="connection-reconnect-unavailable">
              <p className="font-semibold">{t('onboardingPlan.integration.connection.reconnect.unavailable')}</p>
              {supportEmail ? (
                <p className="break-words">
                  {t('onboardingPlan.integration.connection.reconnect.writeTo')}{' '}
                  <a className="font-medium underline underline-offset-4" href={`mailto:${supportEmail}`}>
                    {supportEmail}
                  </a>
                </p>
              ) : (
                <p>{t('onboardingPlan.integration.connection.reconnect.contactSupport')}</p>
              )}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
