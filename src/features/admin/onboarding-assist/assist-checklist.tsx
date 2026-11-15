import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, CircleAlert, CircleHelp, Hourglass, KeyRound, LifeBuoy, type LucideIcon } from 'lucide-react';
import { PanelStepInstructions } from '@/features/onboarding/components/panel-step-instructions';
import { StatePill } from '@/features/onboarding/components/state-pill';
import { Button } from '@/components/ui/button';
import { isPanelStepKind, panelTextKind } from '@/lib/onboarding-panel';
import type { StatusTone } from '@/lib/status-dictionary';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { credentialKindFits, isOpenAssist } from '@/lib/support-vault';
import type {
  AdminAssistRequest,
  AssistChecklistProperty,
  AssistChecklistStep,
  AssistChecklistStepState,
  AssistIstatPresence,
  AssistPresence,
  SupportVaultCredentialKind,
} from '@/types/onboarding.types';
import { RevealSecretDialog } from './reveal-secret-dialog';
import { VaultSecretForm } from './vault-secret-form';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

/** How each state of a panel step looks: a tone, an icon and (in the translations) its words, so that it is never told by color alone (UX-09). */
const STEP_STATE_VIEW: Record<AssistChecklistStepState, { tone: StatusTone; Icon: LucideIcon }> = {
  notStarted: { tone: 'neutral', Icon: Hourglass },
  started: { tone: 'info', Icon: Hourglass },
  verified: { tone: 'success', Icon: CheckCircle2 },
  confirmed: { tone: 'success', Icon: CheckCircle2 },
  notValid: { tone: 'warning', Icon: CircleAlert },
  assistRequested: { tone: 'info', Icon: LifeBuoy },
};

/** A state of a step this version does not know (the server is newer) is never read as done: it is shown as not understood. */
const UNKNOWN_STEP_VIEW: { tone: StatusTone; Icon: LucideIcon } = { tone: 'warning', Icon: CircleHelp };

const SENDERS: ReadonlySet<string> = new Set(['ChannelManager', 'CasaZen', 'Manual']);
const REQUIREMENTS: ReadonlySet<string> = new Set(['required', 'notRequired', 'toVerify']);
const LAST_CHECKS: ReadonlySet<string> = new Set(['verified', 'notValid', 'unverifiable']);

interface ItemProps {
  label: string;
  testId: string;
  children: ReactNode;
}

/** One line of the checklist: what it is, how it stands and what staff can do about it. */
function Item({ label, testId, children }: ItemProps) {
  return (
    <div className="min-w-0 space-y-1.5 rounded-md border bg-card p-3" data-testid={testId}>
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="min-w-0 space-y-2 text-sm">{children}</dd>
    </div>
  );
}

interface PresenceProps {
  presence: AssistPresence;
}

