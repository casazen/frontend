import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import * as api from '@/api/fiscal-documents.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { BookingFiscalDocumentCard } from '@/features/bookings/components/booking-fiscal-document-card';
import i18n from '@/i18n/config';
import type { FiscalDocumentEntry } from '@/types';
import { FiscalDocumentsPage } from '../fiscal-documents-page';
import { bookingDocument, document, draft, swissDetail } from './document-fixtures';

const env = vi.hoisted(() => ({ permissions: new Set<string>(), flags: {} as Record<string, boolean> }));

vi.mock('@/api/fiscal-documents.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/fiscal-documents.api')>();
  return {
    ...actual,
    listDocuments: vi.fn(),
    getDocumentsContext: vi.fn(),
    getDocument: vi.fn(),
    listBookingDocuments: vi.fn(),
    createDraft: vi.fn(),
    refreshDraft: vi.fn(),
    issueDocument: vi.fn(),
    createCreditNote: vi.fn(),
    discardDraft: vi.fn(),
    sendDocumentEmail: vi.fn(),
    issueBatch: vi.fn(),
    listDraftsForBatch: vi.fn(),
    downloadPdf: vi.fn(),
    downloadXml: vi.fn(),
    exportList: vi.fn(),
  };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: ReactNode }) => createElement('div', null, createElement('h1', null, title), action),
}));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (_context: string, permission: string) => env.permissions.has(permission) }),
}));
vi.mock('@/hooks/use-feature-flags', () => ({
  useFeatureFlags: () => ({ flags: { ...DEFAULT_FEATURE_FLAGS, ...env.flags }, isLoading: false }),
}));

const READ = ['payment.read', 'property.read', 'booking.read'];
const WRITE = [...READ, 'payment.write'];
const BOOKING_ID = 'b0000000-0000-4000-8000-000000000001';

/** Every button and box that changes a document or starts to (or sends it to a real person): the draft, the issued invoice, its e-mail to the guest, the bulk issue. None of them may be drawn without the right to write payments. */
const CHANGING = [
  'fiscal-document-issue',
  'fiscal-document-refresh',
  'fiscal-document-discard',
  'fiscal-document-credit',
  'fiscal-document-email',
  'fiscal-document-select',
  'fiscal-documents-select-page',
  'fiscal-documents-select-period',
  'fiscal-documents-issue-selected',
  'booking-fiscal-document-create',
  'booking-fiscal-document-issue',
];

const page = (items: FiscalDocumentEntry[]) => ({ items, totalCount: items.length, page: 1, pageSize: 20 });

function renderInProviders(element: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(createElement(MemoryRouter, null, createElement(QueryClientProvider, { client }, element)));
}

function changingButtonsIn(scope: HTMLElement | Document): string[] {
  const root = scope instanceof Document ? scope.body : scope;
  return CHANGING.filter((testId) => within(root).queryAllByTestId(testId).length > 0);
}

beforeEach(async () => {
  vi.resetAllMocks();
  env.permissions = new Set(READ);
  env.flags = { fiscalDocumentIssuance: true };
  await i18n.changeLanguage('it');
  vi.mocked(api.listDocuments).mockResolvedValue(page([draft(), document()]));
  vi.mocked(api.getDocumentsContext).mockResolvedValue({ mode: 'CasaZen', casazenIssuanceEnabled: true, sdiProviderConfigured: true });
  vi.mocked(api.getDocument).mockResolvedValue(swissDetail({ status: 'Draft', number: null, issueDate: null }));
  vi.mocked(api.listBookingDocuments).mockResolvedValue([bookingDocument({ status: 'Draft', number: null, issueDate: null }), bookingDocument({ id: 'd-2' })]);
});

