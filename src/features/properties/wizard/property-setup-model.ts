import type { BillingSetup, PropertySender } from '@/types';
import { propertyWizardPath } from '../properties-paths';

export const SETUP_RETURN_PARAM = 'returnPropertyId';

export function propertySetupReturn(params: URLSearchParams, step: 'compliance' | 'billing'): string | null {
  const id = params.get(SETUP_RETURN_PARAM);
  return id && /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? propertyWizardPath(id, step) : null;
}

export function senderChoiceSaved(sender: PropertySender | null | undefined): boolean {
  if (!sender?.applies) return false;
  return sender.source === 'Stored' || sender.source === 'OrganizationDefault';
}

export function billingIdentityComplete(setup: BillingSetup | undefined): boolean {
  return ['issuer', 'vat'].every(name => {
    const section = setup?.sections.find(item => item.section === name);
    return !!section && (!section.applies || section.complete);
  });
}
