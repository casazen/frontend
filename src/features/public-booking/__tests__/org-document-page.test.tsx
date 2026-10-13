import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { useOrgDocument } from '@/queries/use-public-org';
import type { OrgSiteDocumentKind, PublicOrgDocument, PublicOrgDto } from '@/types';
import { OrgDocumentPage, OrgPrivacyPage, OrgTermsPage } from '../org-document-page';

vi.mock('@/queries/use-public-org', () => ({ useOrgDocument: vi.fn() }));

type DocumentResult = ReturnType<typeof useOrgDocument>;

const org: PublicOrgDto = {
  slug: 'villa-parco',
  displayName: 'Villa Parco',
  logoUrl: null,
  themeColor: null,
  contactEmail: null,
};

function document(overrides: Partial<PublicOrgDocument> = {}): PublicOrgDocument {
  return {
    kind: 'privacy',
    published: true,
    version: 3,
    source: 'Text',
    contentHtml: '<h2>Titolare</h2><p>Villa Parco di Mario Rossi</p>',
    externalUrl: null,
    publishedAt: '2026-10-01T09:30:00Z',
    ...overrides,
  };
}

function mockDocument(result: Partial<DocumentResult>) {
  vi.mocked(useOrgDocument).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...result,
  } as unknown as DocumentResult);
}

function renderPage(kind: OrgSiteDocumentKind = 'privacy', orgOverrides: Partial<PublicOrgDto> = {}) {
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/book/villa-parco/x']}>
        <Routes>
          <Route path="/book/:orgSlug" element={<Outlet context={{ org: { ...org, ...orgOverrides } }} />}>
            <Route path="x" element={<OrgDocumentPage kind={kind} />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('OrgDocumentPage (BK-14, A3-21)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('OrgDocumentPage_AskedForTheKindOfThePage_ReadsThatKindOfTheOrgFromTheUrlSlug', () => {
    mockDocument({ isLoading: true });
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/book/vecchio-slug/termini']}>
          <Routes>
            <Route path="/book/:orgSlug" element={<Outlet context={{ org }} />}>
              <Route path="termini" element={<OrgTermsPage />} />
              <Route path="privacy" element={<OrgPrivacyPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </I18nextProvider>,
    );

    expect(useOrgDocument).toHaveBeenCalledWith('vecchio-slug', 'terms');
  });

  it('OrgDocumentPage_Loading_ShowsAnAnnouncedSpinnerNotTheNotPublishedNotice', () => {
    mockDocument({ isLoading: true });
    renderPage();

    expect(screen.getByTestId('org-document-loading')).toHaveTextContent(i18n.t('publicSite.documents.loading'));
    expect(screen.queryByTestId('org-document-not-published')).not.toBeInTheDocument();
  });

  it('OrgDocumentPage_RequestFails_ShowsErrorWithRetryNotNotPublished', () => {
    const refetch = vi.fn();
    mockDocument({ isError: true, refetch });
    renderPage();

    expect(screen.getByTestId('org-document-error')).toHaveTextContent(i18n.t('publicSite.documents.loadError'));
    expect(screen.queryByTestId('org-document-not-published')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.errorFallback.tryAgain') }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['privacy', 'non ha ancora pubblicato la propria informativa privacy'],
    ['terms', 'non ha ancora pubblicato i propri termini di prenotazione'],
  ] as const)('OrgDocumentPage_%s_NotPublished_SaysSoHonestly', (kind, expected) => {
    mockDocument({ data: document({ kind, published: false, version: null, source: null, contentHtml: null, publishedAt: null }) });
    renderPage(kind);

    const notice = screen.getByTestId('org-document-not-published');
    expect(notice).toHaveTextContent('Villa Parco');
    expect(notice).toHaveTextContent(expected);
    // No text of CasaZen's stands in for the operator's.
    expect(screen.queryByTestId('org-document-body')).not.toBeInTheDocument();
    expect(screen.queryByTestId('org-document-contact')).not.toBeInTheDocument();
  });

  it('OrgDocumentPage_NotPublishedAndPublicContactEmail_OffersTheEmail', () => {
    mockDocument({ data: document({ published: false, version: null, source: null, contentHtml: null, publishedAt: null }) });
    renderPage('privacy', { contactEmail: 'privacy@villaparco.test' });

    expect(screen.getByTestId('org-document-contact')).toHaveAttribute('href', 'mailto:privacy@villaparco.test');
  });

  it('OrgDocumentPage_PublishedText_ShowsTitleVersionDateAndTheText', () => {
    mockDocument({ data: document() });
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: i18n.t('publicSite.documents.privacy.title') })).toBeInTheDocument();
    const meta = screen.getByTestId('org-document-meta');
    expect(meta).toHaveTextContent('Villa Parco');
    expect(meta).toHaveTextContent('versione 3');
    expect(meta).toHaveTextContent('1 ottobre 2026');
    const body = screen.getByTestId('org-document-body');
    expect(body).toHaveTextContent('Villa Parco di Mario Rossi');
    expect(body.querySelector('h2')).toHaveTextContent('Titolare');
    expect(screen.getByTestId('org-document-back')).toHaveAttribute('href', '/book/villa-parco');
  });

  it('OrgDocumentPage_HtmlWithScriptsAndHandlers_IsSanitizedBeforeRendering', () => {
    mockDocument({
      data: document({
        contentHtml:
          '<p onclick="steal()">Testo</p><script>window.__xss = 1</script><img src=x onerror="window.__xss = 2">' +
          '<a href="javascript:alert(1)">cattivo</a><a href="https://example.test/p">buono</a><iframe src="https://evil.test"></iframe>',
      }),
    });
    renderPage();

    const body = screen.getByTestId('org-document-body');
    expect(body.querySelector('script')).toBeNull();
    expect(body.querySelector('img')).toBeNull();
    expect(body.querySelector('iframe')).toBeNull();
    expect(body.querySelector('[onclick]')).toBeNull();
    expect(body.innerHTML).not.toContain('javascript:');
    const good = body.querySelector('a[href="https://example.test/p"]');
    expect(good).toHaveAttribute('rel', 'noopener noreferrer');
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
  });

  it('OrgDocumentPage_ExternalAddress_ShowsAButtonToTheDocumentOpeningInANewTab', () => {
    mockDocument({
      data: document({
        kind: 'terms',
        source: 'ExternalUrl',
        contentHtml: null,
        externalUrl: 'https://www.villaparco.test/termini.pdf',
      }),
    });
    renderPage('terms');

    const link = screen.getByTestId('org-document-external-link');
    expect(link).toHaveAttribute('href', 'https://www.villaparco.test/termini.pdf');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveTextContent('www.villaparco.test');
    expect(screen.queryByTestId('org-document-body')).not.toBeInTheDocument();
  });

  it('OrgDocumentPage_EnglishUi_UsesEnglishTexts', async () => {
    await i18n.changeLanguage('en');
    mockDocument({ data: document({ published: false, version: null, source: null, contentHtml: null, publishedAt: null }) });
    renderPage('terms');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Booking terms');
    expect(screen.getByTestId('org-document-not-published')).toHaveTextContent('has not published its booking terms');
  });
});