describe('no write action without payment.write (permission rule)', () => {
  it.each([
    ['only the right to read payments', READ, { fiscalDocumentIssuance: true }],
    ['the right to write payments but the issuance of CasaZen off', WRITE, { fiscalDocumentIssuance: false, octorateDocumentImport: true }],
  ])('FiscalDocumentsPage_With%s_DrawsNoButtonNorBoxThatChangesADocument', async (_case, permissions, flags) => {
    env.permissions = new Set(permissions);
    env.flags = flags;
    renderInProviders(createElement(FiscalDocumentsPage));

    const table = await screen.findByRole('table');
    expect(within(table).getAllByTestId('fiscal-document-row')).toHaveLength(2);
    // Reading is not touched: the issued invoice still has its PDF.
    expect(within(table).getByTestId('fiscal-document-pdf')).toBeInTheDocument();
    expect(changingButtonsIn(globalThis.document)).toEqual([]);
  });

  it('FiscalDocumentsPage_TheDetailOfADraftForWhoMayOnlyRead_HasNoButtonThatChangesIt', async () => {
    renderInProviders(createElement(FiscalDocumentsPage));

    const [row] = within(await screen.findByRole('table')).getAllByTestId('fiscal-document-row');
    fireEvent.click(within(row).getByTestId('fiscal-document-open'));

    const drawer = await screen.findByTestId('fiscal-document-drawer');
    expect(await within(drawer).findByTestId('fiscal-document-detail-total')).toBeInTheDocument();
    expect(changingButtonsIn(drawer)).toEqual([]);
  });

  it('FiscalDocumentsPage_WithTheRightToWriteAndTheIssuanceOn_DrawsTheActionsOfEachState', async () => {
    env.permissions = new Set(WRITE);
    renderInProviders(createElement(FiscalDocumentsPage));

    const [draftRow, issuedRow] = within(await screen.findByRole('table')).getAllByTestId('fiscal-document-row');
    for (const testId of ['fiscal-document-issue', 'fiscal-document-refresh', 'fiscal-document-discard', 'fiscal-document-select'])
      expect(within(draftRow).getByTestId(testId), testId).toBeInTheDocument();
    expect(within(draftRow).queryByTestId('fiscal-document-credit')).not.toBeInTheDocument();
    // An issued invoice is credited, never issued again, discarded or made again.
    expect(within(issuedRow).getByTestId('fiscal-document-credit')).toBeInTheDocument();
    for (const testId of ['fiscal-document-issue', 'fiscal-document-refresh', 'fiscal-document-discard', 'fiscal-document-select'])
      expect(within(issuedRow).queryByTestId(testId), testId).not.toBeInTheDocument();
    expect(screen.getByTestId('fiscal-documents-select-period')).toBeInTheDocument();
  });

  it('FiscalDocumentsPage_ADocumentOfTheChannelManager_IsNeverChangedWhateverThePermission', async () => {
    env.permissions = new Set(WRITE);
    vi.mocked(api.listDocuments).mockResolvedValue(page([document({ id: 'd-imported', source: 'Octorate', status: 'Draft', number: null, issueDate: null })]));
    renderInProviders(createElement(FiscalDocumentsPage));

    const [row] = within(await screen.findByRole('table')).getAllByTestId('fiscal-document-row');
    expect(changingButtonsIn(row)).toEqual([]);
  });
});

describe('the e-mail of an issued document to its guest (permission rule: only who may write payments, and only an issued document)', () => {
  const ISSUED_ID = document().id;
  const DRAFT_ID = draft().id;

  /** Opens the confirmation of the e-mail of the issued row. */
  async function openTheEmailOfTheIssuedRow() {
    const [draftRow, issuedRow] = within(await screen.findByRole('table')).getAllByTestId('fiscal-document-row');
    fireEvent.click(within(issuedRow).getByTestId('fiscal-document-email'));
    return { draftRow, dialog: await screen.findByRole('dialog') };
  }

  it('FiscalDocumentsPage_WithTheRightToWrite_OffersTheEmailOnTheIssuedDocumentNotOnTheDraft_AndTheClickSendsNothingBeforeTheConfirmation', async () => {
    env.permissions = new Set(WRITE);
    renderInProviders(createElement(FiscalDocumentsPage));

    const { draftRow, dialog } = await openTheEmailOfTheIssuedRow();

    expect(within(draftRow).queryByTestId('fiscal-document-email')).not.toBeInTheDocument();
    // The e-mail goes to a real guest: the button asks first, it sends nothing.
    expect(within(dialog).getByText('Inviare il documento al cliente?')).toBeInTheDocument();
    expect(api.sendDocumentEmail).not.toHaveBeenCalled();
  });

  it('FiscalDocumentsPage_TheConfirmedEmail_GoesOutForTheIssuedDocumentAndNeverForTheDraft_SaysQueuedNeverDeliveredAndOffersToSendItAgain', async () => {
    env.permissions = new Set(WRITE);
    vi.mocked(api.sendDocumentEmail).mockResolvedValue({ documentId: ISSUED_ID, linkExpiresAt: '2026-12-19T10:00:00Z' });
    renderInProviders(createElement(FiscalDocumentsPage));

    const { dialog } = await openTheEmailOfTheIssuedRow();
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('fiscalDocuments.email.sendConfirm') }));

    await waitFor(() => expect(api.sendDocumentEmail).toHaveBeenCalledTimes(1));
    expect(api.sendDocumentEmail).toHaveBeenCalledWith(ISSUED_ID);
    expect(api.sendDocumentEmail).not.toHaveBeenCalledWith(DRAFT_ID);
    // «In coda» with the last day of the link, and never «consegnata»: the server only queues the e-mail.
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    const told = String(vi.mocked(toast.success).mock.calls[0]?.[0]);
    expect(told).toContain('E-mail in coda');
    expect(told).toMatch(/19 dic/);
    expect(told).not.toMatch(/consegnat/i);
    // The documents are read again, and the row that queued the e-mail says so and offers the same call as «Rinvia e-mail».
    await waitFor(() => expect(vi.mocked(api.listDocuments).mock.calls.length).toBeGreaterThan(1));
    const [, issuedRow] = within(await screen.findByRole('table')).getAllByTestId('fiscal-document-row');
    expect(await within(issuedRow).findByTestId('fiscal-document-email-queued')).toHaveTextContent('E-mail in coda');
    expect(within(issuedRow).getByTestId('fiscal-document-email-queued')).not.toHaveTextContent(/consegnat/i);
    expect(within(issuedRow).getByTestId('fiscal-document-email')).toHaveTextContent('Rinvia e-mail');
  });

  it('FiscalDocumentsPage_ADocumentTheServerRefusesToSend_IsToldInTheDialogNeverAsQueued', async () => {
    env.permissions = new Set(WRITE);
    vi.mocked(api.sendDocumentEmail).mockRejectedValue(new Error('refused'));
    renderInProviders(createElement(FiscalDocumentsPage));

    const { dialog } = await openTheEmailOfTheIssuedRow();
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('fiscalDocuments.email.sendConfirm') }));

    expect(await within(dialog).findByTestId('fiscal-document-email-problem')).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByTestId('fiscal-document-email-queued')).not.toBeInTheDocument();
  });

  it.each([
    ['a draft', draft()],
    ['an invoice the SDI rejected', document({ sdiStatus: 'rejected', sdiErrorCode: '00404' })],
    ['an invoice of an owner', document({ purpose: 'OwnerInvoice' })],
    ['a self-billed invoice', document({ purpose: 'SelfBilling' })],
    ['a document of the channel manager', document({ source: 'Octorate' })],
  ])('FiscalDocumentsPage_%s_HasNoEmailEvenForWhoMayWrite', async (_case, candidate) => {
    env.permissions = new Set(WRITE);
    vi.mocked(api.listDocuments).mockResolvedValue(page([candidate]));
    renderInProviders(createElement(FiscalDocumentsPage));

    const [row] = within(await screen.findByRole('table')).getAllByTestId('fiscal-document-row');
    expect(within(row).queryByTestId('fiscal-document-email')).not.toBeInTheDocument();
  });
});

