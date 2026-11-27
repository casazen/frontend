import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Hand, LogOut, Mail, type LucideIcon } from 'lucide-react';
import type { AutopilotPlan } from '@/types/compliance-autopilot.types';
import { askChannels, namesOf, type PlanGroups } from './autopilot-model';

/** What the cockpit says only the host can do, besides the stays the assistant looked at: it has no item of the plan, only a number. */
export interface AutopilotHostOnly {
  /** Properties to activate (the CIN, the documents). */
  activation: number;
  /** Stays checked out whose property was not declared ready. */
  turnovers: number;
}

/** A line of the layer: what, whom, and how, with the icon of who does it. */
export function AutopilotLine({
  icon: Icon,
  title,
  sub,
  note,
  testId,
}: {
  icon: LucideIcon;
  title: string;
  sub?: string;
  note?: string;
  testId?: string;
}) {
  return (
    <li className="flex gap-3 py-2" data-testid={testId}>
      <span aria-hidden="true" className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-muted text-foreground/70">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="break-words font-medium">{title}</p>
        {sub ? <p className="break-words text-sm text-foreground/80">{sub}</p> : null}
        {note ? <p className="break-words text-sm text-foreground/70">{note}</p> : null}
      </div>
    </li>
  );
}

/** A part of the layer: its name and its lines. */
export function AutopilotSection({ title, testId, children }: { title: string; testId?: string; children: ReactNode }) {
  return (
    <section className="space-y-1" data-testid={testId} aria-label={title}>
      <h3 className="text-sm font-semibold text-foreground/70">{title}</h3>
      <ul role="list" className="divide-y divide-border">
        {children}
      </ul>
    </section>
  );
}

interface AutopilotPlanViewProps {
  plan: AutopilotPlan;
  groups: PlanGroups;
  hostOnly: AutopilotHostOnly;
}

/**
 * What the assistant would do, said in three parts: what it does now («Faccio io»), what it leaves for later («Aspetto») and what only
 * the host can do («Resta a te»), each with whom it is about and why. Nothing here is a button but the one that starts it, which the
 * layer holds: the host reads, then confirms.
 */
export function AutopilotPlanView({ plan, groups, hostOnly }: AutopilotPlanViewProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { ask, close, waiting, host } = groups;
  const reasonText = (reason: string, names: string) =>
    t(i18n.exists(`compliance.autopilot.plan.reason.${reason}`) ? `compliance.autopilot.plan.reason.${reason}` : 'compliance.autopilot.plan.reason.unknown', { names });
  const hostLines = host.length + (hostOnly.activation > 0 ? 1 : 0) + (hostOnly.turnovers > 0 ? 1 : 0);
  const doing = ask.length > 0 || close.length > 0;

  return (
    <div className="space-y-5" data-testid="autopilot-plan">
      {doing ? (
        <AutopilotSection title={t('compliance.autopilot.plan.do')} testId="autopilot-plan-do">
          {ask.length > 0 ? (
            <AutopilotLine
              icon={Mail}
              title={t('compliance.autopilot.plan.ask', { count: ask.length })}
              sub={namesOf(ask, t, locale)}
              note={`${t(`compliance.autopilot.plan.askHow.${askChannels(ask)}`)}${
                ask.some((item) => item.channels.includes('chat')) ? ` ${t(plan.aiAvailable ? 'compliance.autopilot.plan.ai' : 'compliance.autopilot.plan.noAi')}` : ''
              }`}
              testId="autopilot-plan-ask"
            />
          ) : null}
          {close.length > 0 ? (
            <AutopilotLine
              icon={LogOut}
              title={t('compliance.autopilot.plan.close', { count: close.length })}
              sub={namesOf(close, t, locale)}
              note={t('compliance.autopilot.plan.closeHow')}
              testId="autopilot-plan-close"
            />
          ) : null}
        </AutopilotSection>
      ) : (
        <p className="text-sm text-foreground/80" data-testid="autopilot-plan-nothing">
          {t('compliance.autopilot.plan.nothing')}
        </p>
      )}

      {plan.beyondLimit > 0 ? (
        <p className="text-sm text-foreground/70" data-testid="autopilot-plan-beyond">
          {t('compliance.autopilot.plan.beyond', { count: plan.beyondLimit })}
        </p>
      ) : null}

      {waiting.length > 0 ? (
        <AutopilotSection title={t('compliance.autopilot.plan.wait')} testId="autopilot-plan-wait">
          {waiting.map((line) => (
            <AutopilotLine key={line.reason} icon={Clock} title={reasonText(line.reason, namesOf(line.items, t, locale))} testId={`autopilot-plan-wait-${line.reason}`} />
          ))}
        </AutopilotSection>
      ) : null}

      {hostLines > 0 ? (
        <AutopilotSection title={t('compliance.autopilot.plan.host')} testId="autopilot-plan-host">
          {host.map((line) => (
            <AutopilotLine key={line.reason} icon={Hand} title={reasonText(line.reason, namesOf(line.items, t, locale))} testId={`autopilot-plan-host-${line.reason}`} />
          ))}
          {hostOnly.activation > 0 ? (
            <AutopilotLine icon={Hand} title={t('compliance.autopilot.plan.activation', { count: hostOnly.activation })} testId="autopilot-plan-host-activation" />
          ) : null}
          {hostOnly.turnovers > 0 ? (
            <AutopilotLine icon={Hand} title={t('compliance.autopilot.plan.turnovers', { count: hostOnly.turnovers })} testId="autopilot-plan-host-turnovers" />
          ) : null}
        </AutopilotSection>
      ) : null}

      <p className="text-xs text-foreground/70" data-testid="autopilot-plan-footnote">
        {t('compliance.autopilot.plan.footnote')}
      </p>
    </div>
  );
}
