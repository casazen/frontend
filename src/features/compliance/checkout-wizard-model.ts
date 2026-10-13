import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import {
  CHECKOUT_WIZARD_STEPS,
  TOURIST_TAX_COLLECTIONS,
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
 * What the host answered in the check-out wizard (CO-17, A5-24). The wizard (`WizardShell`) holds them as the values of
 * its form and saves them as progress on the server when the host lands on another step: a reload, or the app, opens the
 * wizard on the same step with the same answers. The step is not one of them: it lives in the address (`?step=`).
 */
export interface CheckoutAnswers {
  departureConfirmed: boolean;
  cleaningChoice: CheckoutCleaningChoice | null;
  supplierOrgId: string | null;
  serviceCategory: string;
  serviceNotes: string;
  touristTaxCollection: TouristTaxCollection | null;
  propertyReady: boolean | null;
  propertyNotes: string;
}

function isCheckoutStepId(value: string | null | undefined): value is CheckoutWizardStepId {
  return (CHECKOUT_WIZARD_STEPS as readonly string[]).includes(value ?? '');
}

/** The step the server says the wizard is on, or the first when it says something this app does not know. */
export function stepFromState(state: CheckoutWizardState): CheckoutWizardStepId {
  return isCheckoutStepId(state.currentStep) ? state.currentStep : CHECKOUT_WIZARD_STEPS[0];
}

/**
 * The answers as the server saved them. The tax of a booking paid online on the booking site is proposed as
 * "collected online" (the host still confirms it by moving on); nothing else is assumed.
 */
export function answersFromState(state: CheckoutWizardState): CheckoutAnswers {
  return {
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

/**
 * What each step asks before the next ones open (messages are i18n keys, as in every form). The Alloggiati step is
 * informational: a communication still to send is shown, never blocking the check-out, so it has no rules.
 */
export const checkoutStepSchemas: Partial<Record<CheckoutWizardStepId, ZodType<unknown, FieldValues>>> = {
  'stay-summary': z.object({
    departureConfirmed: z.boolean().refine((confirmed) => confirmed, 'compliance.checkout.errors.confirmDeparture'),
  }),
  cleaning: z
    .object({
      cleaningChoice: z.enum(['Request', 'Skip'], 'compliance.checkout.errors.cleaningChoice'),
      supplierOrgId: z.string().nullable(),
      serviceCategory: z.string(),
    })
    .superRefine((cleaning, context) => {
      if (cleaning.cleaningChoice !== 'Request') return;
      if (!cleaning.supplierOrgId) {
        context.addIssue({ code: 'custom', path: ['supplierOrgId'], message: 'compliance.checkout.errors.cleaningSupplier' });
      }
      if (!cleaning.serviceCategory) {
        context.addIssue({ code: 'custom', path: ['serviceCategory'], message: 'compliance.checkout.errors.cleaningCategory' });
      }
    }),
  'tourist-tax': z.object({
    touristTaxCollection: z.enum(TOURIST_TAX_COLLECTIONS, 'compliance.checkout.errors.taxCollection'),
  }),
  'property-ready': z.object({
    propertyReady: z.boolean('compliance.checkout.errors.propertyReady'),
  }),
};

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Body of `PUT checkout-wizard/progress` for the answers, on `step`. */
export function progressCommand(answers: CheckoutAnswers, step: CheckoutWizardStepId): CheckoutWizardProgressCommand {
  const request = answers.cleaningChoice === 'Request';
  return {
    currentStep: step,
    departureConfirmed: answers.departureConfirmed,
    cleaningChoice: answers.cleaningChoice,
    supplierOrgId: request ? answers.supplierOrgId : null,
    serviceCategory: request ? textOrNull(answers.serviceCategory) : null,
    serviceNotes: request ? textOrNull(answers.serviceNotes) : null,
    touristTaxCollection: answers.touristTaxCollection,
    propertyReady: answers.propertyReady,
    propertyNotes: textOrNull(answers.propertyNotes),
  };
}

/**
 * Body of `POST checkout-wizard/complete`: the cleaning request of step 3 (or "skip"), the tax collection of step 4 and
 * the readiness of step 5 exactly as answered. A property "not ready yet" stays a turnover in the cockpit.
 */
export function completeCommand(answers: CheckoutAnswers): CheckoutWizardCompleteCommand {
  const request = answers.cleaningChoice === 'Request';
  return {
    confirmDeparture: answers.departureConfirmed,
    cleaningChoice: answers.cleaningChoice,
    supplierOrgId: request ? answers.supplierOrgId : null,
    serviceCategory: request ? textOrNull(answers.serviceCategory) : null,
    serviceNotes: request ? textOrNull(answers.serviceNotes) : null,
    touristTaxCollection: answers.touristTaxCollection,
    propertyReady: answers.propertyReady === true,
    propertyNotes: textOrNull(answers.propertyNotes),
  };
}
