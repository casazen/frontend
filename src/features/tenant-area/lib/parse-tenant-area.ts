import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { tenantMaintenanceStatus } from './maintenance-status';
import type {
  RentLedgerComponent,
  TenantBankDetails,
  TenantContract,
  TenantContractArea,
  TenantContractSummary,
  TenantDocument,
  TenantDue,
  TenantEmergency,
  TenantMaintenanceRequest,
  TenantMaintenanceUpdate,
  TenantPaymentDeclaration,
  TenantProperty,
} from '@/types';

const DECLARATION_STATUSES = new Set(['Submitted', 'Verified', 'Rejected', 'Superseded']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(path: string): never {
  throw new UnexpectedApiResponseError(path);
}

function text(record: Record<string, unknown>, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') fail(path);
  return value;
}

function optionalText(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function amount(record: Record<string, unknown>, key: string, path: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path);
  return value;
}

function optionalAmount(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function componentsOf(value: unknown): RentLedgerComponent[] | null {
  if (!Array.isArray(value)) return null;
  const parts: RentLedgerComponent[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.kind !== 'string' || typeof item.amount !== 'number') continue;
    parts.push({
      id: typeof item.id === 'string' ? item.id : undefined,
      kind: item.kind,
      amount: item.amount,
      description: optionalText(item, 'description'),
    });
  }
  return parts.length > 0 ? parts : null;
}

function bankOf(value: unknown, path: string): TenantBankDetails | null {
  if (value == null) return null;
  if (!isRecord(value)) fail(path);
  return {
    accountHolder: text(value, 'accountHolder', path),
    iban: text(value, 'iban', path),
    amount: amount(value, 'amount', path),
    dueDate: text(value, 'dueDate', path),
    reference: text(value, 'reference', path),
  };
}

function declarationOf(value: unknown, path: string): TenantPaymentDeclaration | null {
  if (value == null) return null;
  if (!isRecord(value) || typeof value.status !== 'string' || !DECLARATION_STATUSES.has(value.status)) fail(path);
  return {
    id: text(value, 'id', path),
    status: value.status as TenantPaymentDeclaration['status'],
    amount: amount(value, 'amount', path),
    transferDate: text(value, 'transferDate', path),
    submittedAt: text(value, 'submittedAt', path),
    bankReference: optionalText(value, 'bankReference'),
  };
}

export function parseTenantContractList(data: unknown): TenantContractSummary[] {
  const path = '/tenant-area';
  if (!isRecord(data) || !Array.isArray(data.contracts)) fail(path);
  return data.contracts.map((item) => {
    if (!isRecord(item)) fail(path);
    const role = item.role === 'Tenant' ? 'Tenant' : 'TenantPrimary';
    return {
      id: text(item, 'id', path),
      label: text(item, 'label', path),
      propertyName: text(item, 'propertyName', path),
      role,
      status: optionalText(item, 'status') ?? '',
    };
  });
}

function propertyOf(value: unknown, path: string): TenantProperty {
  if (!isRecord(value)) fail(path);
  return {
    id: text(value, 'id', path),
    name: text(value, 'name', path),
    address: optionalText(value, 'address'),
  };
}

function contractOf(value: unknown, path: string): TenantContract {
  if (!isRecord(value)) fail(path);
  return {
    id: text(value, 'id', path),
    label: text(value, 'label', path),
    status: optionalText(value, 'status') ?? '',
    startDate: optionalText(value, 'startDate'),
    endDate: optionalText(value, 'endDate'),
    role: value.role === 'Tenant' ? 'Tenant' : 'TenantPrimary',
  };
}

function dueOf(value: unknown, path: string): TenantDue {
  if (!isRecord(value)) fail(path);
  return {
    id: text(value, 'id', path),
    periodStart: text(value, 'periodStart', path),
    periodEnd: text(value, 'periodEnd', path),
    dueDate: text(value, 'dueDate', path),
    currency: optionalText(value, 'currency') ?? 'EUR',
    amount: amount(value, 'amount', path),
    amountPaid: optionalAmount(value, 'amountPaid'),
    residual: optionalAmount(value, 'residual'),
    status: optionalText(value, 'status') ?? 'Scheduled',
    isOverdue: value.isOverdue === true,
    components: componentsOf(value.components),
    bank: bankOf(value.bank, path),
    declaration: declarationOf(value.declaration, path),
  };
}

function documentOf(value: unknown, path: string): TenantDocument {
  if (!isRecord(value)) fail(path);
  return {
    id: text(value, 'id', path),
    name: text(value, 'name', path),
    kind: optionalText(value, 'kind') ?? 'Other',
    sharedAt: optionalText(value, 'sharedAt'),
  };
}

function emergencyOf(value: unknown): TenantEmergency | null {
  if (!isRecord(value)) return null;
  const contacts = Array.isArray(value.contacts)
    ? value.contacts.flatMap((item) => {
        if (!isRecord(item) || typeof item.name !== 'string' || typeof item.phone !== 'string') return [];
        return [{ name: item.name, phone: item.phone }];
      })
    : [];
  const instructions = optionalText(value, 'instructions');
  if (!instructions && contacts.length === 0) return null;
  return { instructions, contacts };
}

export function parseTenantContractArea(data: unknown): TenantContractArea {
  const path = '/tenant-area/contracts/:id';
  if (!isRecord(data)) fail(path);
  const categories = Array.isArray(data.maintenanceCategories)
    ? data.maintenanceCategories.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : [];
  return {
    contract: contractOf(data.contract, path),
    property: propertyOf(data.property, path),
    dues: Array.isArray(data.dues) ? data.dues.map((item) => dueOf(item, path)) : [],
    documents: Array.isArray(data.documents) ? data.documents.map((item) => documentOf(item, path)) : [],
    emergency: emergencyOf(data.emergency),
    maintenanceCategories: categories,
  };
}

export function parseTenantDeclaration(data: unknown): TenantPaymentDeclaration {
  const path = '/tenant-area/contracts/:id/dues/:dueId/declarations';
  const declaration = declarationOf(data, path);
  if (!declaration) fail(path);
  return declaration;
}

function updatesOf(value: unknown): TenantMaintenanceUpdate[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const author = typeof item.author === 'string' ? item.author : typeof item.from === 'string' ? item.from : null;
    // A message from the supplier (quote, price, commercial terms) is not for the tenant.
    if (author && author !== 'Manager' && author !== 'Tenant') return [];
    const body = typeof item.text === 'string' ? item.text : typeof item.body === 'string' ? item.body : '';
    if (body.trim() === '') return [];
    return [{ id: typeof item.id === 'string' ? item.id : body, at: typeof item.at === 'string' ? item.at : '', text: body }];
  });
}

