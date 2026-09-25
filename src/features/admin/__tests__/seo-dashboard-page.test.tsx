import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { AdminSeoApi } from '@/api/admin-seo.api';
import type { SeoPageAdmin, SeoPageAdminDetail, SeoPagesPagedResult } from '@/types/seo.types';
import { SeoDashboardPage } from '../seo-dashboard-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/admin-seo.api', () => ({
  AdminSeoApi: {
    listPages: vi.fn(),
    getPage: vi.fn(),
    generatePages: vi.fn(),
    approveRevision: vi.fn(),
    withdrawPage: vi.fn(),
    getBudget: vi.fn(),
    listComuni: vi.fn(),
  },
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: ReactNode }) =>
    createElement('div', null, createElement('h1', null, title), action),
}));

/** Published page with a newer generated revision waiting for review. */
const como: SeoPageAdmin = {
  id: 'page-como',
  slug: 'affitti-brevi/lombardia/como',
  comuneCode: '013075',
  comuneName: 'Como',
  regionCode: 'LOM',
  regionSlug: 'lombardia',
  pageType: 'ComplianceGuide',
  title: 'Affitti brevi a Como: CIN e tassa di soggiorno',
  legalReviewStatus: 'Draft',
  publishedAt: '2026-09-01T08:00:00Z',
  lastRefreshedAt: '2026-09-20T08:00:00Z',
  latestRevision: {
    id: 'rev-2',
    generatedAt: '2026-09-20T08:00:00Z',
    aiModelTier: 'Economy',
    promptTokens: 900,
    sourceDataVersion: 'v2',
    contentStatus: 'Generated',
    promptVersion: 'seo-it-2026-09-v1',
  },
  publishedRevisionId: 'rev-1',
  isPublished: true,
  hasPendingRevision: true,
  counselRequired: true,
  publicPath: '/p/affitti-brevi/lombardia/como',
  publicUrl: 'https://public.example.test/p/affitti-brevi/lombardia/como',
  lastReviewEvent: null,
};

/** Page generated with the stub provider: never published, nothing to approve. */
const roma: SeoPageAdmin = {
  ...como,
  id: 'page-roma',
  slug: 'affitti-brevi/lazio/roma',
  comuneCode: '058091',
  comuneName: 'Roma',
  regionSlug: 'lazio',
  title: 'Affitti brevi a Roma',
  publishedAt: null,
  latestRevision: { ...como.latestRevision!, id: 'rev-roma', contentStatus: 'AiProviderNotConfigured' },
  publishedRevisionId: null,
  isPublished: false,
  hasPendingRevision: true,
  publicPath: '/p/affitti-brevi/lazio/roma',
  publicUrl: null,
};

function pagesResult(items: SeoPageAdmin[], totalCount = items.length, page = 1): SeoPagesPagedResult {
  return { items, totalCount, page, pageSize: 20 };
}

const comoDetail: SeoPageAdminDetail = {
  page: como,
  pendingRevision: {
    id: 'rev-2',
    generatedAt: '2026-09-20T08:00:00Z',
    contentStatus: 'Generated',
    promptVersion: 'seo-it-2026-09-v1',
    sourceDataVersion: 'v2',
    bodyHtml: '<h2>CIN</h2><p>Nuovo testo della guida</p><img src="x" onerror="alert(1)"><script>alert(1)</script>',
  },
  publishedRevision: {
    id: 'rev-1',
    generatedAt: '2026-09-01T08:00:00Z',
    contentStatus: 'Generated',
    promptVersion: null,
    sourceDataVersion: 'v1',
    bodyHtml: '<p>Vecchio testo approvato</p>',
  },
  reviewHistory: [
    {
      action: 'Approved',
      revisionId: 'rev-1',
      actorUserId: 'auth0|legale',
      occurredAt: '2026-09-01T08:00:00Z',
      counselApproved: true,
      note: 'Parere n. 7',
    },
  ],
};

function problemError(status: number, data: object): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { status, ...data },
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(SeoDashboardPage)));
}

function dialog() {
  return within(screen.getByRole('dialog'));
}

