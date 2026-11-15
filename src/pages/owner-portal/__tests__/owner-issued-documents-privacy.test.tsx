import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import { ApiClient } from '@/api/client';
import axios from '@/lib/axios';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import i18n from '@/i18n/config';
import { saveBlobAs } from '@/lib/file-download';
import { OWNER_PORTAL_KEY } from '@/queries/ownerPortal';
import { OwnerIssuedDocuments } from '../OwnerIssuedDocuments';

const env = vi.hoisted(() => ({ flags: {} as Record<string, boolean> }));

vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn() } }));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
vi.mock('@/lib/file-download', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/file-download')>();
  return { ...actual, saveBlobAs: vi.fn() };
});
vi.mock('@/hooks/use-feature-flags', () => ({
  useFeatureFlags: () => ({ flags: { ...DEFAULT_FEATURE_FLAGS, ...env.flags }, isLoading: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

vi.setConfig({ testTimeout: 30_000 });

const list = vi.mocked(ApiClient.get);
const getFile = vi.mocked(axios.get);

/** What the server sends for a document issued in the name of the owner: and, in these tests, MORE than it should (the data of a guest), to prove that none of it is ever shown or kept. */
const ROW = {
  documentId: 'f0000000-0000-4000-8000-000000000001',
  agencyId: 'a0000000-0000-4000-8000-000000000009',
  agencyName: 'Lago Immobiliare',
  number: 'RIC-2026/14',
  issueDate: '2026-10-31',
  kind: 'Receipt',
  total: 640.5,
  currency: 'EUR',
  sdiStatus: 'not_applicable',
  hasXml: false,
  // Not part of the contract: a server that sent them by mistake must not make them appear.
  guestName: 'Giulia Verdi',
  guestEmail: 'giulia.verdi@example.com',
  guestPhone: '+39 333 000 1122',
  recipientName: 'Giulia Verdi',
  bookingId: 'b0000000-0000-4000-8000-000000000042',
};

const INVOICE = { ...ROW, documentId: 'f0000000-0000-4000-8000-000000000002', number: 'FT-2026/3', kind: 'Invoice', sdiStatus: 'delivered', hasXml: true };

function refusal(status: number, code: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('refused', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data: { status, code } });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(OwnerIssuedDocuments))));
  return { ...view, client };
}

beforeEach(async () => {
  vi.resetAllMocks();
  env.flags = { fiscalDocumentIssuance: true, agencyTier: true };
  await i18n.changeLanguage('it');
  list.mockResolvedValue([ROW, INVOICE]);
});

afterEach(() => cleanup());

describe('the documents issued in the name of the owner show nothing of a guest (E17/F03/US01/T03, NF-116)', () => {
  it('OwnerIssuedDocuments_ARowThatCarriesTheDataOfAGuest_NeverShowsItAndNeverKeepsIt', async () => {
    const { container, client } = renderPage();

    const cards = await screen.findAllByTestId('owner-issued-document');
    expect(cards).toHaveLength(2);
    const text = container.textContent ?? '';
    for (const secret of ['Giulia', 'Verdi', 'giulia.verdi@example.com', '333 000 1122']) expect(text).not.toContain(secret);
    // The number, the kind, the total and the state are what the page shows.
    expect(within(cards[0]).getByRole('heading')).toHaveTextContent('RIC-2026/14');
    // Nothing of the guest reached the cache of the queries either: only the members of the contract are kept.
    const kept = client.getQueryData<Record<string, unknown>[]>([OWNER_PORTAL_KEY, 'issued-documents', null]);
    expect(kept).toBeDefined();
    for (const row of kept ?? []) {
      expect(Object.keys(row).sort()).toEqual(['agencyId', 'agencyName', 'currency', 'documentId', 'hasXml', 'issueDate', 'kind', 'number', 'sdiStatus', 'total']);
    }
  });

  it('OwnerIssuedDocuments_TheFilesAreSavedUnderTheNumberOfTheDocumentAndNeverUnderANameOfAPerson', async () => {
    getFile.mockResolvedValue({ data: new Blob(['%PDF'], { type: 'application/pdf' }) });
    renderPage();

    const [receipt] = await screen.findAllByTestId('owner-issued-document');
    fireEvent.click(within(receipt).getByTestId('owner-issued-pdf'));

    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledTimes(1));
    const name = vi.mocked(saveBlobAs).mock.calls[0][1];
    expect(name).toBe('documento-RIC-2026-14.pdf');
    for (const secret of ['Giulia', 'Verdi', 'Lago', 'example.com']) expect(name).not.toContain(secret);
    // The file is asked of the owner's own endpoint: the document id and the language, never the id of an owner (the server takes it from the claim) or a name.
    expect(getFile.mock.calls[0][0]).toBe('/owner-portal/issued-documents/f0000000-0000-4000-8000-000000000001/pdf?lang=it');
  });

  it('OwnerIssuedDocuments_TheExportForTheAccountant_AsksOnlyForThePeriodOfTheOwnersOwnEndpoint', async () => {
    getFile.mockResolvedValue({ data: new Blob(['PK'], { type: 'application/zip' }), headers: { 'content-disposition': 'attachment; filename="casazen-documenti-emessi-2026-10.zip"' } });
    renderPage();

    fireEvent.click(await screen.findByTestId('owner-issued-export-download'));

    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledTimes(1));
    const [url, config] = getFile.mock.calls[0] as [string, { params: Record<string, string> }];
    expect(url).toBe('/owner-portal/issued-documents/export');
    // A month or a year and nothing else: no owner, no name and no email in the request.
    expect(Object.keys(config.params)).toEqual(['period']);
    expect(config.params.period).toMatch(/^\d{4}(-\d{2})?$/);
    expect(vi.mocked(saveBlobAs).mock.calls[0][1]).toBe('casazen-documenti-emessi-2026-10.zip');
  });

  it('OwnerIssuedDocuments_WhenTheOwnerDidNotGiveThePermission_SaysSoAndShowsNoList', async () => {
    list.mockRejectedValue(refusal(403, 'owner_portal_permission_missing'));
    renderPage();

    expect(await screen.findByTestId('owner-issued-error')).toHaveAttribute('data-state', 'permission');
    expect(screen.queryByTestId('owner-issued-list')).toBeNull();
    expect(screen.queryByTestId('owner-issued-empty')).toBeNull();
  });

  it('OwnerIssuedDocuments_WhileTheFlagsAreOff_AsksNothingAndSaysThePartIsNotOpen', async () => {
    env.flags = {};
    renderPage();

    expect(await screen.findByTestId('owner-issued-not-open')).toHaveAttribute('data-state', 'unavailable');
    expect(list).not.toHaveBeenCalled();
  });
});
