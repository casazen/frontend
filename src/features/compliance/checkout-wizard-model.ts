import {
  CHECKOUT_WIZARD_STEPS,
  type CheckoutCleaningChoice,
  type CheckoutWizardCompleteCommand,
  type CheckoutWizardProgressCommand,
  type CheckoutWizardState,
  type CheckoutWizardStepId,
  type TouristTaxCollection,
} from '@/types/compliance.types';

/** Category proposed for the request of step 3 (backend catalog code, SU-03). */
export const DEFAULT_CLEANING_CATEGORY = 'cleaning';

/**
 * What the host answered in the check-out wizard (CO-17, A5-24), edited in the page and saved as progress on the
 * server when moving between steps: a reload, or the app, opens the wizard on the same step with the same answers.
 */
export interface CheckoutDraft {
  step: CheckoutWizardStepId;
  departureConfirmed: boolean;
  cleaningChoice: CheckoutCleaningChoice | null;
  supplierOrgId: string | null;
  serviceCategory: string;
  serviceNotes: string;
  touristTaxCollection: TouristTaxCollection | null;
  propertyReady: boolean | null;
  propertyNotes: string;
}

export function isCheckoutStepId(value: string | null | undefined): value is CheckoutWizardStepId {
  return (CHECKOUT_WIZARD_STEPS as readonly string[]).includes(value ?? '');
}

export function stepIndex(step: CheckoutWizardStepId): number {
  return CHECKOUT_WIZARD_STEPS.indexOf(step);
}

/**
 * The draft of the wizard as the server saved it. The tax of a booking paid online on the booking site is proposed as
 * "collected online" (the host still confirms it by moving on); nothing else is assumed.
 */
export function draftFromState(state: CheckoutWizardState): CheckoutDraft {
  return {
    step: isCheckoutStepId(state.currentStep) ? state.currentStep : 'stay-summary',
    departureConfirmed: state.stay.departureConfirmed,
    cleaningChoice: state.cleaning.choice,
    supplierOrgId: state.cleaning.supplierOrgId,
    serviceCategory: state.cleaning.category ?? DEFAULT_CLEANING_CATEGORY,
    serviceNotes: state.cleaning.notes ?? '',
    touristTaxCollection:
      state.touristTax.collection ?? (state.touristTax.collectedWithOnlinePayment ? 'CollectedOnline' : null),
    propertyReady: state.propertyReady.ready,
    propertyNotes: state.propertyReady.notes ?? '',
  };
}

/** True when the host answered what the step asks: only then the next steps open. */
export function isStepAnswered(draft: CheckoutDraft, step: CheckoutWizardStepId): boolean {
  switch (step) {
    case 'stay-summary':
      return draft.departureConfirmed;
    case 'alloggiati':
      // Informational: a communication still to send is shown, never blocking the check-out.
      return true;
    case 'cleaning':
      return (
        draft.cleaningChoice === 'Skip' ||
        (draft.cleaningChoice === 'Request' && !!draft.supplierOrgId && !!draft.serviceCategory)
      );
    case 'tourist-tax':
      return draft.touristTaxCollection !== null;
    case 'property-ready':
      return draft.propertyReady !== null;
  }
}

/** A step can be opened when every step before it is answered (going back is always possible). */
export function canOpenStep(draft: CheckoutDraft, step: CheckoutWizardStepId): boolean {
  return CHECKOUT_WIZARD_STEPS.slice(0, stepIndex(step)).every((previous) => isStepAnswered(draft, previous));
}

/** Every step answered: the stay can be closed. */
export function canComplete(draft: CheckoutDraft): boolean {
  return CHECKOUT_WIZARD_STEPS.every((step) => isStepAnswered(draft, step));
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Body of `PUT checkout-wizard/progress` for the draft, on `step`. */
export function progressCommand(draft: CheckoutDraft, step: CheckoutWizardStepId): CheckoutWizardProgressCommand {
  const request = draft.cleaningChoice === 'Request';
  return {
    currentStep: step,
    departureConfirmed: draft.departureConfirmed,
    cleaningChoice: draft.cleaningChoice,
    supplierOrgId: request ? draft.supplierOrgId : null,
    serviceCategory: request ? textOrNull(draft.serviceCategory) : null,
    serviceNotes: request ? textOrNull(draft.serviceNotes) : null,
    touristTaxCollection: draft.touristTaxCollection,
    propertyReady: draft.propertyReady,
    propertyNotes: textOrNull(draft.propertyNotes),
  };
}

/**
 * Body of `POST checkout-wizard/complete`: the cleaning request of step 3 (or "skip"), the tax collection of step 4 and
 * the readiness of step 5 exactly as answered. A property "not ready yet" stays a turnover in the cockpit.
 */
export function completeCommand(draft: CheckoutDraft): CheckoutWizardCompleteCommand {
  const request = draft.cleaningChoice === 'Request';
  return {
    confirmDeparture: draft.departureConfirmed,
    cleaningChoice: draft.cleaningChoice,
    supplierOrgId: request ? draft.supplierOrgId : null,
    serviceCategory: request ? textOrNull(draft.serviceCategory) : null,
    serviceNotes: request ? textOrNull(draft.serviceNotes) : null,
    touristTaxCollection: draft.touristTaxCollection,
    propertyReady: draft.propertyReady === true,
    propertyNotes: textOrNull(draft.propertyNotes),
  };
}
