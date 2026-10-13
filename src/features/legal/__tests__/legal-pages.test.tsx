import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { LegalDocumentMeta, SubprocessorsDocument } from '@/types/onboarding.types';
import { LegalDocumentPage } from '../legal-document-page';
import { SubprocessorsPage } from '../subprocessors-page';
import { LegalIndexPage } from '../legal-index-page';

/** PL-14 (A1-06, A9-40): public legal pages with version and date, no invented text, truthful subprocessors. */
const state = vi.hoisted(() => ({
  document: {} as { data?: LegalDocumentMeta; isLoading: boolean; isError: boolean },
  subprocessors: {} as { data?: SubprocessorsDocument; isLoading: boolean; isError: boolean },
  refetch: vi.fn(),
  language: 'it',
}));

vi.mock('@/queries/use-legal', () => ({
  useLegalLanguage: () => state.language,
  useLegalDocument: () => ({ ...state.document, isFetching: false, refetch: state.refetch }),
  useSubprocessors: () => ({ ...state.subprocessors, isFetching: false, refetch: state.refetch }),
}));

const baseDocument: LegalDocumentMeta = {
  key: 'tos',
  version: '2026-10-v1',
  effectiveAt: '2026-10-15T00:00:00Z',
  title: 'Termini di Servizio',
  summary: 'x',
  documentUrl: null,
  available: false,
  contentHtml: null,
  contentLanguage: null,
};

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

beforeEach(async () => {
  state.language = 'it';
  state.refetch.mockReset();
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('LegalDocumentPage', () => {
  it('LegalDocumentPage_TextNotProvided_ShowsVersionDateAndInPreparation', () => {
    state.document = { data: baseDocument, isLoading: false, isError: false };

    renderWithRouter(<LegalDocumentPage documentKey="tos" />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(i18n.t('legal.documents.tos.title'));
    const version = screen.getByTestId('legal-document-version');
    expect(version).toHaveTextContent('2026-10-v1');
    expect(version).toHaveTextContent('15 ottobre 2026');
    expect(screen.getByTestId('legal-document-in-preparation')).toHaveTextContent(i18n.t('legal.inPreparation'));
    expect(screen.queryByTestId('legal-document-body')).not.toBeInTheDocument();
  });

  it('LegalDocumentPage_EffectiveDateNotConfigured_SaysSoInsteadOfInventingOne', () => {
    state.document = { data: { ...baseDocument, effectiveAt: null }, isLoading: false, isError: false };

    renderWithRouter(<LegalDocumentPage documentKey="tos" />);

    expect(screen.getByTestId('legal-document-version')).toHaveTextContent(i18n.t('legal.effectiveAtPending'));
  });

  it('LegalDocumentPage_TextProvided_RendersSanitizedText', () => {
    state.document = {
      data: {
        ...baseDocument,
        available: true,
        contentHtml: '<h2>Art. 1</h2><p>Oggetto</p><img src=x onerror=alert(1)><script>alert(1)</script>',
        contentLanguage: 'it',
      },
      isLoading: false,
      isError: false,
    };

    renderWithRouter(<LegalDocumentPage documentKey="tos" />);

    const body = screen.getByTestId('legal-document-body');
    expect(body.querySelector('h2')).toHaveTextContent('Art. 1');
    expect(body.querySelector('img, script')).toBeNull();
    expect(screen.queryByTestId('legal-document-in-preparation')).not.toBeInTheDocument();
    expect(screen.queryByTestId('legal-document-translation-notice')).not.toBeInTheDocument();
  });

  it('LegalDocumentPage_EnglishUiWithItalianOnlyText_ShowsTheLanguageNotice', async () => {
    await i18n.changeLanguage('en');
    state.language = 'en';
    state.document = {
      data: { ...baseDocument, available: true, contentHtml: '<p>Testo</p>', contentLanguage: 'it' },
      isLoading: false,
      isError: false,
    };

    renderWithRouter(<LegalDocumentPage documentKey="tos" />);

    expect(screen.getByTestId('legal-document-translation-notice')).toHaveTextContent(i18n.t('legal.onlyItalian'));
  });

  it('LegalDocumentPage_ExternalCopyOnly_LinksItAndIsNotInPreparation', () => {
    state.document = {
      data: { ...baseDocument, available: true, documentUrl: 'https://legal.example.test/tos.pdf' },
      isLoading: false,
      isError: false,
    };

    renderWithRouter(<LegalDocumentPage documentKey="tos" />);

    expect(screen.getByTestId('legal-document-external')).toHaveAttribute('href', 'https://legal.example.test/tos.pdf');
    expect(screen.queryByTestId('legal-document-in-preparation')).not.toBeInTheDocument();
  });

  it('LegalDocumentPage_ApiError_ShowsErrorWithRetryNotAnEmptyPage', () => {
    state.document = { data: undefined, isLoading: false, isError: true };

    renderWithRouter(<LegalDocumentPage documentKey="privacy" />);

    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('legal.loadError'));
    expect(screen.queryByTestId('legal-document-in-preparation')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('legal.retry') }));
    expect(state.refetch).toHaveBeenCalledTimes(1);
  });

  it('LegalDocumentPage_Loading_ShowsTheLoader', () => {
    state.document = { data: undefined, isLoading: true, isError: false };

    renderWithRouter(<LegalDocumentPage documentKey="dpa" />);

    expect(screen.getByTestId('legal-document-loading')).toBeInTheDocument();
  });
});

