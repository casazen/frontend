import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { ApiClient } from '@/api/client';
import i18n from '@/i18n/config';
import type { ImportResult } from '@/types/onboarding.types';
import { BulkImportPanel } from '../components/bulk-import-panel';

vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));

const P1 = '9d4f6a0e-2c1b-4c5d-8e7f-3a2b1c0d9e8f';
const P2 = '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d';
const LOCK_CODE = 'PORTONE-7788-ZX';
const CSV = `propertyId,lockCode\r\n${P1},${LOCK_CODE}\r\n${P2},12\r\n`;

const CHECKED: ImportResult = {
  dryRun: true,
  summary: { rows: 2, valid: 1, invalid: 1, applied: 0 },
  unknownColumns: ['colonna-che-non-conosco'],
  rows: [
    { rowNumber: 2, propertyRef: P1, propertyId: P1, status: 'ok', errors: [], lockCodeProvided: true, applied: false },
    { rowNumber: 3, propertyRef: P2, propertyId: P2, status: 'lock_code_invalid', errors: [{ column: 'lockCode', code: 'lock_code_invalid' }], lockCodeProvided: true, applied: false },
  ],
};
const IMPORTED: ImportResult = {
  ...CHECKED,
  dryRun: false,
  summary: { rows: 2, valid: 1, invalid: 1, applied: 1 },
  rows: [{ ...CHECKED.rows[0], applied: true }, CHECKED.rows[1]],
};

function csvFile(name = 'strutture.csv', content = CSV) {
  return new File([content], name, { type: 'text/csv' });
}

let client: QueryClient;

function renderPanel() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <BulkImportPanel />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

function choose(file: File) {
  fireEvent.change(screen.getByTestId('bulk-import-input'), { target: { files: [file] } });
}

function calls() {
  return vi.mocked(ApiClient.post).mock.calls.map(([url, body]) => ({ url: String(url), file: (body as FormData).get('file') as File | null }));
}

function failure(body: FormData) {
  const config = { headers: new AxiosHeaders(), data: body } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed with status code 500', 'ERR_BAD_RESPONSE', config, { body }, { status: 500, statusText: '', headers: {}, config, data: {} });
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  vi.mocked(ApiClient.post).mockReset();
});

afterEach(() => {
  cleanup();
});

