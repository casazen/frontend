import { createElement, type ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import type { LeaseDetail, LeaseSummary } from '@/types';

/** Axios error as the HTTP client rejects it: with a response (`status`) or without (network). */
export function httpError(status?: number, data: object = {}): AxiosError {
  const config = { headers: new AxiosHeaders() };
  if (status === undefined) {
    return new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, null);
  }
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { status, ...data },
  });
}

/** What a dev server or a SPA rewrite answers for an unmatched `/api/*` path. */
export const HTML_FALLBACK = '<!doctype html><html lang="en"><head></head><body><div id="root"></div></body></html>';

export function renderAt(path: string, routePath: string, page: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [path] },
        createElement(Routes, null, createElement(Route, { path: routePath, element: page })),
      ),
    ),
  );
}

export function buildSummary(overrides: Partial<LeaseSummary> = {}): LeaseSummary {
  return {
    id: 'lease-1',
    propertyId: 'property-1234567890',
    property: { id: 'property-1234567890', name: 'Casa Trastevere', city: 'Roma' },
    status: 'SentToProvider',
    fiscalRegime: 'CedolareSecca',
    startDate: '2026-10-01T00:00:00Z',
    endDate: '2030-09-30T00:00:00Z',
    monthlyRent: 950,
    registrationDeadline: '2026-10-31T00:00:00Z',
    partyCount: 2,
    hasExtraEUTenant: false,
    createdAt: '2026-09-20T08:00:00Z',
    updatedAt: '2026-09-21T08:00:00Z',
    ...overrides,
  };
}

export function buildDetail(overrides: Partial<LeaseDetail> = {}): LeaseDetail {
  return {
    id: 'lease-1',
    propertyId: 'property-1',
    property: { id: 'property-1', name: 'Casa Trastevere', city: 'Roma' },
    status: 'Draft',
    fiscalRegime: 'CedolareSecca',
    startDate: '2026-10-01T00:00:00Z',
    endDate: '2030-09-30T00:00:00Z',
    monthlyRent: 950,
    registrationDeadline: '2026-10-31T00:00:00Z',
    hasSignedPdf: false,
    hasExtraEUTenant: false,
    parties: [
      {
        id: 'party-landlord',
        role: 'Landlord',
        firstName: 'Mario',
        lastName: 'Rossi',
        fiscalCodeMasked: '************501Z',
        contactEmailMasked: 'm***@example.com',
        isExtraEU: false,
      },
      {
        id: 'party-tenant',
        role: 'Tenant',
        firstName: 'Giulia',
        lastName: 'Verdi',
        fiscalCodeMasked: '************205X',
        contactEmailMasked: 'g***@example.com',
        isExtraEU: false,
      },
    ],
    registration: null,
    events: [
      { eventType: 'Created', occurredAt: '2026-09-20T08:00:00Z' },
      { eventType: 'RegistrationAuthorized', occurredAt: '2026-09-21T08:00:00Z' },
    ],
    createdAt: '2026-09-20T08:00:00Z',
    updatedAt: '2026-09-21T08:00:00Z',
    ...overrides,
  };
}
