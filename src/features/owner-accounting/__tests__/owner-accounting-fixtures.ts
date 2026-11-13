import type {
  OwnerAccountingPolicy,
  OwnerCloseReadiness,
  OwnerFiscalProfile,
  OwnerLedgerEntry,
  OwnerPayout,
  OwnerPeriodReadiness,
  OwnerStatementVersion,
  TaxF24Record,
  TaxReportingDataset,
} from '@/types';

/** A month long past: the page may always close it, whatever day the tests run. */
export const YEAR = 2025;
export const MONTH = 1;
export const OWNER_ID = '11111111-1111-4111-8111-111111111111';
export const OTHER_OWNER_ID = '22222222-2222-4222-8222-222222222222';
export const VERSION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const OLD_VERSION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const BOOKING_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

export function version(overrides: Partial<OwnerStatementVersion> = {}): OwnerStatementVersion {
  return {
    id: VERSION_ID,
    ownerId: OWNER_ID,
    year: YEAR,
    month: MONTH,
    version: 2,
    status: 'Published',
    currency: 'EUR',
    cutoffAt: '2025-02-03T08:00:00Z',
    openingBalance: 100,
    revenue: 1000,
    channelFees: -100,
    commission: -150,
    charges: -50,
    payments: 0,
    corrections: 0,
    closingBalance: 800,
    entryCount: 4,
    entriesSha256: 'a'.repeat(64),
    issuesJson: null,
    approvedAt: '2025-02-03T09:00:00Z',
    approvedByUserId: 'auth0|admin',
    publishedAt: '2025-02-03T10:00:00Z',
    publishedByUserId: 'auth0|admin',
    publishedSha256: 'b'.repeat(64),
    supersedesVersionId: OLD_VERSION_ID,
    supersededByVersionId: null,
    createdAt: '2025-02-03T08:00:00Z',
    ...overrides,
  };
}

export function entry(overrides: Partial<OwnerLedgerEntry> = {}): OwnerLedgerEntry {
  return {
    id: 'e0000000-0000-4000-8000-000000000001',
    ownerId: OWNER_ID,
    propertyId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    type: 'BookingRevenue',
    source: 'Payment',
    sourceId: 'f0000000-0000-4000-8000-000000000001',
    sourceReference: BOOKING_ID.replace(/-/g, ''),
    sourceDocumentId: null,
    attachmentReference: null,
    serviceDate: '2025-01-10',
    recognitionDate: '2025-01-12',
    paymentDate: '2025-01-12',
    year: YEAR,
    month: MONTH,
    ownershipId: null,
    sharePercent: 50,
    originalCurrency: 'EUR',
    sourceAmount: 2000,
    originalAmount: 1000,
    statementCurrency: 'EUR',
    fxRate: 1,
    fxSource: null,
    fxDate: null,
    taxCode: null,
    ruleVersion: 'IT-RULE@2025.1',
    amount: 1000,
    reversesEntryId: null,
    description: null,
    postedAt: '2025-02-01T08:00:00Z',
    ...overrides,
  };
}

export function ownerReadiness(overrides: Partial<OwnerPeriodReadiness> = {}): OwnerPeriodReadiness {
  return { ownerId: OWNER_ID, status: 'Open', isDirty: false, latestVersion: 2, latestStatus: 'Published', issues: [], ready: true, ...overrides };
}

export function readiness(owners: OwnerPeriodReadiness[], issues: OwnerCloseReadiness['issues'] = []): OwnerCloseReadiness {
  return { year: YEAR, month: MONTH, issues, owners };
}

export function payout(overrides: Partial<OwnerPayout> = {}): OwnerPayout {
  return {
    id: '90000000-0000-4000-8000-000000000001',
    ownerId: OWNER_ID,
    statementVersionId: VERSION_ID,
    idempotencyKey: 'key-1',
    reference: 'CRO 123',
    paidOn: '2025-02-05',
    currency: 'EUR',
    grossAmount: 800,
    withholdingAmount: 0,
    netAmount: 800,
    agencyCollected: null,
    qualifyingShortLet: null,
    status: 'Confirmed',
    confirmedAt: '2025-02-05T09:00:00Z',
    reversedAt: null,
    reversalReason: null,
    evidence: [],
    ...overrides,
  };
}

export function f24(overrides: Partial<TaxF24Record> = {}): TaxF24Record {
  return {
    id: 'f2400000-0000-4000-8000-000000000001',
    referenceMonth: MONTH,
    referenceYear: YEAR,
    totalAmount: 120,
    taxCode: 'TC-1',
    dueDate: '2025-02-16T00:00:00Z',
    paidAt: null,
    isOverdue: false,
    createdAt: '2025-02-06T08:00:00Z',
    filingState: 'Generated',
    ruleVersion: 'IT-RULE@2025.1',
    handoffReference: null,
    receiptReference: null,
    rejectionReason: null,
    ...overrides,
  };
}

export function dataset(overrides: Partial<TaxReportingDataset> = {}): TaxReportingDataset {
  return {
    id: 'ca000000-0000-4000-8000-000000000001',
    kind: 'cu',
    year: YEAR,
    totalGrossBase: 800,
    totalWithheld: 120,
    evidenceCount: 1,
    evidenceSha256: 'c'.repeat(64),
    payloadJson: '{"rows":[]}',
    filingState: 'Generated',
    handoffReference: null,
    receiptReference: null,
    rejectionReason: null,
    generatedAt: '2025-02-06T08:00:00Z',
    ...overrides,
  };
}

export function profile(overrides: Partial<OwnerFiscalProfile> = {}): OwnerFiscalProfile {
  return {
    id: 'a1000000-0000-4000-8000-000000000001',
    propertyOwnerId: OWNER_ID,
    validFrom: '2024-01-01',
    validTo: null,
    entityKind: 'NaturalPerson',
    legalName: '•••••••••ossi',
    taxResidenceCountry: 'IT',
    legalAddress: '•••••••••••••••ma 1',
    fiscalCode: '••••••••••••3456',
    vatNumber: null,
    foreignTaxId: null,
    settlementCurrency: 'EUR',
    bankAccountReference: '•••••••••••••••••••••3456',
    mandateRole: 'owner',
    mandateFrom: '2024-01-01',
    mandateTo: null,
    revenueRecognitionRule: 'cash',
    expenseCommissionModel: 'net_of_commission',
    workingCapitalRule: 'none',
    taxJurisdiction: 'IT',
    accountingPolicyId: 'b1000000-0000-4000-8000-000000000001',
    masked: true,
    ...overrides,
  };
}

export function policy(overrides: Partial<OwnerAccountingPolicy> = {}): OwnerAccountingPolicy {
  return {
    id: 'b1000000-0000-4000-8000-000000000001',
    jurisdiction: 'IT',
    ruleCode: 'IT-RULE',
    version: '2025.1',
    validFrom: '2024-01-01',
    validTo: null,
    sourceUrl: 'https://example.org/rule',
    sourceSha256: 'd'.repeat(64),
    parameters: {
      withholdingApplies: false,
      requiresAgencyCollection: true,
      requiresQualifyingShortLet: true,
      grossBaseComponents: [],
      rounding: 'half_up',
      retentionYears: 10,
    },
    approved: true,
    approvedAt: '2024-01-05T10:00:00Z',
    approvedByName: 'Dott. Bianchi',
    ...overrides,
  };
}