/** Whether a credential is there and since when: the date, never a value. A credential that is not there says so in words and in colour (UX-09). */
function Presence({ presence }: PresenceProps) {
  const { t, i18n } = useTranslation();
  const since = presence.updatedAt ? formatRomeDateTime(presence.updatedAt, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return presence.present ? (
    <StatePill
      tone="success"
      icon={CheckCircle2}
      label={since ? t('onboardingPlan.assist.checklist.presence.presentSince', { date: since }) : t('onboardingPlan.assist.checklist.presence.present')}
      data-testid="assist-checklist-present"
      data-state="present"
    />
  ) : (
    <StatePill tone="warning" icon={CircleAlert} label={t('onboardingPlan.assist.checklist.presence.missing')} data-testid="assist-checklist-missing" data-state="missing" />
  );
}

interface StepLineProps {
  step: AssistChecklistStep;
}

/** One panel step the request is about: what it is, where it stands, what its last check found, and the guide that says what to do on the panel. */
function StepLine({ step }: StepLineProps) {
  const { t, i18n } = useTranslation();
  const known = isPanelStepKind(step.kind);
  const stateKnown = Object.hasOwn(STEP_STATE_VIEW, step.state);
  const view = stateKnown ? STEP_STATE_VIEW[step.state] : UNKNOWN_STEP_VIEW;
  const completed = step.completedAt ? formatRomeDateTime(step.completedAt, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <li className="min-w-0 space-y-2" data-testid={`assist-checklist-step-${step.kind}`} data-state={step.state}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 break-words font-medium">
          {known ? t(`onboardingPlan.assist.checklist.steps.kind.${step.kind}`) : t('onboardingPlan.assist.checklist.steps.kindUnknown')}
          {step.channelCode ? ` · ${t('onboardingPlan.assist.checklist.steps.channel', { channel: step.channelCode })}` : ''}
        </p>
        <StatePill
          tone={view.tone}
          icon={view.Icon}
          label={stateKnown ? t(`onboardingPlan.assist.checklist.steps.state.${step.state}`) : t('onboardingPlan.assist.checklist.steps.state.unknown')}
          data-testid="assist-checklist-step-state"
          data-state={stateKnown ? step.state : 'unknown'}
        />
      </div>
      {step.lastVerificationOutcome && LAST_CHECKS.has(step.lastVerificationOutcome) ? (
        <p className="text-foreground/70" data-testid="assist-checklist-step-check">
          {t(`onboardingPlan.assist.checklist.steps.lastCheck.${step.lastVerificationOutcome}`)}
        </p>
      ) : null}
      {completed ? <p className="text-foreground/70">{t('onboardingPlan.assist.checklist.steps.completedAt', { date: completed })}</p> : null}
      {known ? (
        <details className="rounded-md bg-muted p-2" data-testid="assist-checklist-guide">
          <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-medium">{t('onboardingPlan.assist.checklist.steps.guide')}</summary>
          <div className="pt-2">
            <PanelStepInstructions kind={panelTextKind(step.kind)} />
          </div>
        </details>
      ) : null}
    </li>
  );
}

interface OpenButtonProps {
  kind: SupportVaultCredentialKind;
  onOpen: (kind: SupportVaultCredentialKind) => void;
}

/** «Apri credenziali»: asks for the reason and shows the values for a minute (the controlled opening). */
function OpenButton({ kind, onOpen }: OpenButtonProps) {
  const { t } = useTranslation();
  const what = t(`onboardingPlan.assist.reveal.kinds.${kind}`);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={TOUCH_TARGET}
      onClick={() => onOpen(kind)}
      aria-label={t('onboardingPlan.assist.reveal.openFor', { what })}
      iconRight={<KeyRound />}
      data-testid={`assist-reveal-open-${kind}`}
    >
      {t('onboardingPlan.assist.reveal.open')}
    </Button>
  );
}

interface BlockProps {
  request: AdminAssistRequest;
  block: AssistChecklistProperty;
  onOpen: (kind: SupportVaultCredentialKind, subject: string) => void;
}

/**
 * What support needs for one property of the request (or for the whole organization): the user of the panel, the police and ISTAT credentials (presence and date, and whether
 * the region needs the ISTAT ones), who sends, and the panel steps with their guide. Staff opens a credential, or stores the user of the panel, only for the block the request
 * is about and only while it is open: the server opens a credential for that request's org and property and for an open request, so anything else would only be refused.
 */
