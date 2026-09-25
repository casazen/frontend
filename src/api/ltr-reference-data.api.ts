import { ApiClient } from './client';
import type { DataCompleteness } from '@/types';

/** How the percentage coefficients of an agreement combine (backend `CoefficientCombination`). */
export const COEFFICIENT_COMBINATIONS = ['Additive', 'Multiplicative'] as const;
export type CoefficientCombination = (typeof COEFFICIENT_COMBINATIONS)[number];

/** Kind of the IMU rate stored for a comune (backend `ImuRateKind`). */
export const IMU_RATE_KINDS = ['Official', 'Derived'] as const;
export type ImuRateKind = (typeof IMU_RATE_KINDS)[number];

export const DATA_COMPLETENESS_VALUES = ['Complete', 'Partial', 'Missing'] as const;

/** Row of `GET /admin/canone-concordato/agreements` (LT-13). */
export interface AdminAgreementSummary {
  id: string;
  comune: string;
  region: string;
  agreementName: string;
  dataCompleteness: DataCompleteness;
  bandCount: number;
  zoneNames: string[];
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
  verificationSource: string | null;
  expiresAt: string | null;
  remainsInForceUntilReplaced: boolean;
  updatedAt: string | null;
}

/** Rules of the rent calculation stored on the agreement (every threshold and percentage is data, A7-22). */
export interface AgreementRules {
  requiredTypeACount: number;
  subFascia2MinTypeBCount: number;
  subFascia3MinTypeCCount: number;
  subFascia3MinQualifyingTypeDCount: number;
  subFascia3QualifyingTypeDElements: string | null;
  subFascia3MaxMinTypeDCount: number;
  stoveHeatingMinTypeBCount: number;
  coefficientCombination: CoefficientCombination;
  furnishedUpliftPercent: number;
  airConditioningUpliftPercent: number;
  smallSqmMax: number;
  smallSqmUpliftPercent: number;
  midSqmMin: number;
  midSqmMax: number;
  midSqmUpliftPercent: number;
  largeSqmMin: number;
  largeSqmReductionPercent: number;
  garageAppurtenancePercent: number;
  balconyAppurtenancePercent: number;
  otherAppurtenancePercent: number;
  greenAreaAppurtenancePercent: number;
  duration4UpliftPercent: number;
  duration5UpliftPercent: number;
  duration6UpliftPercent: number;
}

export interface AdminRentBand {
  id: string;
  zoneName: string;
  cadastralSheets: string | null;
  minSqm: number;
  maxSqm: number | null;
  subFascia1MinEurSqmYear: number;
  subFascia1MaxEurSqmYear: number;
  subFascia2MinEurSqmYear: number;
  subFascia2MaxEurSqmYear: number;
  subFascia3MinEurSqmYear: number;
  subFascia3MaxEurSqmYear: number;
}

export type UpdateRentBandInput = Omit<AdminRentBand, 'id'>;

export interface AdminSignatory {
  name: string;
  role: 'Proprieta' | 'Inquilini';
  contact: string;
}

/** `GET /admin/canone-concordato/agreements/:id`. */
export interface AdminAgreementDetail extends AdminAgreementSummary, AgreementRules {
  signedDate: string;
  effectiveDate: string;
  expiryNote: string | null;
  bands: AdminRentBand[];
  signatories: AdminSignatory[];
}

/** `PUT /admin/canone-concordato/agreements/:id`: status, source, expiry and rules. Never the verification date. */
export interface UpdateAgreementInput extends AgreementRules {
  dataCompleteness: DataCompleteness;
  sourceUrl: string | null;
  expiresAt: string | null;
  expiryNote: string | null;
  remainsInForceUntilReplaced: boolean;
}

/** Comune office receiving the IMU communication, with its rate (LT-13). */
export interface AdminImuChannel {
  id: string;
  comune: string;
  region: string;
  recipientOffice: string;
  email: string | null;
  pec: string | null;
  postalAddress: string | null;
  instructions: string | null;
  ratePercent: number | null;
  effectiveRatePercent: number | null;
  rateYear: number | null;
  rateKind: ImuRateKind | null;
  rateNotes: string | null;
  rateSourceUrl: string | null;
  sourceUrl: string | null;
  dataCompleteness: DataCompleteness;
  lastVerifiedAt: string | null;
  verificationSource: string | null;
  updatedAt: string | null;
}

export type UpdateImuChannelInput = Omit<
  AdminImuChannel,
  'id' | 'comune' | 'region' | 'lastVerifiedAt' | 'verificationSource' | 'updatedAt'
>;

/** `POST .../verify`: the date of the check (`YYYY-MM-DD`, not in the future) and what it was checked against. */
export interface MarkVerifiedInput {
  verifiedAt: string;
  source: string;
}

export interface RegulatoryAuditEntry {
  entityType: string;
  entityId: string;
  action: 'Updated' | 'MarkedVerified';
  changedByUserId: string;
  occurredAt: string;
  changes: string;
}

const BASE = '/admin/canone-concordato';

export const ltrReferenceDataApi = {
  getAgreements: () => ApiClient.get<AdminAgreementSummary[]>(`${BASE}/agreements`),
  getAgreement: (id: string) => ApiClient.get<AdminAgreementDetail>(`${BASE}/agreements/${id}`),
  updateAgreement: (id: string, input: UpdateAgreementInput) =>
    ApiClient.put<AdminAgreementDetail>(`${BASE}/agreements/${id}`, input),
  updateBand: (agreementId: string, bandId: string, input: UpdateRentBandInput) =>
    ApiClient.put<AdminAgreementDetail>(`${BASE}/agreements/${agreementId}/bands/${bandId}`, input),
  markAgreementVerified: (id: string, input: MarkVerifiedInput) =>
    ApiClient.post<AdminAgreementDetail>(`${BASE}/agreements/${id}/verify`, input),
  getImuChannels: () => ApiClient.get<AdminImuChannel[]>(`${BASE}/imu-channels`),
  updateImuChannel: (id: string, input: UpdateImuChannelInput) =>
    ApiClient.put<AdminImuChannel>(`${BASE}/imu-channels/${id}`, input),
  markImuChannelVerified: (id: string, input: MarkVerifiedInput) =>
    ApiClient.post<AdminImuChannel>(`${BASE}/imu-channels/${id}/verify`, input),
  getAudit: (entityId: string) => ApiClient.get<RegulatoryAuditEntry[]>(`${BASE}/audit`, { entityId }),
};
