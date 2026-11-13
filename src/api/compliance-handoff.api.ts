import { ApiClient } from './client';
import type { CassettoHandoff, CassettoHandoffRequest } from '@/types';

/** The codes of the problems of the handoff (`OctorateComplianceHandoffController`): each one is told in its own words. */
export const HANDOFF_ERROR = {
  /** 404: the property or the stay is not the caller's, is out of its reach, or the stay is not the property's. */
  targetNotFound: 'octorate_handoff_target_not_found',
  /** 409: the property is not connected to the channel manager. */
  propertyNotMapped: 'octorate_handoff_property_not_mapped',
  /** 409: no destination is configured. */
  destinationUnavailable: 'octorate_handoff_destination_unavailable',
} as const;

/** The controlled passage to the area of the channel manager that holds an Alloggiati or ISTAT outcome (CHK-15). */
export const complianceHandoffApi = {
  /**
   * `POST /compliance/octorate-handoffs`: prepares the handoff and records that it started. The request has no address in it (CasaZen alone decides
   * where the host goes) and the answer is the one allowlisted address to open in the same tab, the target and the guide. Nothing is read
   * from the channel manager and no compliance state changes: it is never a result. Behind the connector flag (404 while it is off).
   */
  start: (request: CassettoHandoffRequest) => ApiClient.post<CassettoHandoff>('/compliance/octorate-handoffs', request),
};
