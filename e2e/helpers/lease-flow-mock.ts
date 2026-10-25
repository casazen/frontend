import type { Page, Route } from '@playwright/test';
import type {
  LeaseDetail,
  LeaseSigningState,
  RentInstallment,
  RentLedger,
} from '../../src/types';
import { buildCreatedProperty } from '../fixtures/properties.fixtures';
import { mockPropertiesApi } from './properties-api-mock';

export const FLOW_LEASE_ID = 'lease-e2e-flow-0001';
export const FLOW_PROPERTY = buildCreatedProperty({ id: 'prop-lease-e2e-01', name: 'Appartamento Seveso', city: 'Seveso' });

/** What the mocked API received, so a spec asserts the request the UI really sent (not only what it shows). */
export interface LeaseFlowCalls {
  contractDownloads: number;
  receiptDownloads: number;
  signedUploads: { stipulaDate: string | null; hasPdf: boolean }[];
  manualRegistrations: { registrationCode: string | null; registrationDate: string | null; hasReceipt: boolean }[];
  rentSchedules: unknown[];
  markPaid: { installmentId: string; paidOn: string | null }[];
}

function json(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function problem(route: Route, status: number, code: string): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/problem+json',
    body: JSON.stringify({ status, code, title: code }),
  });
}

function multipartField(body: string, name: string): string | null {
  const match = new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)\\r\\n`).exec(body);
  return match ? match[1] : null;
}

function buildInstallments(monthlyRent: number): RentInstallment[] {
  const rows: RentInstallment[] = [];
  for (let i = 0; i < 48; i += 1) {
    const start = new Date(Date.UTC(2026, 8 + i, 1));
    const end = new Date(Date.UTC(2026, 9 + i, 0));
    const due = new Date(Date.UTC(2026, 8 + i, 5));
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    rows.push({
      id: `inst-${String(i + 1).padStart(2, '0')}`,
      periodStart: iso(start),
      periodEnd: iso(end),
      dueDate: iso(due),
      amount: monthlyRent,
      currency: 'EUR',
      status: 'Scheduled',
      isOverdue: false,
      paidVia: null,
      paidOn: null,
      offlinePaymentNote: null,
      paymentRequestedAt: null,
      failureCode: null,
      lastFailedAt: null,
    });
  }
  return rows;
}

/**
 * A draft lease as the guided draft leaves it (LR-06a): two landlords and two tenants, a libero at 1.200 €, already saved on the
 * server. The wizard that fills it in is its own spec; the flow below starts from the sheet of the lease.
 */
function flowDraftLease(): LeaseDetail {
  const party = (index: number, role: 'Landlord' | 'Tenant', firstName: string, lastName: string, masked: string) => ({
    id: `party-${index}`,
    role,
    firstName,
    lastName,
    fiscalCodeMasked: masked,
    contactEmailMasked: 'm***@example.com',
    isExtraEU: false,
  });
  return {
    id: FLOW_LEASE_ID,
    propertyId: FLOW_PROPERTY.id,
    property: { id: FLOW_PROPERTY.id, name: FLOW_PROPERTY.name, city: FLOW_PROPERTY.city },
    status: 'Draft',
    fiscalRegime: 'CedolareSecca',
    contractType: 'Libero',
    taxRegime: 'CedolareSecca',
    startDate: '2026-09-01',
    endDate: '2030-08-31',
    monthlyRent: 1200,
    securityDeposit: null,
    concordatoAssessment: null,
    stipulaDate: null,
    registrationDeadline: '2026-10-01',
    hasSignedPdf: false,
    hasExtraEUTenant: false,
    parties: [
      party(1, 'Landlord', 'Mario', 'Rossi', 'RSS***********1U'),
      party(2, 'Landlord', 'Anna', 'Bianchi', 'BNC***********5W'),
      party(3, 'Tenant', 'Giulia', 'Verdi', 'VRD***********5A'),
      party(4, 'Tenant', 'Acme', 'Srl', '001***********82'),
    ],
    registration: null,
    events: [{ eventType: 'Created', occurredAt: '2026-09-25T08:00:00Z' }],
    createdAt: '2026-09-25T08:00:00Z',
    updatedAt: '2026-09-25T08:00:00Z',
  };
}

/**
 * Stateful in-memory API of the lease flow with the providers as production has them (e-signature and RLI filing off):
 * a draft lease -> contract to sign -> signed upload -> manual RLI -> rent schedule. Every step changes the state the next GET
 * returns, so a UI that shows success without calling the API fails the spec. The mock answers what the real API
 * answers (the 422 for a rent schedule of an unsigned lease, the signers and the checklist), not a canned success.
 */
export async function mockLeaseFlowApi(page: Page): Promise<LeaseFlowCalls> {
  const calls: LeaseFlowCalls = {
    contractDownloads: 0,
    receiptDownloads: 0,
    signedUploads: [],
    manualRegistrations: [],
    rentSchedules: [],
    markPaid: [],
  };
  let lease: LeaseDetail | null = flowDraftLease();
  let schedule: RentLedger['schedule'] = null;
  let installments: RentInstallment[] = [];

  await mockPropertiesApi(page, [FLOW_PROPERTY]);
  await page.route(`**/api/properties/${FLOW_PROPERTY.id}/documents`, (route) =>
    json(route, [
      {
        id: 'doc-ape',
        fileName: 'ape.pdf',
        fileType: 'application/pdf',
        documentType: 'Ape',
        uploadedAt: '2026-08-01T10:00:00Z',
        downloadUrl: '/documents/doc-ape',
        // LT-10: the code and the class the contract states; the form waits for them before the draft.
        apeCode: '1610800012345/17',
        apeEnergyClass: 'C',
      },
    ]),
  );

  const ledger = (): RentLedger => ({
    leaseId: FLOW_LEASE_ID,
    monthlyRent: lease?.monthlyRent ?? 0,
    canConfigure: lease?.status === 'Signed' || lease?.status === 'Registered',
    onlinePaymentsAvailable: false,
    hasTenantEmail: true,
    schedule,
    installments,
    partialFinalPeriod: null,
  });

  const signing = (): LeaseSigningState => {
    const signed = !!lease && lease.status !== 'Draft';
    return {
      providerSigningAvailable: false,
      contractAvailable: !signed,
      contractUnavailableCode: signed ? 'lease_already_signed' : null,
      signers: (lease?.parties ?? []).map((party) => ({
        partyId: party.id,
        role: party.role,
        firstName: party.firstName,
        lastName: party.lastName,
        method: 'Offline',
        status: signed ? 'Signed' : 'Pending',
        signingUrl: null,
        signingUrlExpiresAt: null,
        signingUrlExpired: false,
        signedAt: signed ? (lease?.stipulaDate ?? null) : null,
      })),
    };
  };

  await page.route(/\/api\/leases(\/.*)?(\?.*)?$/, async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname.replace(/^.*\/api/, '');

    if (path === '/leases' && method === 'GET') {
      return json(route, lease ? [{ ...lease, partyCount: lease.parties.length }] : []);
    }

    if (!lease || !path.startsWith(`/leases/${FLOW_LEASE_ID}`)) {
      return problem(route, 404, 'lease_not_found');
    }
    const sub = path.slice(`/leases/${FLOW_LEASE_ID}`.length);

    if (sub === '' && method === 'GET') return json(route, lease);
    if (sub === '/signers' && method === 'GET') return json(route, signing());
    if (sub === '/registration/receipt' && method === 'GET' && lease.registration?.hasReceipt) {
      calls.receiptDownloads += 1;
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4\n%ricevuta\n%%EOF\n' });
    }
    if (sub === '/contract.pdf' && method === 'GET') {
      calls.contractDownloads += 1;
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4\n%contratto\n%%EOF\n' });
    }
    if (sub === '/signed-document' && method === 'POST') {
      const body = request.postData() ?? '';
      calls.signedUploads.push({
        stipulaDate: multipartField(body, 'stipulaDate'),
        hasPdf: body.includes('filename="') && body.includes('%PDF-'),
      });
      lease = {
        ...lease,
        status: 'Signed',
        stipulaDate: multipartField(body, 'stipulaDate'),
        registrationDeadline: '2026-09-19',
        hasSignedPdf: true,
        events: [...lease.events, { eventType: 'AllPartiesSigned', occurredAt: '2026-09-25T09:00:00Z' }],
      };
      return json(route, lease);
    }
    if (sub === '/registration/manual' && method === 'POST') {
      const body = request.postData() ?? '';
      const registrationCode = multipartField(body, 'registrationCode');
      const registrationDate = multipartField(body, 'registrationDate');
      calls.manualRegistrations.push({ registrationCode, registrationDate, hasReceipt: body.includes('name="receipt"') });
      lease = {
        ...lease,
        status: 'Registered',
        registration: {
          status: 'Registered',
          channel: 'Manual',
          registrationCode,
          registrationDate,
          confirmedAt: '2026-09-25T10:00:00Z',
          hasReceipt: true,
        },
        events: [...lease.events, { eventType: 'RegistrationConfirmed', occurredAt: '2026-09-25T10:00:00Z' }],
      };
      return json(route, lease.registration);
    }
    if (sub === '/rli/checklist' && method === 'GET') {
      return json(route, {
        registrationDeadline: lease.registrationDeadline,
        daysRemaining: null,
        tosVersion: 'test',
        attestationText: '',
        providerFilingAvailable: false,
        items: [],
        questura: null,
      });
    }
    if (sub === '/rent' && method === 'GET') return json(route, ledger());
    if (sub === '/rent/schedule' && method === 'PUT') {
      if (!ledger().canConfigure) return problem(route, 422, 'rent_lease_not_signed');
      const input = request.postDataJSON() as { cadence: 'Monthly'; billingDayOfMonth?: number };
      calls.rentSchedules.push(input);
      schedule = {
        cadence: input.cadence,
        billingDayOfMonth: input.billingDayOfMonth ?? 1,
        amount: lease.monthlyRent,
        currency: 'EUR',
        isActive: true,
      };
      installments = buildInstallments(lease.monthlyRent);
      return json(route, ledger());
    }
    const paid = /^\/rent\/installments\/([^/]+)\/mark-paid$/.exec(sub);
    if (paid && method === 'POST') {
      const body = request.postDataJSON() as { paidOn: string };
      calls.markPaid.push({ installmentId: paid[1], paidOn: body.paidOn });
      installments = installments.map((row) =>
        row.id === paid[1] ? { ...row, status: 'Paid', paidVia: 'Offline', paidOn: body.paidOn } : row,
      );
      return json(route, installments.find((row) => row.id === paid[1]));
    }
    // Panels the flow does not exercise (cedolare advisory, Questura): the real API's answer when there is nothing.
    return problem(route, 404, 'not_found');
  });

  return calls;
}
