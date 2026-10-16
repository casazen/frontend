import type { ActivationStep, ActivationStepKey } from '@/types/onboarding.types';

const KNOWN_STEP_KEYS: ReadonlySet<ActivationStepKey> = new Set([
  'account',
  'organization',
  'property',
  'cin',
  'payments',
  'sitePublished',
  'firstBooking',
]);

/** The steps of `GET /api/onboarding/status` this version of the app knows. */
export function normalizeSteps(value: unknown): ActivationStep[] {
  const steps = (value as { steps?: unknown } | null | undefined)?.steps;
  if (!Array.isArray(steps)) return [];
  // A step this version of the app does not know has no text to show: it is left out, never shown as a bare key.
  return steps.filter((step): step is ActivationStep => !!step && KNOWN_STEP_KEYS.has((step as ActivationStep).key));
}

/** The step the host should do now: the first one that is open and not waiting on another step. */
export function nextActionableStep(steps: ActivationStep[]): ActivationStep | null {
  const open = steps.filter((step) => step.state !== 'done');
  return open.find((step) => step.state !== 'blocked') ?? open[0] ?? null;
}