describe('SubprocessorsPage', () => {
  it('SubprocessorsPage_ListFromBackend_ShowsLocalizedPurposesAndPendingDetails', () => {
    state.subprocessors = {
      data: {
        version: '2026-10-v1+ai-deepseek',
        effectiveAt: null,
        items: [
          {
            key: 'auth0',
            name: 'Auth0',
            purpose: 'Authentication',
            purposeKey: 'authentication',
            region: 'US',
            website: 'https://auth0.com',
            entity: null,
            transferMechanism: null,
            detailsPending: true,
          },
          {
            key: 'resend',
            name: 'Resend',
            purpose: 'Transactional email',
            purposeKey: 'email',
            region: 'Region set by the PO',
            entity: 'Entity set by the PO',
            transferMechanism: 'Mechanism set by the PO',
            detailsPending: false,
          },
          {
            key: 'ai',
            name: 'DeepSeek',
            purpose: 'SEO content',
            purposeKey: null,
            region: '',
            detailsPending: true,
          },
        ],
      },
      isLoading: false,
      isError: false,
    };

    renderWithRouter(<SubprocessorsPage />);

    expect(screen.getByTestId('subprocessors-version')).toHaveTextContent('2026-10-v1+ai-deepseek');
    const auth0 = screen.getByTestId('subprocessor-row-auth0');
    expect(auth0).toHaveTextContent(i18n.t('legal.subprocessors.purposes.authentication'));
    expect(auth0).toHaveTextContent('US');
    expect(auth0).toHaveTextContent(i18n.t('legal.subprocessors.pending'));
    const resend = screen.getByTestId('subprocessor-row-resend');
    expect(resend).toHaveTextContent('Entity set by the PO');
    expect(resend).toHaveTextContent('Mechanism set by the PO');
    expect(resend).not.toHaveTextContent(i18n.t('legal.subprocessors.pending'));
    // A purpose configured as text (no key) is shown as configured.
    expect(screen.getByTestId('subprocessor-row-ai')).toHaveTextContent('SEO content');
    expect(screen.queryByText(/SendGrid/)).not.toBeInTheDocument();
  });

  it('SubprocessorsPage_ApiError_ShowsErrorNotAnEmptyList', () => {
    state.subprocessors = { data: undefined, isLoading: false, isError: true };

    renderWithRouter(<SubprocessorsPage />);

    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('legal.loadError'));
    expect(screen.queryByTestId('subprocessors-empty')).not.toBeInTheDocument();
  });
});

describe('LegalIndexPage', () => {
  it('LegalIndexPage_Always_LinksEveryDocumentPage', () => {
    renderWithRouter(<LegalIndexPage />);

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/legale/termini', '/legale/privacy', '/legale/dpa', '/legale/sub-responsabili']);
  });
});
