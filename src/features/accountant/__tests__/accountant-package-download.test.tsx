import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { formatFileSize } from '@/features/document-archive/document-file';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { saveBlobAs } from '@/lib/file-download';
import { accountantPackageKeys } from '@/queries/use-accountant-package';
import { expectNoAxeViolations } from '@/test/axe';
import { freezeClock, NOON_UTC } from '@/test/clock';
import { AccountantPackagePage } from '../accountant-package-page';
import { mixedSummary } from './accountant-package-fixtures';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
vi.mock('@/lib/file-download', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/file-download')>()), saveBlobAs: vi.fn() }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => true }) }));
vi.mock('@/hooks/use-feature-flags', async () => {
  const { DEFAULT_FEATURE_FLAGS: defaults } = await import('@/config/feature-flags');
  return { useFeatureFlags: () => ({ flags: { ...defaults, accountantPackage: true }, isLoading: false }) };
});
vi.mock('@/components/layout/app-shell', () => ({ AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children) }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => createElement('h1', null, title) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.setConfig({ testTimeout: 30_000 });

const get = vi.mocked(axios.get);
const save = vi.mocked(saveBlobAs);

const SUMMARY_URL = '/accountant-package/agency-summary';
const PACKAGE_URL = '/accountant-package';

type Config = { params?: { period?: string }; responseType?: string; signal?: AbortSignal; onDownloadProgress?: (event: { loaded: number }) => void } | undefined;
type Answer = Promise<unknown>;

const ok = (data: unknown, headers: Record<string, string> = {}) => ({ status: 200, data, headers });

function failure(status: number, body: unknown = {}, asBlob = false): AxiosError {
  const data = asBlob ? new Blob([JSON.stringify(body)], { type: 'application/problem+json' }) : body;
  return new AxiosError('failed', undefined, undefined, undefined, { status, statusText: '', data, headers: {}, config: { headers: new AxiosHeaders() } });
}

function serve({ summary = () => Promise.resolve(ok(mixedSummary())), file = () => Promise.reject(new Error('no file served')) }: { summary?: () => Answer; file?: (config: Config) => Answer }) {
  get.mockImplementation(((url: string, config?: Config) => (url === SUMMARY_URL ? summary() : url === PACKAGE_URL ? file(config) : Promise.reject(new Error(`unexpected ${url}`)))) as never);
}

function renderPage(path = '/app/short-rent/accountant', client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })) {
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MemoryRouter, { initialEntries: [path] }, createElement(AccountantPackagePage)),
    ),
  );
}

const reads = (url: string) => get.mock.calls.filter(([called]) => called === url);
const periodOf = (call: unknown[]) => (call[1] as Config)?.params?.period;

