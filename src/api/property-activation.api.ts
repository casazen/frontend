import { ApiClient } from './client';

export type ImportFinding = {
  field: string;
  status: 'missing' | 'confirm' | 'mapping';
  reason: string;
  source: string | null;
};

export type PropertyImportRatePlan = {
  id: string;
  name: string;
  currency: string;
  unit: string;
  amount: number | null;
  occupants: number | null;
  from: string | null;
  to: string | null;
  conditions: string | null;
  payment: string | null;
  restrictions: string | null;
  supplements: string | null;
  derivedFrom: string | null;
  priceKind: 'quote' | 'list' | 'effective';
  prices: { date: string; amount: number }[] | null;
};

export type PropertyImportSnapshot = {
  provider: string;
  sourceId: string;
  sourceUrl: string;
  parentSourceId?: string;
  descriptionIt?: string;
  descriptionEn?: string;
  nightlyRate?: number;
  currency?: string;
  ratePlans: PropertyImportRatePlan[];
  findings: ImportFinding[];
  unmappedFields?: Record<string, string>;
};

export type PropertyImportReview = {
  propertyId: string;
  snapshot: PropertyImportSnapshot;
  openFindings: ImportFinding[];
  checkedAt: string;
};

export const propertyActivationApi = {
  review: (id: string) => ApiClient.get<PropertyImportReview | undefined>(`/properties/${encodeURIComponent(id)}/import-review`),
  recheck: (id: string, confirmedField?: string) =>
    ApiClient.post<PropertyImportReview>(`/properties/${encodeURIComponent(id)}/import-review/recheck`, { confirmedField }),
  record: (orgId: string, propertyId: string, snapshot: PropertyImportSnapshot) =>
    ApiClient.put<PropertyImportReview>(`/admin/property-import-reviews/${encodeURIComponent(orgId)}/${encodeURIComponent(propertyId)}`, snapshot),
};

export type PreparationSelection = { orgId: string; propertyId: string };
export type PreparationRow = PreparationSelection & {
  id: string;
  batchId: string;
  propertyName: string;
  status: 'Queued' | 'ReconcileCreation' | 'WaitingForLicense' | 'Ready' | 'NeedsReview';
  accommodationId: string | null;
  supplierReference: string | null;
  errorCode: string | null;
  updatedAt: string;
};
export type PreparationBatch = { id: string; rows: PreparationRow[] };

const preparationPath = '/admin/octorate-preparation';
export const propertyPreparationApi = {
  recent: () => ApiClient.get<PreparationRow[]>(preparationPath),
  start: (properties: PreparationSelection[]) => ApiClient.post<PreparationBatch>(preparationPath, { properties }),
  resume: (batchId: string) => ApiClient.post<void>(`${preparationPath}/${batchId}/resume`, {}),
  supplierReference: (batchId: string, reference: string) => ApiClient.put<void>(`${preparationPath}/${batchId}/supplier-reference`, { reference }),
  reconcile: (batchId: string, rowId: string, accommodationId: string) =>
    ApiClient.post<void>(`${preparationPath}/${batchId}/items/${rowId}/reconcile`, { accommodationId }),
};

export type ActivationServicesState = {
  requiredPortals: string[] | null;
  pendingPortals: string[];
  complianceAvailable: boolean;
  complianceApplies: boolean;
  preparationStatus: PreparationRow['status'] | null;
};

const servicesPath = (id: string) => `/properties/${encodeURIComponent(id)}/activation-services`;
export const propertyActivationServicesApi = {
  detail: (id: string) => ApiClient.get<ActivationServicesState>(servicesPath(id)),
  savePortals: (id: string, portals: string[]) => ApiClient.put<ActivationServicesState>(`${servicesPath(id)}/portals`, { portals }),
  request: (id: string, service: 'alloggiati' | 'istat') => ApiClient.post<{ id: string }>(`${servicesPath(id)}/compliance`, { service }),
};

export type ActivationAccountInput = {
  service: string;
  username: string;
  password: string;
  webServiceKey?: string;
  properties: { propertyId: string; code?: string }[];
};

export type ActivationAccount = { id: string; service: string; expiresAt: string; propertyIds: string[] };
export type ActivationAccountOutcome = { propertyId: string; activationId: string | null; requestId: string | null; errorCode: string | null };
const accountsPath = '/property-activation-accounts';

export const activationAccountsApi = {
  list: () => ApiClient.get<ActivationAccount[]>(accountsPath),
  store: (input: ActivationAccountInput) => ApiClient.post<ActivationAccount>(accountsPath, input),
  run: (id: string) => ApiClient.post<ActivationAccountOutcome[]>(`${accountsPath}/${id}/run`, {}),
  revoke: (id: string) => ApiClient.delete<void>(`${accountsPath}/${id}`),
};