function Block({ request, block, onOpen }: BlockProps) {
  const { t, i18n } = useTranslation();
  const open = isOpenAssist(request);
  const mine = (block.propertyId ?? null) === (request.propertyId ?? null);
  const offered = (kind: SupportVaultCredentialKind) => open && mine && credentialKindFits(request, kind);
  const subject = block.propertyName ?? t('onboardingPlan.assist.checklist.org');
  const title = block.propertyName
    ? block.comune
      ? t('onboardingPlan.assist.checklist.propertyComune', { property: block.propertyName, comune: block.comune })
      : block.propertyName
    : subject;
  const istat: AssistIstatPresence | null = block.istatCredentials;
  const requirement = istat && REQUIREMENTS.has(istat.requirement) ? istat.requirement : null;
  const sender = block.sender;
  const senderKnown = sender !== null && SENDERS.has(sender.sender);
  // A credential is opened only when it is there (a missing one can only be refused) and when the request needs it.
  const canOpenPanel = offered('OctoratePanel') && block.panelUser.present;
  const canOpenPolice = offered('Police') && block.policeCredentials?.present === true;
  const canOpenIstat = offered('RegionalIstat') && istat?.present === true;

  return (
    <li className="min-w-0 space-y-3" data-testid={`assist-checklist-block-${block.propertyId ?? 'org'}`}>
      <h4 className="break-words text-base font-semibold" data-testid="assist-checklist-block-title">
        {title}
      </h4>
      <dl className="space-y-2">
        <Item label={t('onboardingPlan.assist.checklist.items.panelUser')} testId="assist-checklist-panel-user">
          <Presence presence={block.panelUser} />
          <div className="flex flex-wrap items-start gap-2">
            {canOpenPanel ? <OpenButton kind="OctoratePanel" onOpen={(kind) => onOpen(kind, subject)} /> : null}
            {open && mine ? <VaultSecretForm orgId={request.orgId} propertyId={block.propertyId} present={block.panelUser.present} /> : null}
          </div>
        </Item>

        {block.policeCredentials ? (
          <Item label={t('onboardingPlan.assist.checklist.items.police')} testId="assist-checklist-police">
            <Presence presence={block.policeCredentials} />
            {canOpenPolice ? <OpenButton kind="Police" onOpen={(kind) => onOpen(kind, subject)} /> : null}
          </Item>
        ) : null}

        {istat ? (
          <Item label={t('onboardingPlan.assist.checklist.items.istat')} testId="assist-checklist-istat">
            <Presence presence={istat} />
            {requirement ? (
              <p className="text-foreground/70" data-testid="assist-checklist-istat-requirement" data-requirement={requirement}>
                {t(`onboardingPlan.assist.checklist.requirement.${requirement}`)}
              </p>
            ) : null}
            {canOpenIstat ? <OpenButton kind="RegionalIstat" onOpen={(kind) => onOpen(kind, subject)} /> : null}
          </Item>
        ) : null}

        {block.propertyId ? (
          <Item label={t('onboardingPlan.assist.checklist.items.sender')} testId="assist-checklist-sender">
            {sender ? (
              <>
                <p data-testid="assist-checklist-sender-value">
                  {senderKnown
                    ? t('onboardingPlan.assist.checklist.sender.since', {
                        sender: t(`onboardingPlan.assist.checklist.sender.${sender.sender}`),
                        date: formatRomeDateTime(sender.changedAt, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }),
                      })
                    : t('onboardingPlan.assist.checklist.sender.unknown')}
                </p>
                <p className="text-foreground/70">
                  {t(sender.activationDeclared ? 'onboardingPlan.assist.checklist.sender.activationDeclared' : 'onboardingPlan.assist.checklist.sender.activationNotDeclared')}
                </p>
              </>
            ) : (
              <p className="text-foreground/70" data-testid="assist-checklist-sender-default">
                {t('onboardingPlan.assist.checklist.sender.default')}
              </p>
            )}
          </Item>
        ) : null}

        <Item label={t('onboardingPlan.assist.checklist.items.steps')} testId="assist-checklist-steps">
          {block.steps.length === 0 ? (
            <p className="text-foreground/70" data-testid="assist-checklist-steps-empty">
              {t('onboardingPlan.assist.checklist.steps.empty')}
            </p>
          ) : (
            <ul role="list" className="space-y-3">
              {block.steps.map((step) => (
                <StepLine key={`${step.kind}:${step.channelCode ?? ''}`} step={step} />
              ))}
            </ul>
          )}
        </Item>
      </dl>
    </li>
  );
}

interface AssistChecklistProps {
  /** The request as the server answered it with the checklist (its status is what decides whether a credential can be opened). */
  request: AdminAssistRequest;
  checklist: AssistChecklistProperty[];
}

/**
 * The checklist of a «Do it for me» request (E20/F03/US02/T01): what support needs for each property of it, before it works (E20/F03/US01/T02) and what staff can do about it
 * from here: open a credential of the support vault (a reason, a minute, an audit line the host reads) and store the user of the panel. Presence and dates only: nothing of
 * a value is on this page until a credential is opened, and what is opened is in its own dialog.
 */
export function AssistChecklist({ request, checklist }: AssistChecklistProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const [revealing, setRevealing] = useState<{ kind: SupportVaultCredentialKind; subject: string } | null>(null);
  const open = isOpenAssist(request);

  return (
    <section className="min-w-0 space-y-4" aria-labelledby={headingId} data-testid="assist-checklist">
      <div className="space-y-1">
        <h3 id={headingId} className="text-lg font-semibold">
          {t('onboardingPlan.assist.checklist.title')}
        </h3>
        <p className="text-sm text-foreground/70">{t('onboardingPlan.assist.checklist.description')}</p>
        {!open ? (
          <p className="text-sm text-foreground/70" data-testid="assist-checklist-closed">
            {t('onboardingPlan.assist.checklist.closed')}
          </p>
        ) : null}
      </div>
      {checklist.length === 0 ? (
        <p className="text-sm text-foreground/70" data-testid="assist-checklist-empty">
          {t('onboardingPlan.assist.checklist.empty')}
        </p>
      ) : (
        <ul role="list" className="space-y-6">
          {checklist.map((block) => (
            <Block key={block.propertyId ?? 'org'} request={request} block={block} onOpen={(kind, subject) => setRevealing({ kind, subject })} />
          ))}
        </ul>
      )}
      {revealing ? <RevealSecretDialog requestId={request.id} kind={revealing.kind} subject={revealing.subject} onClose={() => setRevealing(null)} /> : null}
    </section>
  );
}
