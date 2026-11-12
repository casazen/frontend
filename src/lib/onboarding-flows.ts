import {
  ONBOARDING_FLOW_KEYS,
  ONBOARDING_FLOW_REASONS,
  ONBOARDING_FLOW_STATES,
  type FlowPropertyStatus,
  type OnboardingFlowKey,
  type OnboardingFlowState,
  type OnboardingPartKey,
} from '@/types/onboarding.types';

/**
 * The six flows CasaZen runs for a property and where they stand (E10/F03/US02, NF-104, NF-106): the keys of their texts, the flow each part of the
 * plan is about, and the plain words of what is missing. The server sends codes only; a code this version of the app does not know reads as a neutral
 * line, never as a bare key.
 */

const FLOW_KEYS: ReadonlySet<string> = new Set(ONBOARDING_FLOW_KEYS);
const FLOW_STATES: ReadonlySet<string> = new Set(ONBOARDING_FLOW_STATES);
const FLOW_REASONS: ReadonlySet<string> = new Set(ONBOARDING_FLOW_REASONS);

export const flowNameKey = (flow: OnboardingFlowKey) => `onboardingPlan.flows.names.${flow}`;
export const flowStateKey = (state: OnboardingFlowState) => `onboardingPlan.flows.states.${state}`;

/** True for one of the six flows this version of the app has a name for. */
export function isOnboardingFlowKey(value: unknown): value is OnboardingFlowKey {
  return typeof value === 'string' && FLOW_KEYS.has(value);
}

/** The state a flow is shown in. A state this version does not know (the server is newer than the app) is shown as «da completare»: there is something to look at. */
export function normalizeFlowState(state: unknown): OnboardingFlowState {
  return typeof state === 'string' && FLOW_STATES.has(state) ? (state as OnboardingFlowState) : 'toComplete';
}

/** The text of the reason a flow is not active on a property, in plain words (`onboardingPlan.reasons.property.<code>`); a code it has no text for reads as a neutral line. */
export function flowReasonKey(reason: string | null | undefined): string {
  return reason && FLOW_REASONS.has(reason) ? `onboardingPlan.reasons.property.${reason}` : 'onboardingPlan.reasons.property.unknown';
}

/** The reason to tell for a property: its own, or the first prerequisite it lacks; `null` when the flow is active. */
export function reasonOf(status: Pick<FlowPropertyStatus, 'state' | 'reason' | 'prerequisites'>): string | null {
  if (normalizeFlowState(status.state) === 'active') return null;
  if (status.reason) return status.reason;
  return (status.prerequisites ?? []).find((prerequisite) => !prerequisite.met && prerequisite.reason)?.reason ?? null;
}

/**
 * The flow whose properties a part lists: the listings and the prices are about the content of the listings, the connection, the mapping and the
 * channels about the bookings, the compliance and the identification about the check-in and the legal obligations. The parts nobody lists
 * properties for (the partners, the summary) have none.
 */
const PART_FLOWS: Readonly<Partial<Record<OnboardingPartKey, OnboardingFlowKey>>> = {
  octorateConnection: 'Bookings',
  properties: 'Bookings',
  channels: 'Bookings',
  listings: 'Listings',
  pricesRules: 'Listings',
  compliance: 'CheckInCompliance',
  identification: 'CheckInCompliance',
  messagesAi: 'Messages',
  fiscalDocuments: 'Documents',
};

export function flowOfPart(part: OnboardingPartKey): OnboardingFlowKey | undefined {
  return PART_FLOWS[part];
}
