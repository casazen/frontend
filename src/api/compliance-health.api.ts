import { ApiClient } from './client';
import type { ComplianceConnectionHealth } from '@/types';

/** Connection health of the police and ISTAT send (CHK-12 point 7, E03/F02/US01/T02). */
export const complianceHealthApi = {
  /**
   * `GET /properties/{propertyId}/compliance/connection-health`: who sends the Alloggiati Web and ISTAT communications of the property and what
   * is known about it. For a channel-manager property the server reads the police account once, bounded in time; what it cannot read is
   * `Unknown`. The answer holds no credential and no token. A property of another org is 404, one the caller does not reach 403.
   */
  getConnectionHealth: (propertyId: string) =>
    ApiClient.get<ComplianceConnectionHealth>(`/properties/${encodeURIComponent(propertyId)}/compliance/connection-health`),
};
