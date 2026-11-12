import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getProblemMessage } from '@/lib/api-errors';
import {
  handoffPhase,
  isPanelStepOpen,
  panelAssistContext,
  panelPartOf,
  panelTextKind,
  findPanelStep,
} from '@/lib/onboarding-panel';
import { useProperty } from '@/queries/use-properties';
import {
  useConfirmPanelStep,
  usePanelStepStatus,
  usePanelSteps,
  useStartPanelStep,
  useVerifyPanelStep,
} from '@/queries/use-onboarding-panel-step';
import type { PanelStep, PanelStepKind, StartPanelStepRequest } from '@/types/onboarding.types';
import { useExternalHandoff } from '../use-external-handoff';
import { AssistRequestButton } from './assist-request-button';
import { ExternalHandoffController } from './external-handoff-controller';

interface PanelStepContextProps {
  propertyId?: string | null;
  channelName?: string | null;
}

/** Where the step is: the property and the channel, on screen for as long as the person is on the panel (they come back to the same wizard step). */
function PanelStepContext({ propertyId, channelName }: PanelStepContextProps) {
  const { t } = useTranslation();
  const property = useProperty(propertyId ?? '');
  const propertyName = propertyId ? property.data?.name : undefined;
  if (!propertyName && !channelName) return null;

  return (
    <dl className="flex min-w-0 flex-wrap gap-x-6 gap-y-1 text-sm" data-testid="panel-step-context">
      {propertyName ? (
        <div className="min-w-0">
          <dt className="inline text-foreground/70">{t('onboardingPlan.panel.context.property')} </dt>
          <dd className="inline break-words font-medium">{propertyName}</dd>
        </div>
      ) : null}
      {channelName ? (
        <div className="min-w-0">
          <dt className="inline text-foreground/70">{t('onboardingPlan.panel.context.channel')} </dt>
          <dd className="inline break-words font-medium">{channelName}</dd>
        </div>
      ) : null}
    </dl>
  );
}

interface OctoratePanelStepProps {
  kind: PanelStepKind;
  /** The property the step is about; none for the whole org. */
  propertyId?: string | null;
  /** The channel of a channel access (required for that kind). */
  channelCode?: string | null;
  /** The channel as the person knows it, when the caller has the name (the code is shown otherwise). */
  channelName?: string | null;
  /** The point of a wizard the step comes back to: named, never carried (the server stores a reference, not the draft). */
  resume?: Pick<StartPanelStepRequest, 'resumeWizardType' | 'resumeDraftEntityId' | 'resumeStepCode'>;
  /** The person is back from a panel that sent them to CasaZen (`redirectCallback`): the step they were on is followed to its end by itself. */
  cameFromPanel?: boolean;
  /** The step is done (seen by CasaZen, or confirmed): the next step of CasaZen. It runs once, by itself, for a step that was open in this visit. */
  onRecovered?: () => void;
  /** «Salva ed esci»: the step stays as it is (its «Da fare» is already there). */
  onSaveAndExit: () => void;
}

/**
 * A step that Octorate allows only from its panel (the police and ISTAT connections, the access to a channel), guided from CasaZen (E10/F03/US02/T01,
 * NF-107, ONB-04): the step is stored on the server BEFORE anything external opens, the panel opens in a secondary window while CasaZen stays on
 * the waiting step (or, for a panel that sends the person back, in the same tab), CasaZen reads the result at the pace the server asks for and goes
 * on by itself when it sees the connection; the person confirms only after a check that could not tell and when they are back from the panel.
 * «Fallo per me» is always there. It is generic: the sender wizard and the connect wizard use it for their own steps.
 *
 * The page of CasaZen the person comes back to is the same step: the state is the server's, so a reload, «Salva ed esci», a closed window or the
 * «Da fare» of the step lead to the same screen. The channel manager is «il tuo channel manager» (UX-12): its name is not on this screen.
 */
export function OctoratePanelStep({ kind, propertyId, channelCode, channelName, resume, cameFromPanel = false, onRecovered, onSaveAndExit }: OctoratePanelStepProps) {
  const { t } = useTranslation();
  const textKind = panelTextKind(kind);
  const target = { kind, propertyId, channelCode };

  const steps = usePanelSteps();
  const existing = findPanelStep(steps.data, target);
  const startStep = useStartPanelStep();
  const verifyStep = useVerifyPanelStep();
  const confirmStep = useConfirmPanelStep();

  const stepId = startStep.data?.id ?? existing?.id;
  const followed = usePanelStepStatus(stepId);
  const step: PanelStep | undefined = followed.data ?? existing;
  const open = isPanelStepOpen(step);

  const handoff = useExternalHandoff({
    start: async () => {
      const started = await startStep.mutateAsync({
        kind,
        propertyId: propertyId ?? undefined,
        channelCode: channelCode ?? undefined,
        ...resume,
      });
      // A step that is done, or that support is handling, is answered as it is: there is nothing to open.
      return { handoffMode: started.handoffMode, panelUrl: started.panelUrl, alreadyComplete: !isPanelStepOpen(started) };
    },
    onTrigger: () => {
      if (stepId) verifyStep.mutate(stepId);
    },
    watching: open,
  });
  const { closeWindow, ended, launched, blocked } = handoff;

  const phase = handoffPhase(step, { launched, blocked, ended });

  // The step ends on its own only if this visit saw it open: a person who opens the page of a step already done reads it and decides.
  const sawOpen = useRef(cameFromPanel);
  useEffect(() => {
    if (open || handoff.starting) sawOpen.current = true;
  }, [open, handoff.starting]);

  const advanced = useRef(false);
  useEffect(() => {
    if (phase !== 'recovered' || advanced.current || !sawOpen.current) return;
    advanced.current = true;
    // CasaZen saw the connection: the window it opened has done its job, and the person is taken on, with nothing to press.
    closeWindow();
    toast.success(t('onboardingPlan.panel.state.recovered.toast'));
    onRecovered?.();
  }, [phase, closeWindow, onRecovered, t]);

  const openError = handoff.error ? (getProblemMessage(handoff.error, t) ?? t('onboardingPlan.panel.errors.open')) : null;
  const confirmError = confirmStep.isError ? (getProblemMessage(confirmStep.error, t) ?? t('onboardingPlan.panel.errors.confirm')) : null;

  return (
    <ExternalHandoffController
      phase={phase}
      kind={kind}
      textKind={textKind}
      context={<PanelStepContext propertyId={propertyId} channelName={channelName ?? channelCode} />}
      startedAt={step?.startedAt}
      opening={handoff.starting}
      checking={verifyStep.isPending}
      confirming={confirmStep.isPending}
      error={openError}
      confirmError={confirmError}
      onOpen={() => void handoff.open()}
      onConfirm={() => {
        if (stepId) confirmStep.mutate(stepId);
      }}
      onContinue={() => onRecovered?.()}
      onSaveAndExit={onSaveAndExit}
      assist={<AssistRequestButton part={panelPartOf(kind)} context={panelAssistContext(kind)} propertyId={propertyId} channelCode={channelCode} />}
      help={
        <AssistRequestButton
          part={panelPartOf(kind)}
          context={panelAssistContext(kind)}
          propertyId={propertyId}
          channelCode={channelCode}
          label="needHelp"
          showStatus={false}
        />
      }
    />
  );
}
