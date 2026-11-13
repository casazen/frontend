import type { ReactNode } from 'react';
import { CheckCircle2, CircleHelp, Hand, RefreshCw, XCircle, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import { useConnectionHealth } from '@/queries/compliance-health';
import type { ConnectionHealthLine, ConnectionHealthState } from '@/types';
import type { ComplianceHandoffTopic } from '@/types/compliance-handoff.types';
import { ComplianceDrawerButton } from '../compliance-drawer/compliance-drawer-button';
import { CONNECTION_HEALTH_SECTION, describeHealthLine, formatRunTime, healthDetailKey, healthInstructionsKey, senderWizardPath } from '../lib/connection-health-model';

/** The look of a state: an icon, a word and a colour together (the colour is never the only sign). The tones are the semantic tokens, with an AA fallback. */
const STATE_LOOK: Record<ConnectionHealthState, { Icon: LucideIcon; tone: string }> = {
  Active: {
    Icon: CheckCircle2,
    tone: 'bg-[color:var(--color-success-soft,#eaf7ee)] text-[color:var(--color-success-foreground,#166534)] ring-[color:var(--color-success-border,#b7e2c3)]',
  },
  Inactive: {
    Icon: XCircle,
    tone: 'bg-[color:var(--color-danger-soft,#fdedee)] text-[color:var(--color-danger-foreground,#b4232a)] ring-[color:var(--color-danger-border,#f4b8bb)]',
  },
  Unknown: {
    Icon: CircleHelp,
    tone: 'bg-[color:var(--color-warning-soft,#fef4e2)] text-[color:var(--color-warning-foreground,#8a4b05)] ring-[color:var(--color-warning-border,#f5d49a)]',
  },
  Manual: {
    Icon: Hand,
    tone: 'bg-muted text-foreground ring-border',
  },
};

interface HealthRowProps {
  topic: ComplianceHandoffTopic;
  line: ConnectionHealthLine;
  applies: boolean;
  propertyId: string;
  timeZone: string | undefined;
  wizardPath: string | null;
}

/** One communication: who sends it, whether it works, when it last ran and, when it does not, what to do. */
function HealthRow({ topic, line, applies, propertyId, timeZone, wizardPath }: HealthRowProps) {
  const { t, i18n } = useTranslation();
  const view = describeHealthLine(line, applies);
  const { Icon, tone } = STATE_LOOK[view.state];
  // The last run is told in the time zone of the property.
  const lastRun = view.lastRunAt ? formatRunTime(view.lastRunAt, i18n.language, timeZone) : '';
  const instructions = healthInstructionsKey(view);

  return (
    <li className="space-y-2 py-4 first:pt-0 last:pb-0" data-testid={`connection-health-${topic}`} data-state={view.state}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="break-words font-medium">{t(`connectionHealth.topic.${topic}`)}</h3>
          <p className="text-sm text-muted-foreground" data-testid={`connection-health-${topic}-sender`}>
            {view.sender ? t(`connectionHealth.sender.${view.sender}`) : t('connectionHealth.sender.unknown')}
          </p>
        </div>
        <span
          className={cn('inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset', tone)}
          data-testid={`connection-health-${topic}-state`}
        >
          <Icon className="size-4" aria-hidden="true" />
          {t(`connectionHealth.state.${view.state}`)}
        </span>
      </div>

      <p className="text-sm" data-testid={`connection-health-${topic}-detail`}>
        {applies ? t(healthDetailKey(view)) : t('connectionHealth.outsideItaly')}
      </p>
      {view.reasonCode ? <p className="text-sm text-muted-foreground">{t(`connectionHealth.reason.${view.reasonCode}`)}</p> : null}
      {lastRun ? (
        <p className="text-sm text-muted-foreground" data-testid={`connection-health-${topic}-last-run`}>
          {t('connectionHealth.lastRun', { when: lastRun })}
        </p>
      ) : null}

      {view.needsAction ? (
        <div className="flex flex-wrap items-start gap-2" data-testid={`connection-health-${topic}-actions`}>
          {wizardPath ? (
            <Button asChild size="sm" className="min-h-11">
              <Link to={wizardPath} data-testid={`connection-health-${topic}-activate`}>
                {t('connectionHealth.activate')}
              </Link>
            </Button>
          ) : instructions ? (
            <p className="text-sm" data-testid={`connection-health-${topic}-instructions`}>
              {t(instructions)}
            </p>
          ) : null}
          {view.checkInChannelManager ? (
            // The compliance drawer (E03/F05/US02): the outcome of this communication of this property is the channel manager's to tell; it is offered where the connector is on.
            <ComplianceDrawerButton target={{ topic, propertyId }} subject={t(`connectionHealth.topic.${topic}`)} className="min-h-11" testId={`connection-health-${topic}-verify`} />
          ) : null}
        </div>
      ) : null}

      {view.checkInChannelManager ? (
        <details className="text-sm text-muted-foreground">
          <summary className="min-h-11 cursor-pointer py-3">{t('connectionHealth.disclosureTitle')}</summary>
          <p className="pb-2">{t('connectionHealth.disclosureBody')}</p>
        </details>
      ) : null}
    </li>
  );
}

function CredentialsLine({ stored, usable, archivePath }: { stored: boolean; usable: boolean; archivePath: string }) {
  const { t } = useTranslation();
  // «Usable» is the API's word and it is never true in this release: nothing here says the receipts come by themselves unless it says so.
  const text = usable ? 'usable' : stored ? 'stored' : 'none';

  return (
    <p className="text-sm text-muted-foreground" data-testid="connection-health-credentials">
      {t(`connectionHealth.credentials.${text}`)}{' '}
      {!usable ? (
        <Link to={archivePath} className="font-medium text-primary underline-offset-4 hover:underline" data-testid="connection-health-archive-link">
          {t('connectionHealth.archiveLink')}
        </Link>
      ) : null}
    </p>
  );
}

interface ConnectionHealthPanelProps {
  propertyId: string;
  /** The time zone of the property (IANA name): the last automatic run is told in it. */
  timeZone?: string;
}

/**
 * «Invio a Polizia e ISTAT» on the page of the property (CHK-12 point 7, NF-52, E03/F03/US02/T01): for Alloggiati Web and for ISTAT who sends, whether
 * it works, when it last ran and whether CasaZen holds credentials for the receipts. The state is the API's word and only that: what the channel
 * manager does not let CasaZen read is «Non verificabile», with the way to check it by hand, and never a green state. The channel manager is «il
 * tuo channel manager» (the name only in the closed disclosure); where its outcome is the one to look at, the shared «Verifica nel tuo Cassetto
 * Compliance» is offered. «Attiva o ricollega» appears only when its wizard is in the ROUTE_MANIFEST and the person may open it: otherwise there are
 * the instructions. For who may not read the property nothing is asked and nothing is shown.
 */
export function ConnectionHealthPanel({ propertyId, timeZone }: ConnectionHealthPanelProps) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canRead = hasPermission('short-rent', 'property.read');
  const health = useConnectionHealth(propertyId, canRead);
  if (!canRead) return null;

  const archivePath = `/app/short-rent/alloggiati/reports?${new URLSearchParams({ property: propertyId, tab: 'proofs' }).toString()}`;
  const title = t('connectionHealth.title');
  let body: ReactNode;

  if (health.isError) {
    // A 404 is «not found» whatever the cache still holds of an older read (the query keeps the last data on an error).
    body =
      getHttpStatus(health.error) === 404 ? (
        <p className="text-sm text-muted-foreground" data-testid="connection-health-not-found">
          {t('connectionHealth.notFound')}
        </p>
      ) : (
        <ErrorState testId="connection-health-error" title={t('connectionHealth.loadError')} error={health.error} onRetry={() => void health.refetch()} />
      );
  } else if (health.isLoading || !health.data) {
    body = (
      <div role="status" aria-busy="true" data-testid="connection-health-loading" className="space-y-2">
        <span className="sr-only">{t('connectionHealth.loading')}</span>
        <Skeleton className="h-5 w-1/2 motion-reduce:animate-none" />
        <Skeleton className="h-5 w-2/3 motion-reduce:animate-none" />
      </div>
    );
  } else {
    const data = health.data;
    const wizardPath = senderWizardPath(propertyId, hasPermission);
    body = (
      <>
        <ul className="divide-y divide-border">
          <HealthRow topic="Alloggiati" line={data.alloggiati} applies={data.applies} propertyId={propertyId} timeZone={timeZone} wizardPath={wizardPath} />
          <HealthRow topic="Istat" line={data.istat} applies={data.applies} propertyId={propertyId} timeZone={timeZone} wizardPath={wizardPath} />
        </ul>
        {data.applies ? <CredentialsLine stored={data.credentialsInCasaZen} usable={data.credentialsUsable} archivePath={archivePath} /> : null}
        <div>
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void health.refetch()} disabled={health.isFetching} data-testid="connection-health-refresh">
            <RefreshCw className={cn('size-4', health.isFetching && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
            {t('connectionHealth.refresh')}
          </Button>
        </div>
      </>
    );
  }

  return (
    // `tabIndex={-1}`: the link of the cockpit (`?section=connection-health`) takes the focus here, so a screen reader says where it led.
    <PlainSection id={CONNECTION_HEALTH_SECTION} tabIndex={-1} className="scroll-mt-6 outline-none" title={title} data-testid="connection-health-panel">
      <p className="text-sm text-muted-foreground">{t('connectionHealth.description')}</p>
      {body}
    </PlainSection>
  );
}
