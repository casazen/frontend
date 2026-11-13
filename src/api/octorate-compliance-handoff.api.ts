import { ApiClient } from './client';
import type { ComplianceHandoff, ComplianceHandoffRequest } from '@/types/compliance-handoff.types';

/**
 * «Verifica nel tuo Cassetto Compliance» (CHK-15, E03/F05): the endpoint answers 404 while the backend flag `Features:OctorateConnector` is off.
 * It prepares the destination and the guide and records that the passage started; it never reads an outcome and has no completion or result
 * call, so starting a handoff creates no proof, changes no compliance light and marks nothing compliant.
 */
export const octorateComplianceHandoffApi = {
  /**
   * Prepares the handoff for a property, a stay or a period (`booking.read`, in the reach of the caller's scope). A 404
   * `octorate_handoff_target_not_found` is a property or stay that is not the caller's, is out of its reach or does not match; a 409
   * `octorate_handoff_property_not_mapped` a property that is not connected; a 409 `octorate_handoff_destination_unavailable` an area with no
   * address configured; a 422 `octorate_handoff_return_path_invalid` or `octorate_handoff_period_invalid` a value the server does not accept.
   */
  start: (request: ComplianceHandoffRequest) => ApiClient.post<ComplianceHandoff>('/compliance/octorate-handoffs', request),
};
