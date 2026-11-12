import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getProblemMessage } from '@/lib/api-errors';
import { flowNameKey } from '@/lib/onboarding-flows';
import { ONBOARDING_PLAN_PATH } from '@/lib/onboarding-parts';
import { TODO_LIST_PATH } from '@/features/todo/lib/todo-model';
import { useActivateReady, useActivationReadiness, type FlowActivationSummary } from '@/queries/use-flow-activation';
import { ONBOARDING_FLOW_KEYS, type BulkFlowProgress, type OnboardingFlowKey } from '@/types/onboarding.types';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

interface ActivationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The flows the host can switch on now by default: the ones with at least one property that is ready. */
function defaultFlows(progress: readonly BulkFlowProgress[] | undefined): OnboardingFlowKey[] {
  return (progress ?? []).filter((flow) => flow.ready > 0).map((flow) => flow.flow);
}

/**
 * The activation (E10/F03/US02/T03, NF-104 part 11, UX-05): the summary BEFORE the action, then the result. The host ticks the flows (by default the ones
 * with properties that can be switched on) and the dialog says, for each, for how many properties it will be switched on and how many are not ready and stay
 * in «Da fare»; «Conferma» does it, «Modifica» closes the dialog and goes back to the table. The result lists, for each flow, how many were switched on and
 * which properties were not and what they lack, and ends with one suggested next step. The server checks the prerequisites of each property again at the moment.
 */
export function ActivationDialog({ open, onOpenChange }: ActivationDialogProps) {
  const { t } = useTranslation();
  const readiness = useActivationReadiness({ enabled: open });
  const activate = useActivateReady();
  const [ticked, setTicked] = useState<OnboardingFlowKey[] | null>(null);

  const progress = readiness.data;
  const chosen = ticked ?? defaultFlows(progress);
  const countsOf = (flow: OnboardingFlowKey) => progress?.find((candidate) => candidate.flow === flow);
  const result = activate.data;

  const toggle = (flow: OnboardingFlowKey) => setTicked(chosen.includes(flow) ? chosen.filter((candidate) => candidate !== flow) : [...chosen, flow]);
  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setTicked(null);
      activate.reset();
    }
  };

  const willActivate = chosen.reduce((sum, flow) => sum + (countsOf(flow)?.ready ?? 0), 0);
  const notReady = chosen.reduce((sum, flow) => sum + (countsOf(flow)?.toComplete ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="activation-dialog">
        <DialogHeader>
          <DialogTitle>{t(result ? 'onboardingPlan.summary.activation.resultTitle' : 'onboardingPlan.summary.activation.title')}</DialogTitle>
          <DialogDescription>{t(result ? 'onboardingPlan.summary.activation.resultDescription' : 'onboardingPlan.summary.activation.description')}</DialogDescription>
        </DialogHeader>

        {result ? (
          <ActivationResult result={result} />
        ) : readiness.isPending ? (
          <div role="status" aria-busy="true" className="space-y-2" data-testid="activation-loading">
            <span className="sr-only">{t('onboardingPlan.summary.activation.loading')}</span>
            <Skeleton className="h-12 w-full rounded-md motion-reduce:animate-none" aria-hidden="true" />
          </div>
        ) : readiness.isError ? (
          <p role="alert" className="text-sm text-danger-foreground" data-testid="activation-load-error">
            {getProblemMessage(readiness.error, t) ?? t('onboardingPlan.summary.activation.loadError')}
          </p>
        ) : (
          <div className="space-y-4">
            <fieldset className="min-w-0 space-y-2" data-testid="activation-flows">
              <legend className="text-sm font-semibold">{t('onboardingPlan.summary.activation.flows')}</legend>
              {ONBOARDING_FLOW_KEYS.map((flow) => {
                const counts = countsOf(flow);
                return (
                  <label key={flow} className="flex min-h-11 cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-5 shrink-0"
                      checked={chosen.includes(flow)}
                      onChange={() => toggle(flow)}
                      data-testid={`activation-flow-${flow}`}
                    />
                    <span className="min-w-0 break-words">
                      <span className="font-medium">{t(flowNameKey(flow))}</span>
                      {' · '}
                      {t('onboardingPlan.summary.activation.flowCounts', { ready: counts?.ready ?? 0, notReady: counts?.toComplete ?? 0 })}
                    </span>
                  </label>
                );
              })}
            </fieldset>

            {/* The summary before the action (UX-05): what will happen, and what stays for later. */}
            <div className="space-y-1 rounded-md bg-muted p-3 text-sm" aria-live="polite" data-testid="activation-summary">
              <p className="font-medium">{t('onboardingPlan.summary.activation.willActivate', { count: willActivate })}</p>
              <p>{t('onboardingPlan.summary.activation.stayInTodo', { count: notReady })}</p>
            </div>

            {activate.isError ? (
              <p role="alert" className="text-sm text-danger-foreground" data-testid="activation-error">
                {getProblemMessage(activate.error, t) ?? t('onboardingPlan.summary.activation.error')}
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {result ? (
            <Button type="button" className={TOUCH_TARGET} onClick={() => close(false)} data-testid="activation-close">
              {t('onboardingPlan.summary.activation.close')}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" className={TOUCH_TARGET} onClick={() => close(false)} data-testid="activation-edit">
                {t('onboardingPlan.summary.activation.edit')}
              </Button>
              <Button
                type="button"
                className={TOUCH_TARGET}
                loading={activate.isPending}
                disabled={readiness.isPending || readiness.isError || chosen.length === 0 || willActivate === 0}
                onClick={() => activate.mutate(chosen)}
                data-testid="activation-confirm"
              >
                {t('onboardingPlan.summary.activation.confirm')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The result, flow by flow: how many were switched on, the properties that were not with what they lack, and the one next step. */
function ActivationResult({ result }: { result: readonly FlowActivationSummary[] }) {
  const { t } = useTranslation();
  const left = result.reduce((sum, flow) => sum + flow.notActivated.length, 0);

  return (
    <div className="space-y-4" data-testid="activation-result">
      <ul className="space-y-3" role="list">
        {result.map((flow) => (
          <li key={flow.flow} className="min-w-0 space-y-1 text-sm" data-testid={`activation-result-${flow.flow}`}>
            <p className="break-words font-medium">
              {t(flowNameKey(flow.flow))}
              {': '}
              {t('onboardingPlan.summary.activation.activated', { count: flow.activated })}
            </p>
            {flow.notActivated.length > 0 ? (
              <ul className="list-disc space-y-0.5 pl-5 text-foreground/70" role="list">
                {flow.notActivated.map((property) => (
                  <li key={property.propertyId} className="break-words" data-testid={`activation-not-${flow.flow}-${property.propertyId}`}>
                    {property.name}
                    {property.unmet.length > 0
                      ? ` · ${t('onboardingPlan.summary.activation.lacks', { what: property.unmet.map((key) => t(`onboardingPlan.summary.prerequisites.${key}`)).join(', ') })}`
                      : ''}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="rounded-md bg-muted p-3 text-sm" data-testid="activation-next-step">
        {left > 0 ? t('onboardingPlan.summary.activation.nextTodo') : t('onboardingPlan.summary.activation.nextDone')}{' '}
        <Link
          to={left > 0 ? TODO_LIST_PATH : ONBOARDING_PLAN_PATH}
          className="inline-flex min-h-11 items-center font-medium text-primary-text underline underline-offset-4"
          data-testid="activation-next-link"
        >
          {t(left > 0 ? 'onboardingPlan.summary.activation.toTodo' : 'onboardingPlan.summary.activation.toPlan')}
        </Link>
      </p>
    </div>
  );
}