describe('the card of the booking (permission and flag rule)', () => {
  it('BookingFiscalDocumentCard_ForWhoMayOnlyRead_ShowsTheDocumentsAndNoButtonThatCreatesOrIssues', async () => {
    renderInProviders(createElement(BookingFiscalDocumentCard, { bookingId: BOOKING_ID }));

    const card = await screen.findByTestId('booking-fiscal-document');
    expect(await within(card).findAllByTestId('booking-fiscal-document-row')).toHaveLength(2);
    expect(changingButtonsIn(card)).toEqual([]);
  });

  it('BookingFiscalDocumentCard_ForWhoMayWrite_OffersToIssueTheDraftAndToCreateOneWhenThereIsNone', async () => {
    env.permissions = new Set(WRITE);
    const { unmount } = renderInProviders(createElement(BookingFiscalDocumentCard, { bookingId: BOOKING_ID }));
    expect(await screen.findByTestId('booking-fiscal-document-issue')).toBeInTheDocument();
    unmount();

    vi.mocked(api.listBookingDocuments).mockResolvedValue([]);
    renderInProviders(createElement(BookingFiscalDocumentCard, { bookingId: BOOKING_ID }));
    expect(await screen.findByTestId('booking-fiscal-document-create')).toBeInTheDocument();
  });

  it('BookingFiscalDocumentCard_WhileTheIssuanceIsOff_IsNotThereAndAsksNothing', () => {
    env.permissions = new Set(WRITE);
    env.flags = { fiscalDocumentIssuance: false };
    renderInProviders(createElement(BookingFiscalDocumentCard, { bookingId: BOOKING_ID }));

    expect(screen.queryByTestId('booking-fiscal-document')).not.toBeInTheDocument();
    expect(api.listBookingDocuments).not.toHaveBeenCalled();
  });

  it('BookingFiscalDocumentCard_WithoutTheRightToReadPayments_IsNotThereAndAsksNothing', () => {
    env.permissions = new Set(['booking.read']);
    renderInProviders(createElement(BookingFiscalDocumentCard, { bookingId: BOOKING_ID }));

    expect(screen.queryByTestId('booking-fiscal-document')).not.toBeInTheDocument();
    expect(api.listBookingDocuments).not.toHaveBeenCalled();
  });
});

describe('nothing is written without the right to write', () => {
  it('FiscalDocumentsPage_ForWhoMayOnlyRead_NeverCallsAWriteOfTheApi', async () => {
    renderInProviders(createElement(FiscalDocumentsPage));
    await screen.findByRole('table');

    for (const write of [api.createDraft, api.refreshDraft, api.issueDocument, api.createCreditNote, api.discardDraft, api.sendDocumentEmail, api.issueBatch, api.listDraftsForBatch])
      expect(write).not.toHaveBeenCalled();
  });
});
