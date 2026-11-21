import { clearWizardDraft, readWizardDraft, writeWizardDraft, type WizardDraftScope } from '@/lib/wizard-draft';

/** The last saved property this person was setting up. Only identifiers go in tab storage. */
const PROGRESS_KEY = 'short-rent-property-setup';
export const WIZARD_STEP_IDS = [
  'base', 'owner', 'photos', 'amenities', 'descriptions', 'rules', 'prices', 'channels', 'compliance', 'billing', 'finish',
] as const;
export type WizardStepId = (typeof WIZARD_STEP_IDS)[number];

export function rememberPropertyStep(scope: WizardDraftScope, propertyId: string, step: string) {
  if (!scope.orgId || !WIZARD_STEP_IDS.some(id => id === step)) return;
  writeWizardDraft(PROGRESS_KEY, scope, { step, values: { propertyId } });
}

export function readPropertyStep(scope: WizardDraftScope) {
  if (!scope.orgId) return null;
  const draft = readWizardDraft(PROGRESS_KEY, scope);
  const propertyId = draft?.values.propertyId;
  const step = WIZARD_STEP_IDS.find(id => id === draft?.step);
  return typeof propertyId === 'string' && step ? { propertyId, step } : null;
}

export function forgetPropertyStep(scope: WizardDraftScope, propertyId: string) {
  if (readPropertyStep(scope)?.propertyId === propertyId) clearWizardDraft(PROGRESS_KEY, scope);
}

export function propertyStepLabel(step: WizardStepId): string {
  if (step === 'owner') return 'propertyWizard.owner.label';
  if (step === 'compliance' || step === 'billing') return `propertySetup.${step}.label`;
  return `propertyWizard.steps.${step}.label`;
}
