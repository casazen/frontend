import type { Page, Route } from '@playwright/test';
import type {
  CreateLeaseDto,
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
  created: CreateLeaseDto[];
  contractDownloads: number;
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
 * Stateful in-memory API of the lease flow with the providers as production has them (e-signature and RLI filing off):
 * create -> contract to sign -> signed upload -> manual RLI -> rent schedule. Every step changes the state the next GET
 * returns, so a UI that shows success without calling the API fails the spec. The mock answers what the real API
 * answers (the 422 for a rent schedule of an unsigned lease, the signers and the checklist), not a canned success.
 */
export async function mockLeaseFlowApi(page: Page): Promise<LeaseFlowCalls> {
  const calls: LeaseFlowCalls = {
    created: [],
    contractDownloads: 0,
    signedUploads: [],
    manualRegistrations: [],
    rentSchedules: [],
    markPaid: [],
  };
  let lease: LeaseDetail | null = null;
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

    if (path === '/leases' && method === 'POST') {
      const dto = request.postDataJSON() as CreateLeaseDto;
      calls.created.push(dto);
      lease = {
        id: FLOW_LEASE_ID,
        propertyId: dto.propertyId,
        property: { id: FLOW_PROPERTY.id, name: FLOW_PROPERTY.name, city: FLOW_PROPERTY.city },
        status: 'Draft',
        fiscalRegime: dto.taxRegime === 'CedolareSecca' ? 'CedolareSecca' : 'RegimeOrdinario',
        contractType: dto.contractType,
        taxRegime: dto.taxRegime,
        startDate: dto.startDate,
        endDate: dto.endDate,
        monthlyRent: dto.monthlyRent,
        securityDeposit: dto.securityDeposit ?? null,
        concordatoAssessment: null,
        stipulaDate: null,
        registrationDeadline: '2026-10-01',
        hasSignedPdf: false,
        hasExtraEUTenant: false,
        parties: dto.parties.map((party, index) => ({
          id: `party-${index + 1}`,
          role: party.role,
          firstName: party.firstName,
          lastName: party.lastName,
          fiscalCodeMasked: `${party.fiscalCode.slice(0, 3)}***********${party.fiscalCode.slice(-2)}`,
          contactEmailMasked: 'm***@example.com',
          isExtraEU: false,
        })),
        registration: null,
        events: [{ eventType: 'Created', occurredAt: '2026-09-25T08:00:00Z' }],
        createdAt: '2026-09-25T08:00:00Z',
        updatedAt: '2026-09-25T08:00:00Z',
      };
      return json(route, lease, 201);
    }

    if (!lease || !path.startsWith(`/leases/${FLOW_LEASE_ID}`)) {
      return problem(route, 404, 'lease_not_found');
    }
    const sub = path.slice(`/leases/${FLOW_LEASE_ID}`.length);

    if (sub === '' && method === 'GET') return json(route, lease);
    if (sub === '/signers' && method === 'GET') return json(route, signing());
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
