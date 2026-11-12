import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, ExternalLink, Hourglass } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useNow } from '@/hooks/use-now';
import { needKey } from '@/lib/onboarding-parts';
import { panelNeedOf, type HandoffPhase, type PanelTextKind } from '@/lib/onboarding-panel';
import type { PanelStepKind } from '@/types/onboarding.types';
import { PanelStepInstructions } from './panel-step-instructions';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

interface ExternalHandoffControllerProps {
  phase: HandoffPhase;
  /** The kind of step: its instructions and what to have at hand. */
  kind: PanelStepKind;
  textKind: PanelTextKind;
  /** Where the step is (the property, the channel): on screen for as long as the person is on the panel. */
  context?: ReactNode;
  /** When the step was started (UTC), for «in attesa da 3 minuti». */
  startedAt?: string | null;
  /** The step is being stored and the panel opened. */
  opening: boolean;
  /** A check is running. */
  checking: boolean;
  /** The confirmation is on its way. */
  confirming: boolean;
  /** Why the panel could not be opened, already translated. */
  error?: string | null;
  /** Why the confirmation was refused, already translated. */
  confirmError?: string | null;
  /** Opens the panel: the first time, again, or once more after the browser blocked it. */
  onOpen: () => void;
  /** «Sì, continua»: the person says the step is done (only offered after a check that could not tell). */
  onConfirm: () => void;
  /** Goes on to the next step of CasaZen. */
  onContinue: () => void;
  /** Leaves the step half way: its «Da fare» is already there. */
  onSaveAndExit: () => void;
  /** «Fallo per me»: on screen for as long as the step is. */
  assist: ReactNode;
  /** «Mi serve aiuto»: the way out of the question of a result CasaZen cannot read. */
  help?: ReactNode;
}

/** Whole minutes since an instant, never negative. */
function minutesSince(instant: string | null | undefined, now: number): number | null {
  const at = instant ? Date.parse(instant) : Number.NaN;
  return Number.isFinite(at) ? Math.max(0, Math.floor((now - at) / 60_000)) : null;
}

/**
 * A guided step of the panel of the channel manager on one screen, in the states that last (E10/F03/US02/T01, UX-02 point 3, AC-NF107-1 to 3):
 *
 * - `explain`: «Apriamo il pannello necessario e CasaZen resta qui a seguire il collegamento», what to have at hand and the instructions; the one
 *   action opens the panel;
 * - `started`: stored but not opened (the browser blocked the window): «Consenti l'apertura e riprova»;
 * - `waiting`: «Sto aspettando il collegamento»: the wizard stays visible with where it is, «Riapri il pannello», «Salva ed esci» and «Fallo per me»;
 * - `recovered`: CasaZen saw the connection: it goes on by itself, with no «Controlla ora» to press;
 * - `unverifiable`: only after a check that could not tell and with the person back from the panel: «Hai completato il collegamento e visto lo stato
 *   Attivata?», «Sì, continua» (never the default path), «No, riapri» and «Mi serve aiuto»;
 * - `notValid`: the check found it not valid: what to look at, and the panel again.
 *
 * Each state has one primary action. It shows what CasaZen tells the person, and decides nothing: the state comes from the server's step.
 */
