import { ApiClient } from './client';
import type { ComplianceHandoff, ComplianceHandoffRequest } from '@/types/compliance-handoff.types';

/**
 * «Verifica nel tuo Cassetto Compliance» (CHK-15, E03/F05): the endpoint answers 404 while the backend flag `Features:OctorateConnector` is off.
 * It prepares the destination and the guide and records that the passage started; it never reads an outcome and has no completion or result
 * call, so starting a handoff creates no proof, changes no compliance light and marks nothing compliant.
 */
export const octorateComplianceHandoffApi = {
  start: (request: ComplianceHandoffRequest) => ApiClient.post<ComplianceHandoff>('/compliance/octorate-handoffs', request),
};
