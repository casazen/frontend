import { isAxiosError } from 'axios';
import axios from '@/lib/axios';
import { ApiClient } from '@/api/client';
import { getProblemCode } from '@/lib/api-errors';
import type {
  ActivationBlockedProblem,
  ActivationBlocker,
  CheckoutWizardCompleteCommand,
  CheckoutWizardCompleteResult,
  CheckoutWizardProgressCommand,
  CheckoutWizardStartCommand,
  CheckoutWizardState,
  CompletePropertyActivationCommand,
  ComplianceActivationCompleteResult,
  ComplianceActivationResult,
  ComplianceSummaryResult,
  PropertyComplianceStatus,
  SafetyChecklist,
  SaveSafetyChecklistCommand,
} from '@/types/compliance.types';

export async function fetchComplianceActivation(propertyId: string): Promise<ComplianceActivationResult> {
  return ApiClient.get<ComplianceActivationResult>(`/properties/${propertyId}/compliance/activation`);
}

export async function completeComplianceActivation(
  propertyId: string,
  payload: CompletePropertyActivationCommand,
): Promise<ComplianceActivationCompleteResult> {
  const { data } = await axios.post<ComplianceActivationCompleteResult>(
    `/properties/${propertyId}/compliance/activation/complete`,
    payload,
  );
  return data;
}

/** `code` of the 409 of `POST .../activation/complete` when blocking steps are left (CO-07). */
export const ACTIVATION_BLOCKED_CODE = 'property_activation_blocked';

const COMPLIANCE_STATUSES: readonly PropertyComplianceStatus[] = ['Pending', 'Active', 'Suspended'];

function toBlocker(value: unknown): ActivationBlocker | null {
  if (typeof value !== 'object' || value === null) return null;
  const { step, code, message } = value as Record<string, unknown>;
  if (typeof step !== 'string' || typeof code !== 'string') return null;
  return { step, code, message: typeof message === 'string' ? message : '' };
}

/**
 * Body of the 409 `property_activation_blocked` (blockers with their step and stable code), or `undefined` for any
 * other error: those are shown with `getProblemMessage`.
 */
export function getActivationBlockedProblem(error: unknown): ActivationBlockedProblem | undefined {
  if (!isAxiosError(error) || error.response?.status !== 409) return undefined;
  const data: unknown = error.response.data;
  if (getProblemCode(data) !== ACTIVATION_BLOCKED_CODE) return undefined;

  const body = data as Record<string, unknown>;
  const blockers = Array.isArray(body.blockers)
    ? body.blockers.map(toBlocker).filter((b): b is ActivationBlocker => b !== null)
    : [];
  const incompleteBlockers = Array.isArray(body.incompleteBlockers)
    ? body.incompleteBlockers.filter((s): s is string => typeof s === 'string')
    : [];
  const status = COMPLIANCE_STATUSES.find((s) => s === body.complianceStatus) ?? null;
  return { complianceStatus: status, incompleteBlockers, blockers };
}

/** D.L. 145/2023 safety checklist of the property (CO-07), with its blockers and items "not applicable". */
export async function fetchSafetyChecklist(propertyId: string): Promise<SafetyChecklist> {
  return ApiClient.get<SafetyChecklist>(`/properties/${propertyId}/compliance/safety-checklist`);
}

export async function saveSafetyChecklist(
  propertyId: string,
  payload: SaveSafetyChecklistCommand,
): Promise<SafetyChecklist> {
  const { data } = await axios.put<SafetyChecklist>(
    `/properties/${propertyId}/compliance/safety-checklist`,
    payload,
  );
  return data;
}

export async function fetchComplianceSummary(): Promise<ComplianceSummaryResult> {
  return ApiClient.get<ComplianceSummaryResult>('/compliance/summary');
}

/**
 * Opens the check-out wizard (same rules as `POST /bookings/:id/check-out`, CO-08). `registerArrival` confirms that the
 * guest arrived: a confirmed booking whose arrival was never registered is checked in first ("registra arrivo e
 * procedi"); without it the API answers 409 `booking_arrival_not_registered`. Answers the 5 steps with the progress
 * saved (CO-17).
 */
export async function startCheckoutWizard(
  bookingId: string,
  payload: CheckoutWizardStartCommand = {},
): Promise<CheckoutWizardState> {
  const { data } = await axios.post<CheckoutWizardState>(`/bookings/${bookingId}/checkout-wizard/start`, payload);
  return data;
}

/** The wizard of a stay without any change: after the check-out, what was declared (CO-17). */
export async function fetchCheckoutWizard(bookingId: string): Promise<CheckoutWizardState> {
  return ApiClient.get<CheckoutWizardState>(`/bookings/${bookingId}/checkout-wizard`);
}

/** Saves the step the host is on and the answers given so far; nothing is created until the completion (CO-17). */
export async function saveCheckoutProgress(
  bookingId: string,
  payload: CheckoutWizardProgressCommand,
): Promise<CheckoutWizardState> {
  const { data } = await axios.put<CheckoutWizardState>(`/bookings/${bookingId}/checkout-wizard/progress`, payload);
  return data;
}

export async function completeCheckoutWizard(
  bookingId: string,
  payload: CheckoutWizardCompleteCommand,
): Promise<CheckoutWizardCompleteResult> {
  const { data } = await axios.post<CheckoutWizardCompleteResult>(
    `/bookings/${bookingId}/checkout-wizard/complete`,
    payload,
  );
  return data;
}

/** The host declares ready the property of a stay already checked out (turnover of the cockpit, CO-17). */
export async function confirmPropertyReady(bookingId: string, notes: string | null): Promise<CheckoutWizardState> {
  const { data } = await axios.post<CheckoutWizardState>(`/bookings/${bookingId}/checkout-wizard/property-ready`, {
    notes,
  });
  return data;
}