/**
 * Keeps only what a tenant may see. Supplier name, price, quote and payment fields on the payload are dropped, so they
 * cannot be rendered even when the API still sends the host view.
 */
export function parseTenantMaintenance(data: unknown): TenantMaintenanceRequest {
  const path = '/tenant-area/contracts/:id/maintenance/:id';
  if (!isRecord(data)) fail(path);
  const attachments = Array.isArray(data.attachments)
    ? data.attachments.flatMap((item) => {
        if (!isRecord(item) || typeof item.name !== 'string') return [];
        return [{ id: typeof item.id === 'string' ? item.id : item.name, name: item.name }];
      })
    : [];
  return {
    id: text(data, 'id', path),
    category: text(data, 'category', path),
    urgency: optionalText(data, 'urgency') ?? 'Normal',
    description: text(data, 'description', path),
    submittedAt: optionalText(data, 'submittedAt') ?? '',
    status: tenantMaintenanceStatus(optionalText(data, 'status')),
    updates: updatesOf(data.updates ?? data.messages),
    attachments,
  };
}

export function parseTenantMaintenanceList(data: unknown): TenantMaintenanceRequest[] {
  const path = '/tenant-area/contracts/:id/maintenance';
  if (!isRecord(data) || !Array.isArray(data.items)) fail(path);
  return data.items.map((item) => parseTenantMaintenance(item));
}