describe('SeoDashboardPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    vi.mocked(AdminSeoApi.listPages).mockResolvedValue(pagesResult([como, roma]));
    vi.mocked(AdminSeoApi.getBudget).mockResolvedValue({
      monthlyTokenCap: 500000,
      tokensUsedThisMonth: 1200,
      lastResetAt: '2026-09-01T00:00:00Z',
    });
    vi.mocked(AdminSeoApi.listComuni).mockResolvedValue([]);
    vi.mocked(AdminSeoApi.getPage).mockResolvedValue(comoDetail);
  });

  it('render_Pages_ShowsPublicationAndContentStateWithoutApproveAll', async () => {
    renderPage();

    expect(await screen.findByTestId('seo-publication-page-como')).toHaveTextContent(
      'Pubblicata · nuova revisione da approvare',
    );
    expect(screen.getByTestId('seo-publication-page-roma')).toHaveTextContent('Non pubblicata');
    expect(screen.getByTestId('seo-content-status-page-roma')).toHaveTextContent(
      'Contenuto non generato: provider AI non configurato',
    );
    expect(screen.getAllByText('Guida adempimenti')).toHaveLength(2);
    // A8-04: no bulk approval without reading the texts.
    expect(screen.queryByRole('button', { name: /approva tutte/i })).not.toBeInTheDocument();
    // A8-21: link to the public page and "Ritira" only for the published page.
    expect(screen.getByTestId('seo-open-public-page-como')).toHaveAttribute('href', como.publicUrl);
    expect(screen.getByTestId('seo-withdraw-page-como')).toBeInTheDocument();
    expect(screen.queryByTestId('seo-open-public-page-roma')).not.toBeInTheDocument();
    expect(screen.queryByTestId('seo-withdraw-page-roma')).not.toBeInTheDocument();
  });

  it('pagination_NextPage_AsksTheServerForTheSecondPage', async () => {
    vi.mocked(AdminSeoApi.listPages).mockResolvedValue(pagesResult([como, roma], 45));
    renderPage();

    expect(await screen.findByTestId('seo-pagination')).toHaveTextContent('Pagina 1 di 3 · 45 pagine');
    fireEvent.click(screen.getByTestId('seo-page-next'));

    await waitFor(() => expect(AdminSeoApi.listPages).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 }));
    expect(await screen.findByTestId('seo-pagination')).toHaveTextContent('Pagina 2 di 3');
  });

  it('filter_ToReview_AsksDraftPagesFromTheFirstPage', async () => {
    renderPage();
    await screen.findByTestId('seo-pages-table');

    fireEvent.change(screen.getByTestId('seo-status-filter'), { target: { value: 'Draft' } });

    await waitFor(() =>
      expect(AdminSeoApi.listPages).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, legalReviewStatus: 'Draft' }),
    );
  });

  it('render_LoadErrors_ShowErrorsNotAnEmptyList', async () => {
    vi.mocked(AdminSeoApi.listPages).mockRejectedValue(problemError(500, {}));
    vi.mocked(AdminSeoApi.getBudget).mockRejectedValue(problemError(500, {}));
    renderPage();

    expect(await screen.findByTestId('seo-pages-error')).toHaveTextContent('Impossibile caricare le pagine SEO');
    expect(await screen.findByTestId('seo-ai-budget-error')).toHaveTextContent('Impossibile caricare il budget AI.');
    expect(screen.queryByText('Nessuna pagina SEO.')).not.toBeInTheDocument();
  });

  it('review_PendingRevision_ShowsSanitizedTextsAndApprovesOnlyAfterConfirmation', async () => {
    vi.mocked(AdminSeoApi.approveRevision).mockResolvedValue({ ...como, hasPendingRevision: false });
    renderPage();
    fireEvent.click(await screen.findByTestId('seo-review-page-como'));

    const pending = await screen.findByTestId('seo-review-pending-body');
    expect(pending).toHaveTextContent('Nuovo testo della guida');
    expect(pending.querySelector('img, script')).toBeNull();
    expect(screen.getByTestId('seo-review-published-body')).toHaveTextContent('Vecchio testo approvato');
    expect(screen.getByTestId('seo-review-history')).toHaveTextContent('Approvata da auth0|legale');
    expect(screen.getByTestId('seo-review-history')).toHaveTextContent('Nota: Parere n. 7');

    const approve = dialog().getByTestId('seo-review-approve');
    expect(approve).toBeDisabled();
    fireEvent.click(dialog().getByRole('checkbox', { name: 'Confermo che questo testo ha avuto la revisione legale' }));
    fireEvent.change(dialog().getByLabelText('Nota per lo storico (facoltativa)'), { target: { value: ' Parere n. 12 ' } });
    expect(approve).toBeEnabled();
    fireEvent.click(approve);

    await waitFor(() =>
      expect(AdminSeoApi.approveRevision).toHaveBeenCalledWith('page-como', {
        revisionId: 'rev-2',
        counselApproved: true,
        note: 'Parere n. 12',
      }),
    );
    await waitFor(() => expect(screen.queryByTestId('seo-review-dialog')).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalled();
  });

  it('review_ApproveRefused_ShowsTheServerMessageAndKeepsTheDialog', async () => {
    vi.mocked(AdminSeoApi.approveRevision).mockRejectedValue(
      problemError(409, {
        code: 'seo_revision_outdated',
        detail: 'Nel frattempo è arrivata una revisione più recente: ricarica la pagina.',
      }),
    );
    renderPage();
    fireEvent.click(await screen.findByTestId('seo-review-page-como'));
    await screen.findByTestId('seo-review-pending-body');

    fireEvent.click(dialog().getByRole('checkbox'));
    fireEvent.click(dialog().getByTestId('seo-review-approve'));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Nel frattempo è arrivata una revisione più recente: ricarica la pagina.'),
    );
    expect(screen.getByTestId('seo-review-dialog')).toBeInTheDocument();
  });

  it('review_ContentNotGenerated_CannotBeApproved', async () => {
    vi.mocked(AdminSeoApi.getPage).mockResolvedValue({
      page: roma,
      pendingRevision: {
        id: 'rev-roma',
        generatedAt: '2026-09-20T08:00:00Z',
        contentStatus: 'AiProviderNotConfigured',
        promptVersion: 'seo-it-2026-09-v1',
        sourceDataVersion: 'v1',
        bodyHtml: '',
      },
      publishedRevision: null,
      reviewHistory: [],
    });
    renderPage();
    fireEvent.click(await screen.findByTestId('seo-review-page-roma'));

    expect(await screen.findByTestId('seo-review-not-publishable')).toBeInTheDocument();
    expect(dialog().getByTestId('seo-review-pending')).toHaveTextContent(
      'Contenuto non generato: provider AI non configurato',
    );
    expect(dialog().getByTestId('seo-review-published')).toHaveTextContent('La pagina non è pubblicata');
    expect(dialog().queryByTestId('seo-review-approve')).not.toBeInTheDocument();
    expect(dialog().queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('withdraw_AsksConfirmationThenSendsTheReason', async () => {
    vi.mocked(AdminSeoApi.withdrawPage).mockResolvedValue({ ...como, isPublished: false });
    renderPage();
    fireEvent.click(await screen.findByTestId('seo-withdraw-page-como'));

    expect(dialog().getByText(/torna in bozza/)).toBeInTheDocument();
    expect(AdminSeoApi.withdrawPage).not.toHaveBeenCalled();
    fireEvent.change(dialog().getByLabelText('Motivo (facoltativo)'), { target: { value: 'Da correggere' } });
    fireEvent.click(dialog().getByTestId('seo-withdraw-confirm'));

    await waitFor(() => expect(AdminSeoApi.withdrawPage).toHaveBeenCalledWith('page-como', { note: 'Da correggere' }));
  });

  it('generate_Confirmed_QueuesDraftsWithoutAutoApproval', async () => {
    vi.mocked(AdminSeoApi.generatePages).mockResolvedValue({
      jobId: 'job-1',
      enqueuedAt: '2026-09-25T08:00:00Z',
      comuneCount: 12,
      estimatedPages: 24,
    });
    renderPage();
    await screen.findByTestId('seo-pages-table');

    fireEvent.click(screen.getByTestId('seo-regenerate-button'));
    expect(dialog().getByText(/restano in bozza/)).toBeInTheDocument();
    fireEvent.click(dialog().getByTestId('seo-regenerate-confirm'));

    await waitFor(() => expect(AdminSeoApi.generatePages).toHaveBeenCalledTimes(1));
    const request = vi.mocked(AdminSeoApi.generatePages).mock.calls[0][0];
    expect(request).toEqual({ comuneCodes: [], pageTypes: ['ComplianceGuide', 'TouristTaxCalc'], forceRegenerate: false });
    expect(request).not.toHaveProperty('autoApproveCounsel');
  });
});
