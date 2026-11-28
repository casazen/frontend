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

export function normalizeSteps(value: unknown): ActivationStep[] {
  const steps = (value as { steps?: unknown } | null | undefined)?.steps;
  if (!Array.isArray(steps)) return [];
  return steps.filter((step): step is ActivationStep => !!step && KNOWN_STEP_KEYS.has((step as ActivationStep).key));
}

export function nextActionableStep(steps: ActivationStep[]): ActivationStep | null {
  const open = steps.filter((step) => step.state !== 'done');
  return open.find((step) => step.state !== 'blocked') ?? open[0] ?? null;
}