describe('the page «Commercialista» (E15/F02/US01/T01)', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    freezeClock(NOON_UTC);
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('Page_WithEveryTableOfTheSummary_HasNoAccessibilityViolationThatAxeCanFind', async () => {
    serve({});
    const { container } = renderPage();
    await screen.findByTestId('accountant-summary');

    await expectNoAxeViolations(container);
  });

  describe('the period', () => {
    it('Period_NoneInTheAddress_IsTheMonthThatIsOverAndTheChoiceShowsIt', async () => {
      serve({});
      renderPage();
      await screen.findByTestId('accountant-summary');

      expect(reads(SUMMARY_URL).map(periodOf)).toEqual(['2026-08']);
      expect(screen.getByTestId('accountant-period')).toHaveValue('2026-08');
    });

    it('Period_AYearInTheAddress_IsAskedAsAYearAndTheAddressWinsOverWhatIsOffered', async () => {
      serve({});
      renderPage('/app/short-rent/accountant?period=2019');
      await screen.findByTestId('accountant-summary');

      expect(reads(SUMMARY_URL).map(periodOf)).toEqual(['2019']);
      expect(screen.getByTestId('accountant-period')).toHaveValue('2019');
      expect(screen.getByTestId('accountant-package-focus')).toHaveTextContent(i18n.t('accountantPackage.focus.kicker', { period: i18n.t('accountantPackage.period.year', { year: 2019 }) }));
    });

    it('Period_NotAMonthNorAYear_IsNeverAskedOfTheServer', async () => {
      serve({});
      renderPage('/app/short-rent/accountant?period=2026-13');
      await screen.findByTestId('accountant-summary');

      expect(reads(SUMMARY_URL).map(periodOf)).toEqual(['2026-08']);
    });

    it('Period_AnotherOneIsChosen_ReadsItsSummaryAndNeverShowsTheFiguresOfTheLastOne', async () => {
      serve({});
      renderPage();
      await screen.findByTestId('accountant-summary');
      const select = screen.getByTestId('accountant-period');
      await waitFor(() => expect(select).toBeEnabled());

      fireEvent.change(select, { target: { value: '2026-05' } });

      await waitFor(() => expect(reads(SUMMARY_URL).map(periodOf)).toEqual(['2026-08', '2026-05']));
      await waitFor(() => expect(screen.getByTestId('accountant-period')).toHaveValue('2026-05'));
    });
  });

  describe('the download', () => {
    it('Download_Click_AsksThePeriodOfTheAddressWaitsForItAndSavesTheFileUnderTheNameOfTheServer', async () => {
      const blob = new Blob(['PK'], { type: 'application/zip' });
      let finish: (answer: unknown) => void = () => undefined;
      serve({
        file: (config) => {
          config?.onDownloadProgress?.({ loaded: 2048 });
          return new Promise((resolve) => {
            finish = resolve;
          });
        },
      });
      renderPage('/app/short-rent/accountant?period=2026-07');
      await screen.findByTestId('accountant-summary');
      const button = screen.getByTestId('accountant-download');
      await waitFor(() => expect(button).toBeEnabled());

      fireEvent.click(button);

      await waitFor(() => expect(reads(PACKAGE_URL)).toHaveLength(1));
      expect(reads(PACKAGE_URL)[0]![1]).toMatchObject({ params: { period: '2026-07' }, responseType: 'blob' });
      await waitFor(() => expect(screen.getByTestId('accountant-download-progress')).toHaveTextContent(i18n.t('accountantPackage.download.received', { size: formatFileSize(2048, 'it') })));
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByTestId('accountant-period')).toBeDisabled();
      fireEvent.click(button);
      expect(reads(PACKAGE_URL)).toHaveLength(1);
      expect(save).not.toHaveBeenCalled();

      finish(ok(blob, { 'content-disposition': 'attachment; filename="casazen-commercialista-2026-07.zip"' }));

      await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
      expect(save).toHaveBeenCalledWith(blob, 'casazen-commercialista-2026-07.zip');
      await waitFor(() => expect(screen.getByTestId('accountant-period')).toBeEnabled());
      expect(screen.queryByTestId('accountant-download-problem')).toBeNull();
    });

    it('Download_TheNameOfTheFileCannotBeRead_IsSavedUnderTheNameBuiltFromThePeriod', async () => {
      const blob = new Blob(['PK'], { type: 'application/zip' });
      serve({ file: () => Promise.resolve(ok(blob)) });
      renderPage();
      await screen.findByTestId('accountant-summary');
      const button = screen.getByTestId('accountant-download');
      await waitFor(() => expect(button).toBeEnabled());

      fireEvent.click(button);

      await waitFor(() => expect(save).toHaveBeenCalledWith(blob, 'casazen-commercialista-2026-08.zip'));
    });

    it('Download_APackageThatIsTooLarge_SaysHowManyFilesItWouldHoldAndSavesNothing', async () => {
      serve({ file: () => Promise.reject(failure(422, { code: 'accountant_package_too_large', fileCount: 1500, maxFiles: 1000, maxBytes: 209715200 }, true)) });
      renderPage('/app/short-rent/accountant?period=2026');
      await screen.findByTestId('accountant-summary');
      const button = screen.getByTestId('accountant-download');
      await waitFor(() => expect(button).toBeEnabled());

      fireEvent.click(button);

      expect(await screen.findByTestId('accountant-download-problem')).toHaveTextContent(i18n.t('accountantPackage.download.tooLarge', { files: 1500, max: 1000 }));
      expect(save).not.toHaveBeenCalled();
      const select = screen.getByTestId('accountant-period');
      await waitFor(() => expect(select).toBeEnabled());
      fireEvent.change(select, { target: { value: '2026-05' } });
      await waitFor(() => expect(screen.queryByTestId('accountant-download-problem')).toBeNull());
    });

    it('Download_StoppedByThePerson_IsNotAFailureAndTheChoiceOfThePeriodIsFreeAgain', async () => {
      serve({
        file: (config) =>
          new Promise((_, reject) => {
            config?.signal?.addEventListener('abort', () => reject(new AxiosError('canceled', AxiosError.ERR_CANCELED)));
          }),
      });
      renderPage();
      await screen.findByTestId('accountant-summary');
      const button = screen.getByTestId('accountant-download');
      await waitFor(() => expect(button).toBeEnabled());

      fireEvent.click(button);
      fireEvent.click(await screen.findByTestId('accountant-download-cancel'));

      await waitFor(() => expect(screen.getByTestId('accountant-period')).toBeEnabled());
      expect(screen.queryByTestId('accountant-download-cancel')).toBeNull();
      expect(screen.queryByTestId('accountant-download-problem')).toBeNull();
      expect(save).not.toHaveBeenCalled();
    });

    it('Download_RefusedToTheRole_IsToldInWordsAndSavesNothing', async () => {
      serve({ file: () => Promise.resolve({ status: 403, data: new Blob(['{}'], { type: 'application/problem+json' }), headers: {} }) });
      renderPage();
      await screen.findByTestId('accountant-summary');
      const button = screen.getByTestId('accountant-download');
      await waitFor(() => expect(button).toBeEnabled());

      fireEvent.click(button);

      expect(await screen.findByTestId('accountant-download-problem')).toHaveTextContent(i18n.t('accountantPackage.download.forbidden'));
      expect(save).not.toHaveBeenCalled();
    });
  });

  describe('the summary that is read', () => {
    it('Summary_NotFoundWhileFiguresAreInTheCache_IsSaidAndNoFigureStaysOnScreen', async () => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      client.setQueryData(accountantPackageKeys.summary('2026-08'), mixedSummary());
      serve({ summary: () => Promise.reject(failure(404)) });
      renderPage('/app/short-rent/accountant', client);

      expect(await screen.findByTestId('accountant-package-unavailable')).toHaveTextContent(i18n.t('accountantPackage.unavailable'));
      expect(screen.queryByTestId('accountant-summary')).toBeNull();
      expect(screen.queryByTestId('accountant-download')).toBeNull();
    });

    it('Summary_RefusedToTheCaller_IsToldInWordsInThePage', async () => {
      serve({ summary: () => Promise.resolve({ status: 403, data: {}, headers: {} }) });
      renderPage();

      expect(await screen.findByTestId('accountant-package-no-access')).toHaveTextContent(i18n.t('accountantPackage.noAccess'));
      expect(screen.queryByTestId('accountant-summary')).toBeNull();
    });

    it('Summary_AFailedRead_IsAnErrorWithARetryNeverAnEmptySummaryAndTheDownloadStaysOffered', async () => {
      let attempts = 0;
      serve({ summary: () => (attempts++ === 0 ? Promise.reject(failure(500)) : Promise.resolve(ok(mixedSummary()))) });
      renderPage();

      const error = await screen.findByTestId('accountant-summary-error');
      expect(screen.queryByTestId('accountant-summary')).toBeNull();
      expect(screen.queryByTestId('accountant-documents-empty')).toBeNull();
      expect(screen.getByTestId('accountant-download')).toBeInTheDocument();

      fireEvent.click(error.querySelector('button')!);
      expect(await screen.findByTestId('accountant-summary')).toBeInTheDocument();
    });

    it('Summary_ABodyThatIsNotTheSummary_IsALoadErrorNeverAnEmptyPeriod', async () => {
      serve({ summary: () => Promise.resolve(ok('<!doctype html><html></html>')) });
      renderPage();

      expect(await screen.findByTestId('accountant-summary-error')).toBeInTheDocument();
      expect(screen.queryByTestId('accountant-summary')).toBeNull();
    });
  });
});