describe('BulkImportPanel, the file of the import (E10/F03/US03/T02)', () => {
  it('BulkImportPanel_NeverRendersLockCode_Test', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce(CHECKED).mockResolvedValueOnce(IMPORTED);
    renderPanel();
    const file = csvFile();

    choose(file);
    fireEvent.click(screen.getByTestId('bulk-import-check'));

    await screen.findByTestId('bulk-import-checked');
    expect(calls()).toHaveLength(1);
    expect(calls()[0].url).toBe('/onboarding/bulk/import?dryRun=true');
    expect(calls()[0].file).toBe(file);
    expect(await calls()[0].file!.text()).toBe(CSV);
    expect(calls()[0].url).not.toContain(LOCK_CODE);
    expect(screen.getByTestId('bulk-import-row-2-lock')).toHaveTextContent(i18n.t('onboardingPlan.bulk.import.lockProvided'));
    expect(screen.getByTestId('bulk-import-row-3-lock')).toHaveTextContent(i18n.t('onboardingPlan.bulk.import.lockProvided'));
    expect(document.body.textContent).not.toContain(LOCK_CODE);
    expect(document.body.textContent).not.toContain('colonna-che-non-conosco');

    fireEvent.click(screen.getByTestId('bulk-import-apply'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('onboardingPlan.bulk.import.confirmAction', { count: 1 }) }));

    await screen.findByTestId('bulk-import-imported');
    expect(calls()).toHaveLength(2);
    expect(calls()[1].url).toBe('/onboarding/bulk/import?dryRun=false');
    expect(calls()[1].file).toBe(file);
    expect(calls()[1].url).not.toContain(LOCK_CODE);
    expect(document.body.textContent).not.toContain(LOCK_CODE);
    expect(screen.queryByTestId('bulk-import-file')).not.toBeInTheDocument();
    cleanup();
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it('BulkImportPanel_ACallThatFails_KeepsNeitherTheFileNorTheRequestInTheMutationCache', async () => {
    vi.mocked(ApiClient.post).mockImplementation((_url, body) => Promise.reject(failure(body as FormData)));
    renderPanel();

    choose(csvFile());
    fireEvent.click(screen.getByTestId('bulk-import-check'));

    expect(await screen.findByTestId('bulk-import-error')).toBeInTheDocument();
    const kept = client.getMutationCache().getAll();
    expect(kept).toHaveLength(1);
    const error = kept[0].state.error as AxiosError;
    expect(error.config?.data).toBeUndefined();
    expect(error.request).toBeUndefined();
    expect(error.response?.status).toBe(500);
    expect(document.body.textContent).not.toContain(LOCK_CODE);
  });

  it('BulkImportPanel_ImportIsOnlyAfterACheckOfTheSameFile_AnotherFileNeedsItsOwnCheck', async () => {
    vi.mocked(ApiClient.post).mockResolvedValue(CHECKED);
    renderPanel();

    expect(screen.getByTestId('bulk-import-check')).toBeDisabled();
    expect(screen.getByTestId('bulk-import-apply')).toBeDisabled();
    choose(csvFile());
    expect(screen.getByTestId('bulk-import-check-first')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-import-apply')).toBeDisabled();

    fireEvent.click(screen.getByTestId('bulk-import-check'));
    await screen.findByTestId('bulk-import-checked');
    expect(screen.getByTestId('bulk-import-apply')).toBeEnabled();

    choose(csvFile('altro.csv'));
    expect(screen.queryByTestId('bulk-import-checked')).not.toBeInTheDocument();
    expect(screen.getByTestId('bulk-import-apply')).toBeDisabled();
    expect(calls()).toHaveLength(1);
  });

  it('BulkImportPanel_TheCheck_ShowsOneRowForEachRowOfTheFileWithTheErrorsInPlainWordsAndTheSummary', async () => {
    vi.mocked(ApiClient.post).mockResolvedValue(CHECKED);
    renderPanel();

    choose(csvFile());
    fireEvent.click(screen.getByTestId('bulk-import-check'));

    await screen.findByTestId('bulk-import-checked');
    expect(screen.getByTestId('bulk-import-summary')).toHaveTextContent(
      `${i18n.t('onboardingPlan.bulk.import.summary.valid', { count: 1 })}, ${i18n.t('onboardingPlan.bulk.import.summary.invalid', { count: 1 })}`,
    );
    expect(screen.getByTestId('bulk-import-row-2')).toHaveAttribute('data-status', 'ok');
    expect(screen.getByTestId('bulk-import-row-3')).toHaveAttribute('data-status', 'toFix');
    expect(screen.getByTestId('bulk-import-row-3-errors')).toHaveTextContent(
      i18n.t('onboardingPlan.bulk.import.errorLine', {
        column: i18n.t('onboardingPlan.bulk.import.columns.lockCode'),
        reason: i18n.t('onboardingPlan.bulk.import.errors.lock_code_invalid'),
      }),
    );
    expect(screen.getByTestId('bulk-import-unknown-columns')).toHaveTextContent(i18n.t('onboardingPlan.bulk.import.unknownColumns', { count: 1 }));
  });

  it('BulkImportPanel_AResultOfManyRows_IsDrawnFiftyAtATime', async () => {
    const rows = Array.from({ length: 120 }, (_, index) => ({
      rowNumber: index + 2,
      propertyRef: `CIN${index}`,
      propertyId: null,
      status: 'ok',
      errors: [],
      lockCodeProvided: false,
      applied: false,
    }));
    vi.mocked(ApiClient.post).mockResolvedValue({ dryRun: true, summary: { rows: 120, valid: 120, invalid: 0, applied: 0 }, unknownColumns: [], rows } satisfies ImportResult);
    renderPanel();

    choose(csvFile());
    fireEvent.click(screen.getByTestId('bulk-import-check'));

    const table = await screen.findByTestId('bulk-import-rows');
    expect(within(table).getAllByRole('row')).toHaveLength(51);
    expect(screen.getByTestId('bulk-import-pager-status')).toHaveTextContent(i18n.t('onboardingPlan.bulk.pager.status', { page: 1, pages: 3, total: 120 }));
    fireEvent.click(screen.getByTestId('bulk-import-pager-next'));
    expect(screen.getByTestId('bulk-import-row-52')).toBeInTheDocument();
    expect(screen.queryByTestId('bulk-import-row-2')).not.toBeInTheDocument();
  });

  it('BulkImportPanel_AFileOfAnotherTypeOrTooBig_IsRefusedHereAndNeverSent', async () => {
    renderPanel();

    choose(csvFile('strutture.pdf'));
    expect(await screen.findByTestId('bulk-import-rejected')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-import-check')).toBeDisabled();

    const big = csvFile('grande.xlsx');
    Object.defineProperty(big, 'size', { value: 3 * 1024 * 1024 });
    choose(big);
    expect(screen.getByTestId('bulk-import-rejected')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-import-check')).toBeDisabled();
    expect(ApiClient.post).not.toHaveBeenCalled();
  });

  it('BulkImportPanel_TheImportFailsAfterTheCheck_SaysSomeRowsMayBeInAndNeverOffersTheSamePressAgain', async () => {
    vi.mocked(ApiClient.post)
      .mockResolvedValueOnce(CHECKED)
      .mockImplementationOnce((_url, body) => Promise.reject(failure(body as FormData)));
    renderPanel();

    choose(csvFile());
    fireEvent.click(screen.getByTestId('bulk-import-check'));
    await screen.findByTestId('bulk-import-checked');
    fireEvent.click(screen.getByTestId('bulk-import-apply'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: i18n.t('onboardingPlan.bulk.import.confirmAction', { count: 1 }) }));

    expect(await screen.findByTestId('bulk-import-uncertain')).toHaveTextContent(i18n.t('onboardingPlan.bulk.import.uncertain'));
    expect(screen.queryByTestId('bulk-import-imported')).not.toBeInTheDocument();
    expect(screen.getByTestId('bulk-import-apply')).toBeDisabled();
  });
});
