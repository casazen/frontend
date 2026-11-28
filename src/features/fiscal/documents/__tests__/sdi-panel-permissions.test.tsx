import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@/api/fiscal-documents.api';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/config/feature-flags';
import i18n from '@/i18n/config';
import type { FiscalDocumentSdiState } from '@/types';
import { DocumentSdiPanel, type SdiPanelDocument } from '../document-sdi-panel';
import { document, importedDocument } from './document-fixtures';

const env = vi.hoisted(() => ({ contexts: [] as { contextKey: string; roleKey: string }[] }));

vi.mock('@/api/fiscal-documents.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/fiscal-documents.api')>();
  return { ...actual, getDocumentSdi: vi.fn(), submitDocumentSdi: vi.fn(), declareDocumentSdi: vi.fn() };
});
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: env.contexts }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

vi.setConfig({ testTimeout: 30_000 });

const sdiOn: Partial<FeatureFlags> = { ...DEFAULT_FEATURE_FLAGS, sdiSubmission: true, fiscalDocumentIssuance: true };

const state = (overrides: Partial<FiscalDocumentSdiState> = {}): FiscalDocumentSdiState => ({
  documentId: 'd0000000-0000-4000-8000-000000000001',
  status: 'to_send',
  errorCode: null,
  reason: null,
  statusUpdatedAt: null,
  providerConfigured: true,
  canSubmit: true,
  canDeclare: true,
  canCorrect: false,
  ...overrides,
});

function renderPanel(subject: SdiPanelDocument, options: { flags?: Partial<FeatureFlags>; canWrite?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(DocumentSdiPanel, { document: subject, flags: options.flags ?? sdiOn, canWrite: options.canWrite ?? true, onCorrect: vi.fn() }),
    ),
  );
}

const read = vi.mocked(api.getDocumentSdi);

beforeEach(async () => {
  vi.resetAllMocks();
  env.contexts = [{ contextKey: 'short-rent', roleKey: 'property_manager' }];
  await i18n.changeLanguage('it');
  read.mockResolvedValue(state());
});

afterEach(() => cleanup());

describe('the SDI panel of a document follows the flag and the permissions (E17/F03/US01/T02, NF-116)', () => {
  it('SdiPanel_WhileTheSendingIsOff_DrawsNothingAndAsksNothing', async () => {
    const { container } = renderPanel(document(), { flags: { ...sdiOn, sdiSubmission: false } });

    expect(container).toBeEmptyDOMElement();
    expect(read).not.toHaveBeenCalled();
  });

  it('SdiPanel_ForADocumentOfTheChannelManager_IsNeverDrawn', async () => {
    const { container } = renderPanel(importedDocument());

    expect(container).toBeEmptyDOMElement();
    expect(read).not.toHaveBeenCalled();
  });

  it('SdiPanel_ForWhoMayNotWritePayments_ShowsTheStateAndNoButtonThatChangesIt', async () => {
    read.mockResolvedValue(state({ canCorrect: true, status: 'rejected', errorCode: '00404', reason: 'Il codice fiscale del destinatario non è valido.', canSubmit: false, canDeclare: false }));
    renderPanel(document({ sdiStatus: 'rejected', sdiErrorCode: '00404' }), { canWrite: false });

    const panel = await screen.findByTestId('fiscal-document-sdi');
    expect(await within(panel).findByTestId('fiscal-document-sdi-state')).toHaveAttribute('data-state', 'rejected');
    expect(within(panel).getByTestId('fiscal-document-sdi-reason')).toHaveTextContent('Il codice fiscale del destinatario non è valido.');
    for (const id of ['fiscal-document-sdi-submit', 'fiscal-document-sdi-declare', 'fiscal-document-sdi-correct']) expect(within(panel).queryByTestId(id)).toBeNull();
    expect(api.submitDocumentSdi).not.toHaveBeenCalled();
    expect(api.declareDocumentSdi).not.toHaveBeenCalled();
  });

  it('SdiPanel_ForWhoMayWrite_OffersOnlyWhatTheServerSaysCanBeDone', async () => {
    read.mockResolvedValue(state({ canSubmit: true, canDeclare: true, canCorrect: false }));
    renderPanel(document());

    const panel = await screen.findByTestId('fiscal-document-sdi');
    expect(await within(panel).findByTestId('fiscal-document-sdi-submit')).toBeEnabled();
    expect(within(panel).getByTestId('fiscal-document-sdi-declare')).toBeEnabled();
    expect(within(panel).queryByTestId('fiscal-document-sdi-correct')).toBeNull();
  });

  it('SdiPanel_ADeliveredInvoice_OffersNoActionAndSaysItIsCorrectedWithACreditNote', async () => {
    read.mockResolvedValue(state({ status: 'delivered', canSubmit: false, canDeclare: false, canCorrect: false }));
    renderPanel(document({ sdiStatus: 'delivered' }));

    const panel = await screen.findByTestId('fiscal-document-sdi');
    await waitFor(() => expect(within(panel).getByTestId('fiscal-document-sdi-state')).toHaveAttribute('data-state', 'delivered'));
    expect(within(panel).queryByTestId('fiscal-document-sdi-actions')?.children.length ?? 0).toBe(0);
    expect(within(panel).getByTestId('fiscal-document-sdi-hints')).toHaveTextContent(i18n.t('fiscalDocuments.sdi.hint.delivered'));
  });

  it('SdiPanel_AnOwnerInvoice_GoesThroughTheEndpointsOfTheOwnerInvoicesAndOnlyForTheAdministrators', async () => {
    const ownerInvoice = document({ purpose: 'OwnerInvoice', bookingId: null });
    const refused = renderPanel(ownerInvoice, { flags: { ...sdiOn, ownerInvoicing: true } });
    expect(refused.container).toBeEmptyDOMElement();
    expect(read).not.toHaveBeenCalled();
    cleanup();

    env.contexts = [{ contextKey: 'account', roleKey: 'org_admin' }];
    renderPanel(ownerInvoice, { flags: { ...sdiOn, ownerInvoicing: true }, canWrite: false });
    await screen.findByTestId('fiscal-document-sdi');
    await waitFor(() => expect(read).toHaveBeenCalledWith(ownerInvoice.id, 'owner'));
    cleanup();
    read.mockClear();
    const off = renderPanel(ownerInvoice, { flags: { ...sdiOn, ownerInvoicing: false } });
    expect(off.container).toBeEmptyDOMElement();
    expect(read).not.toHaveBeenCalled();
  });

  it('SdiPanel_ASelfBilledInvoice_GoesThroughTheFiscalDocumentsAndNeverOffersTheGuidedCorrection', async () => {
    read.mockResolvedValue(state({ status: 'rejected', errorCode: '00305', reason: 'La partita IVA non è valida.', canSubmit: false, canDeclare: false, canCorrect: true }));
    const selfBilled = document({ purpose: 'SelfBilling', bookingId: null, sdiStatus: 'rejected', sdiErrorCode: '00305' });
    renderPanel(selfBilled);

    const panel = await screen.findByTestId('fiscal-document-sdi');
    expect(await within(panel).findByTestId('fiscal-document-sdi-reason')).toBeInTheDocument();
    expect(read).toHaveBeenCalledWith(selfBilled.id, 'guest');
    expect(within(panel).queryByTestId('fiscal-document-sdi-correct')).toBeNull();
  });
});
