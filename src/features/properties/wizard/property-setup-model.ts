import type { BillingSetup, PropertySender } from '@/types';
import { propertyWizardPath } from '../properties-paths';

export const SETUP_RETURN_PARAM = 'returnPropertyId';

/** The destination is built locally; a query can never supply a redirect URL. */
export function propertySetupReturn(params: URLSearchParams, step: 'compliance' | 'billing'): string | null {
  const id = params.get(SETUP_RETURN_PARAM);
  return id && /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? propertyWizardPath(id, step) : null;
}

export function senderChoiceSaved(sender: PropertySender | null | undefined): boolean {
  if (!sender?.applies) return false;
  // A default of Manual is not an answer the person gave. Verification is reported separately.
  return sender.source === 'Stored';
}

/** Collect the issuer identity and tax regime before finishing the property; other fiscal choices stay in their wizard. */
export function billingIdentityComplete(setup: BillingSetup | undefined): boolean {
  return ['issuer', 'vat'].every(name => {
    const section = setup?.sections.find(item => item.section === name);
    return !!section && (!section.applies || section.complete);
  });
}