export function ExternalHandoffController({
  phase,
  kind,
  textKind,
  context,
  startedAt,
  opening,
  checking,
  confirming,
  error,
  confirmError,
  onOpen,
  onConfirm,
  onContinue,
  onSaveAndExit,
  assist,
  help,
}: ExternalHandoffControllerProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const now = useNow(30_000);
  const minutes = minutesSince(startedAt, now);

  const title = t(`onboardingPlan.panel.state.${phase}.title`);
  const showInstructions = phase === 'explain' || phase === 'started' || phase === 'waiting' || phase === 'notValid';
  const openLabel = t(phase === 'explain' ? 'onboardingPlan.panel.actions.open' : phase === 'started' ? 'onboardingPlan.panel.actions.retryOpen' : 'onboardingPlan.panel.actions.reopen');

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={opening || checking || confirming ? true : undefined}
      className="min-w-0 space-y-5 rounded-lg border p-4 sm:p-6"
      data-testid="panel-step"
      data-phase={phase}
    >
      {context}

      <div className="min-w-0 space-y-1.5">
        <h2 id={headingId} className="flex items-center gap-2 break-words text-lg font-semibold leading-snug">
          {phase === 'recovered' ? <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-success-foreground" /> : null}
          {phase === 'waiting' ? <Hourglass aria-hidden="true" className="size-5 shrink-0 text-foreground/70 motion-safe:animate-pulse" /> : null}
          {title}
        </h2>
        <p className="break-words text-sm text-foreground/70">{t(`onboardingPlan.panel.state.${phase}.body`)}</p>
        {phase === 'waiting' ? (
          <p className="text-sm text-foreground/70" data-testid="panel-step-elapsed">
            {minutes === null || minutes < 1 ? t('onboardingPlan.panel.waiting.elapsedNow') : t('onboardingPlan.panel.waiting.elapsed', { count: minutes })}
            {checking ? ` · ${t('onboardingPlan.panel.waiting.checking')}` : ''}
          </p>
        ) : null}
      </div>

      {/* The change of state is read once by a screen reader, whatever the person was doing in the other window. */}
      <p role="status" aria-live="polite" className="sr-only" key={phase}>
        {title}
      </p>

      {phase === 'explain' ? (
        <div className="min-w-0 space-y-1 rounded-md bg-muted p-3 text-sm" data-testid="panel-step-need">
          <p className="font-medium">{t('onboardingPlan.panel.explain.needTitle')}</p>
          <p className="break-words text-foreground/80">{t(needKey(panelNeedOf(kind)))}</p>
        </div>
      ) : null}

      {phase === 'notValid' ? (
        <Alert variant="warning" data-testid="panel-step-not-valid">
          {t(`onboardingPlan.panel.${textKind}.notValid`)}
        </Alert>
      ) : null}

      {phase === 'started' ? (
        <Alert variant="warning" data-testid="panel-step-blocked">
          {t('onboardingPlan.panel.started.alert')}
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="danger" data-testid="panel-step-error">
          {error}
        </Alert>
      ) : null}
      {confirmError ? (
        <Alert variant="danger" data-testid="panel-step-confirm-error">
          {confirmError}
        </Alert>
      ) : null}

      {showInstructions ? (
        <div className="min-w-0 space-y-3">
          <h3 className="text-sm font-semibold">{t('onboardingPlan.panel.explain.instructionsTitle')}</h3>
          <PanelStepInstructions kind={textKind} />
          <p className="text-sm text-foreground/70" data-testid="panel-step-credentials-note">
            {t('onboardingPlan.panel.explain.credentialsNote')}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap" data-testid="panel-step-actions">
        {phase === 'recovered' ? (
          <Button type="button" className={TOUCH_TARGET} onClick={onContinue} iconRight={<ArrowRight />} data-testid="panel-step-continue">
            {t('onboardingPlan.panel.actions.continue')}
          </Button>
        ) : null}

        {phase === 'unverifiable' ? (
          <>
            <Button type="button" className={TOUCH_TARGET} onClick={onConfirm} loading={confirming} data-testid="panel-step-confirm">
              {t('onboardingPlan.panel.actions.confirmYes')}
            </Button>
            <Button type="button" variant="outline" className={TOUCH_TARGET} onClick={onOpen} loading={opening} iconRight={<ExternalLink />} data-testid="panel-step-no-reopen">
              {t('onboardingPlan.panel.actions.confirmNo')}
            </Button>
            {help}
          </>
        ) : null}

        {phase === 'explain' || phase === 'started' || phase === 'waiting' || phase === 'notValid' ? (
          <Button type="button" className={TOUCH_TARGET} onClick={onOpen} loading={opening} iconRight={<ExternalLink />} data-testid="panel-step-open">
            {openLabel}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-start">
        <Button type="button" variant="ghost" className={TOUCH_TARGET} onClick={onSaveAndExit} data-testid="panel-step-save-exit">
          {t('onboardingPlan.panel.actions.saveExit')}
        </Button>
        {assist}
      </div>
    </section>
  );
}
