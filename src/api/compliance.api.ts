import axios from '@/lib/axios';
import { ApiClient } from '@/api/client';
import type {
  CheckoutWizardCompleteCommand,
  CheckoutWizardCompleteResult,
  CheckoutWizardStartCommand,
  CheckoutWizardStartResult,
  CompletePropertyActivationCommand,
  ComplianceActivationCompleteResult,
  ComplianceActivationResult,
  ComplianceSummaryResult,
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

export async function fetchComplianceSummary(): Promise<ComplianceSummaryResult> {
  return ApiClient.get<ComplianceSummaryResult>('/compliance/summary');
}

/**
 * Opens the check-out wizard (same rules as `POST /bookings/:id/check-out`, CO-08). `registerArrival` confirms that the
 * guest arrived: a confirmed booking whose arrival was never registered is checked in first ("registra arrivo e
 * procedi"); without it the API answers 409 `booking_arrival_not_registered`.
 */
export async function startCheckoutWizard(
  bookingId: string,
  payload: CheckoutWizardStartCommand = {},
): Promise<CheckoutWizardStartResult> {
  const { data } = await axios.post<CheckoutWizardStartResult>(
    `/bookings/${bookingId}/checkout-wizard/start`,
    payload,
  );
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
