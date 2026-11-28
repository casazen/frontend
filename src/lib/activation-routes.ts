import { getManifestEntry, hasEntryPermission, type PermissionPredicate } from '@/config/route-manifest';
import type { ActivationStep } from '@/types/onboarding.types';

const ONBOARDING_PATH = '/onboarding';

const PROPERTIES = '/app/short-rent/properties';
const PROPERTY_CREATE = '/app/short-rent/properties/create';
const ORGANIZATION = '/app/short-rent/settings/organization';
const PAYMENTS = '/app/short-rent/settings/payments';
const COMPLIANCE = '/app/short-rent/compliance';
const VETRINA = '/app/short-rent/vetrina';

function activationStepPath(step: Pick<ActivationStep, 'key' | 'reason'>): string | null {
  switch (step.key) {
    case 'account':
      return ONBOARDING_PATH;
    case 'organization':
      return ORGANIZATION;
    case 'property':
      return PROPERTY_CREATE;
    case 'cin':
      return PROPERTIES;
    case 'payments':
      return PAYMENTS;
    case 'sitePublished':
      switch (step.reason) {
        case 'no_property':
          return PROPERTY_CREATE;
        case 'properties_paused':
        case 'properties_inactive':
          return PROPERTIES;
        case 'compliance_pending':
          return COMPLIANCE;
        case 'payments_not_ready':
          return PAYMENTS;
        default:
          return null;
      }
    case 'firstBooking':
      return VETRINA;
    default:
      return null;
  }
}

/**
 * Page to offer for a checklist step, or null when there is none: a blocked step (another step comes first), a step
 * with nothing the host can open, or a user who may not open the page. The path is checked against the ROUTE_MANIFEST,
 * so a renamed page breaks the tests instead of sending the host to the dashboard.
 */
export function activationStepRoute(
  step: Pick<ActivationStep, 'key' | 'state' | 'reason'>,
  hasPermission?: PermissionPredicate,
): string | null {
  if (step.state === 'done' || step.state === 'blocked') return null;

  const path = activationStepPath(step);
  if (!path || path === ONBOARDING_PATH) return path;

  const entry = getManifestEntry(path);
  if (!entry || !hasEntryPermission(entry, hasPermission)) return null;
  return entry.path;
}

export function activationStepCtaKey(step: Pick<ActivationStep, 'key' | 'state' | 'reason'>): string {
  switch (step.key) {
    case 'account':
      return 'activation.cta.onboarding';
    case 'organization':
      return 'activation.cta.organization';
    case 'property':
      return 'activation.cta.property';
    case 'cin':
      return 'activation.cta.cin';
    case 'payments':
      return step.state === 'todo' ? 'activation.cta.paymentsStart' : 'activation.cta.paymentsContinue';
    case 'sitePublished':
      switch (step.reason) {
        case 'no_property':
          return 'activation.cta.property';
        case 'properties_paused':
          return 'activation.cta.reactivate';
        case 'compliance_pending':
          return 'activation.cta.compliance';
        case 'payments_not_ready':
          return 'activation.cta.paymentsContinue';
        default:
          return 'activation.cta.properties';
      }
    case 'firstBooking':
      return 'activation.cta.share';
    default:
      return 'activation.cta.open';
  }
}

/**
 * Router state for the link of a step. The account step opens the onboarding wizard, which would otherwise send an
 * already onboarded user straight home: the flag tells it the user came to finish a step that is still open.
 */
export function activationStepLinkState(step: Pick<ActivationStep, 'key'>): { completeStep: true } | undefined {
  return step.key === 'account' ? { completeStep: true } : undefined;
}
