import type { TFunction } from 'i18next';
import { normalizeCin } from '@/lib/cin-format';
import {
  propertyFormDefaults,
  toPropertyPayload,
  type PropertyFormValues,
} from '@/features/properties/schemas/property.schema';
import type { CreatePropertyDto, Property, UpdatePropertyDto } from '@/types';
import type { ActivationBlocker, ComplianceWizardStep } from '@/types/compliance.types';

/** Steps of the activation wizard in display order (ids of `GET /properties/:id/compliance/activation`). */
export const ACTIVATION_STEP_ORDER = ['base-data', 'cin', 'documents', 'safety', 'tourist-tax', 'ical'] as const;

/**
 * Last step, only in the frontend: summary of every step, blockers, terms acceptance and "Completa". The terms are
 * accepted here, right before completing (A5-18 c), never in a step the host may not reach.
 */
export const REVIEW_STEP_ID = 'review';

/** Steps of the wizard: the known ones in order, the ones this frontend does not know yet, then the review. */
export function wizardStepIds(steps: ComplianceWizardStep[]): string[] {
  const apiIds = steps.map((s) => s.id);
  const known = ACTIVATION_STEP_ORDER.filter((id) => apiIds.includes(id));
  const unknown = apiIds.filter((id) => !(ACTIVATION_STEP_ORDER as readonly string[]).includes(id));
  return [...known, ...unknown, REVIEW_STEP_ID];
}

/** A blocking step not complete yet: it keeps the property from being activated. */
export function isOpenBlocker(step: ComplianceWizardStep): boolean {
  return step.blocker && step.status !== 'complete';
}

/**
 * What still blocks the activation according to the server: the blockers of every open blocking step, or one
 * generic entry (empty code) for a blocking step that does not list them.
 */
export function knownBlockers(steps: ComplianceWizardStep[]): ActivationBlocker[] {
  return wizardStepIds(steps)
    .map((id) => steps.find((s) => s.id === id))
    .filter((s): s is ComplianceWizardStep => !!s && isOpenBlocker(s))
    .flatMap((s) =>
      s.blockers && s.blockers.length > 0
        ? s.blockers.map((b) => ({ ...b, step: b.step || s.id }))
        : [{ step: s.id, code: '', message: s.message ?? '' }],
    );
}

/** Step the wizard opens on: the first blocking step still open, otherwise the review (e.g. a property already active). */
export function initialStepId(steps: ComplianceWizardStep[]): string {
  const ids = wizardStepIds(steps);
  return ids.find((id) => steps.some((s) => s.id === id && isOpenBlocker(s))) ?? REVIEW_STEP_ID;
}

type Exists = (key: string) => boolean;

/** Title of a step translated by id, or the label sent by the API for a step this frontend does not know. */
export function stepTitle(stepId: string, steps: ComplianceWizardStep[], t: TFunction, exists: Exists): string {
  const key = `compliance.activation.steps.${stepId}`;
  if (exists(key)) return t(key);
  return steps.find((s) => s.id === stepId)?.label ?? stepId;
}

/**
 * Text of a blocker in the UI language, from its stable code: the activation codes, then the safety checklist codes
 * (CO-07); the message localized by the server for a code unknown here; a generic text for a step without details.
 */
export function blockerText(
  blocker: ActivationBlocker,
  steps: ComplianceWizardStep[],
  t: TFunction,
  exists: Exists,
): string {
  if (blocker.code) {
    const activationKey = `compliance.activation.blockerCodes.${blocker.code}`;
    if (exists(activationKey)) return t(activationKey);
    const safetyKey = `compliance.safety.blockers.${blocker.code}`;
    if (exists(safetyKey)) return t(safetyKey);
  }
  if (blocker.message) return blocker.message;
  return t('compliance.activation.blockerList.stepIncomplete', { step: stepTitle(blocker.step, steps, t, exists) });
}

/** API body the property form sends for the property as it is stored (the base of "what changed"). */
export function propertyFormPayload(property: Property): CreatePropertyDto {
  return toPropertyPayload(propertyFormDefaults(property, 'short-rent') as PropertyFormValues, 'short-rent');
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function sameValue(key: keyof CreatePropertyDto, stored: unknown, submitted: unknown): boolean {
  if (key === 'cinCode') {
    return normalizeCin(stored as string | null | undefined) === normalizeCin(submitted as string | null | undefined);
  }
  if (Array.isArray(stored) || Array.isArray(submitted)) {
    const sorted = (v: unknown) => JSON.stringify([...((v as unknown[] | null | undefined) ?? [])].sort());
    return sorted(stored) === sorted(submitted);
  }
  if (isBlank(stored) && isBlank(submitted)) return true;
  return stored === submitted;
}

/**
 * Only the fields the host changed in the form: `PUT /properties/:id` has PATCH semantics (A2-04), so the fields left
 * out keep what the server has, e.g. a CIN saved meanwhile in the CIN step. Empty when nothing changed.
 */
export function changedPropertyFields(stored: CreatePropertyDto, submitted: CreatePropertyDto): UpdatePropertyDto {
  const changes: Record<string, unknown> = {};
  for (const key of Object.keys(submitted) as (keyof CreatePropertyDto)[]) {
    if (!sameValue(key, stored[key], submitted[key])) changes[key] = submitted[key];
  }
  return changes as UpdatePropertyDto;
}
