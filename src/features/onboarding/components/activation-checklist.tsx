import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Circle, Clock, ListChecks, Loader2, Lock } from 'lucide-react';
import { NextStepCard } from '@/components/shared/calm';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/hooks/use-workspace';
import { activationStepDetail } from '@/lib/activation-labels';
import { nextActionableStep, normalizeSteps } from '@/lib/activation-steps';
import { activationStepCtaKey, activationStepLinkState, activationStepRoute } from '@/lib/activation-routes';
import { getProblemMessage } from '@/lib/api-errors';
import { useOnboardingStatus } from '@/queries/use-onboarding-status';
import type { ActivationStep, ActivationStepState } from '@/types/onboarding.types';

const STATE_BADGE: Record<ActivationStepState, BadgeProps['variant']> = {
  done: 'success',
  inProgress: 'warning',
  todo: 'outline',
  blocked: 'secondary',
};

function StateIcon({ state }: { state: ActivationStepState }) {
  switch (state) {
    case 'done':
      return <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" aria-hidden />;
    case 'inProgress':
      return <Clock className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />;
    case 'blocked':
      return <Lock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />;
    default:
      return <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />;
  }
}

function NextStep({ step, index, total }: { step: ActivationStep; index: number; total: number }) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const route = activationStepRoute(step, hasPermission);

  return (
    <NextStepCard
      kicker={t('activation.next.kicker')}
      title={t(`activation.steps.${step.key}.title`)}
      // The card sits inside the checklist, which has its own heading: the step is not a heading of the page.
      titleAs="p"
      detail={activationStepDetail(step, t, (key) => i18n.exists(key))}
      position={t('activation.next.position', { current: index, total })}
      cta={
        route
          ? { label: t(activationStepCtaKey(step)), href: route, state: activationStepLinkState(step), testId: 'activation-next-step-cta' }
          : undefined
      }
      data-testid="activation-next-step"
    />
  );
}

function StepRow({ step }: { step: ActivationStep }) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const route = activationStepRoute(step, hasPermission);
  const title = t(`activation.steps.${step.key}.title`);

  return (
    <li
      // Stacked on a phone (the text keeps the full width), side by side from `sm`.
      className="flex flex-col gap-3 rounded-md border px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
      data-testid={`activation-step-${step.key}`}
      data-state={step.state}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <StateIcon state={step.state} />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground" data-testid={`activation-step-${step.key}-detail`}>
            {activationStepDetail(step, t, (key) => i18n.exists(key))}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-8 sm:pl-0">
        <Badge variant={STATE_BADGE[step.state]} data-testid={`activation-step-${step.key}-state`}>
          {t(`activation.state.${step.state}`)}
        </Badge>
        {route && (
          <Button variant="outline" size="sm" asChild>
            <Link to={route} state={activationStepLinkState(step)} aria-label={`${t(activationStepCtaKey(step))}: ${title}`} data-testid={`activation-step-${step.key}-cta`}>
              {t(activationStepCtaKey(step))}
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Activation checklist of the host dashboard (PLG-AC10, PL-15): the steps to a site guests can really book, each
 * derived by the server from stored state (a CIN is valid, Stripe can charge, a property is published and not paused),
 * never from a start made by the host. Loading and error have their own states; the card hides once every step is done.
 */
export function ActivationChecklist() {
  const { t } = useTranslation();
  const status = useOnboardingStatus();

  if (status.isLoading) {
    return (
      <Card data-testid="activation-checklist-loading" aria-busy="true">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            {t('activation.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (status.isError && !status.data) {
    return (
      <Card role="alert" data-testid="activation-checklist-error">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <p className="text-sm text-destructive">{getProblemMessage(status.error, t) ?? t('activation.loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void status.refetch()}>
            {status.isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('activation.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const steps = normalizeSteps(status.data);
  // Nothing to say (a response without steps), or nothing left to do: no card, no empty shell.
  if (steps.length === 0 || steps.every((step) => step.state === 'done')) return null;

  const done = steps.filter((step) => step.state === 'done').length;
  const percent = Math.round((done / steps.length) * 100);
  const next = nextActionableStep(steps);
  const nextIndex = next ? steps.findIndex((step) => step.key === next.key) + 1 : 0;

  return (
    <Card data-testid="activation-checklist" aria-busy={status.isFetching || undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-5 w-5" />
          {t('activation.title')}
        </CardTitle>
        <CardDescription data-testid="activation-checklist-progress">
          {t('activation.next.intro')} {t('activation.progress', { count: done, total: steps.length })}
        </CardDescription>
        <div
          role="progressbar"
          aria-label={t('activation.progressLabel')}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={done}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {next ? <NextStep step={next} index={nextIndex} total={steps.length} /> : null}
        <ol className="space-y-2">
          {steps.map((step) => (
            <StepRow key={step.key} step={step} />
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
