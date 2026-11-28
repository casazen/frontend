import type { ReactNode } from 'react';
import { Archive, ArrowDown, ChartColumn, CheckCircle2, CircleHelp, Globe, Hand, History, RefreshCw, ShieldCheck, XCircle, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { IconFact, IconFacts, InfoCard } from '@/components/shared/calm';
import { ManualHint } from '@/components/shared/manual-hint';
import { StatusPill } from '@/components/shared/status/status-pill';
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
import { CONNECTION_HEALTH_SECTION, describeHealthLine, formatRunTime, healthInstructionsKey, senderWizardPath } from '../lib/connection-health-model';
import { useIstatClaim } from '../lib/use-istat-claim';
import { IstatCoverageNotice } from './istat-coverage-notice';

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

const TOPIC_ICONS: Record<ComplianceHandoffTopic, LucideIcon> = { Alloggiati: ShieldCheck, Istat: ChartColumn };

function StatePill({ topic, state }: { topic: ComplianceHandoffTopic; state: ConnectionHealthState }) {
  const { t } = useTranslation();
  const { Icon, tone } = STATE_LOOK[state];

  return (
    <span
      className={cn('inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset', tone)}
      data-testid={`connection-health-${topic}-state`}
    >
      <Icon className="size-4" aria-hidden="true" />
      {t(`connectionHealth.state.${state}`)}
    </span>
  );
}

interface HealthRowProps {
  topic: ComplianceHandoffTopic;
  line: ConnectionHealthLine;
  applies: boolean;
  propertyId: string;
  timeZone: string | undefined;
  wizardPath: string | null;
}

function HealthRow({ topic, line, applies, propertyId, timeZone, wizardPath }: HealthRowProps) {
  const { t, i18n } = useTranslation();
  const view = describeHealthLine(line, applies);
  const TopicIcon = TOPIC_ICONS[topic];
  const lastRun = view.lastRunAt ? formatRunTime(view.lastRunAt, i18n.language, timeZone) : '';
  const instructions = healthInstructionsKey(view);

  return (
    <li className="space-y-2 py-3 first:pt-0 last:pb-0" data-testid={`connection-health-${topic}`} data-state={view.state}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <TopicIcon aria-hidden="true" className="size-4 shrink-0 text-foreground/70" />
          <h3 className="min-w-0 break-words text-sm font-medium">{t(`connectionHealth.topic.${topic}`)}</h3>
        </div>
        <StatePill topic={topic} state={view.state} />
      </div>

      {view.state !== 'Manual' ? (
        <p className="text-sm text-foreground/70" data-testid={`connection-health-${topic}-sender`}>
          {view.sender ? t(`connectionHealth.sender.${view.sender}`) : t('connectionHealth.sender.unknown')}
        </p>
      ) : null}
      {view.reasonCode ? <p className="text-sm text-foreground/70">{t(`connectionHealth.reason.${view.reasonCode}`)}</p> : null}
      {lastRun ? (
        <IconFacts>
          <IconFact icon={History} data-testid={`connection-health-${topic}-last-run`}>
            {t('connectionHealth.lastRun', { when: lastRun })}
          </IconFact>
        </IconFacts>
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
            <ComplianceDrawerButton target={{ topic, propertyId }} subject={t(`connectionHealth.topic.${topic}`)} className="min-h-11" testId={`connection-health-${topic}-verify`} />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function IstatSeeNoticeRow() {
  const { t } = useTranslation();

  return (
    <li className="space-y-1 py-3 first:pt-0 last:pb-0" data-testid="connection-health-Istat" data-state="Unknown">
      <div className="flex min-w-0 items-center gap-2">
        <ChartColumn aria-hidden="true" className="size-4 shrink-0 text-foreground/70" />
        <h3 className="min-w-0 break-words text-sm font-medium">{t('connectionHealth.topic.Istat')}</h3>
      </div>
      <p className="flex items-center gap-1.5 text-sm text-foreground/70" data-testid="connection-health-Istat-detail">
        <ArrowDown aria-hidden="true" className="size-4 shrink-0" />
        {t('connectionHealth.istatSeeNotice')}
      </p>
    </li>
  );
}

function CredentialsLine({ usable, archivePath }: { usable: boolean; archivePath: string }) {
  const { t } = useTranslation();

  if (usable) return null;

  return (
    <IconFacts>
      <IconFact icon={Archive} data-testid="connection-health-credentials">
        <Link to={archivePath} className="font-medium text-primary-text underline underline-offset-4" data-testid="connection-health-archive-link">
          {t('connectionHealth.archiveLink')}
        </Link>
      </IconFact>
    </IconFacts>
  );
}

interface ConnectionHealthPanelProps {
  propertyId: string;
  timeZone?: string;
}

export function ConnectionHealthPanel({ propertyId, timeZone }: ConnectionHealthPanelProps) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canRead = hasPermission('short-rent', 'property.read');
  const health = useConnectionHealth(propertyId, canRead);
  // The row of the ISTAT is computed from the state of the police connection alone (it says «Attivo» whatever the region): it may only say that the channel manager sends the ISTAT where the table does.
  const istatClaim = useIstatClaim(propertyId, { channelManagerSends: true, enabled: canRead });
  if (!canRead) return null;

  const archivePath = `/app/short-rent/alloggiati/reports?${new URLSearchParams({ property: propertyId, tab: 'proofs' }).toString()}`;
  const outside = health.data?.applies === false && !health.isError;
  let body: ReactNode;

  if (health.isError) {
    body =
      getHttpStatus(health.error) === 404 ? (
        <p className="text-sm text-foreground/70" data-testid="connection-health-not-found">
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
  } else if (!health.data.applies) {
    body = (
      <StatusPill icon={Globe} className="self-start py-1 text-sm" data-testid="connection-health-outside">
        {t('connectionHealth.outsideItalyShort')}
      </StatusPill>
    );
  } else {
    const data = health.data;
    const wizardPath = senderWizardPath(propertyId, hasPermission);
    const istatRow = istatClaim !== 'seeNotice';
    body = (
      <>
        <ul className="divide-y divide-border">
          <HealthRow topic="Alloggiati" line={data.alloggiati} applies={data.applies} propertyId={propertyId} timeZone={timeZone} wizardPath={wizardPath} />
          {istatRow ? (
            <HealthRow topic="Istat" line={data.istat} applies={data.applies} propertyId={propertyId} timeZone={timeZone} wizardPath={wizardPath} />
          ) : (
            <IstatSeeNoticeRow />
          )}
        </ul>
        {/* What the region table says of the ISTAT of this property (E21/F01/US02/T01): whether the channel manager sends it, the deadline, the one thing to do next and the upload of the proof of the month. Behind the flag of the activation. */}
        <IstatCoverageNotice propertyId={propertyId} showProof compact />
        <CredentialsLine usable={data.credentialsUsable} archivePath={archivePath} />
      </>
    );
  }

  return (
    <InfoCard
      id={CONNECTION_HEALTH_SECTION}
      tabIndex={-1}
      className="scroll-mt-6 outline-none"
      icon={ShieldCheck}
      title={t('connectionHealth.title')}
      hint={
        <ManualHint page="alloggiati-istat" anchor="chi-invia-i-dati-degli-ospiti" title={t('connectionHealth.title')}>
          {t(outside ? 'connectionHealth.outsideItaly' : 'connectionHealth.description')}
        </ManualHint>
      }
      aside={
        health.data && !health.isError && health.data.applies ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            onClick={() => void health.refetch()}
            disabled={health.isFetching}
            title={t('connectionHealth.refresh')}
            aria-label={t('connectionHealth.refresh')}
            data-testid="connection-health-refresh"
          >
            <RefreshCw className={cn('size-4', health.isFetching && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
          </Button>
        ) : undefined
      }
      data-testid="connection-health-panel"
    >
      {body}
    </InfoCard>
  );
}
