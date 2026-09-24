import axios from '@/lib/axios';
import { ApiClient } from '@/api/client';
import type {
  CheckoutWizardCompleteCommand,
  CheckoutWizardCompleteResult,
  CheckoutWizardStartResult,
  CompletePropertyActivationCommand,
  ComplianceActivationCompleteResult,
  ComplianceActivationResult,
  ComplianceSummaryResult,
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

export async function startCheckoutWizard(bookingId: string): Promise<CheckoutWizardStartResult> {
  const { data } = await axios.post<CheckoutWizardStartResult>(
    `/bookings/${bookingId}/checkout-wizard/start`,
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
