import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { ReportAccessDeniedError } from '@/api/report-files';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import type { TaxReportingDataset } from '@/types';
import { TaxExportsSection } from '../components/tax-exports-section';
import { OWNER_ID, OTHER_OWNER_ID, dataset } from './owner-accounting-fixtures';

const api = vi.hoisted(() => ({
  downloadF24Data: vi.fn(),
  downloadCuData: vi.fn(),
  downloadCuProspect: vi.fn(),
  download770Data: vi.fn(),
  downloadContractsCommunication: vi.fn(),
  listOwners: vi.fn(),
}));
const saved = vi.hoisted(() => vi.fn());

vi.mock('@/api/withholding.api', () => ({ withholdingApi: api }));
vi.mock('@/api/owner-accounting.api', () => ({ ownerAccountingApi: { listOwners: api.listOwners } }));
vi.mock('@/lib/file-download', () => ({ saveBlobAs: saved, withJsonErrorBody: async (error: unknown) => error }));

vi.setConfig({ testTimeout: 30_000 });

/**
 * The files of the Italian withholding that the agency hands to its accountant (E18/F01/US01/T02, E18/F01/US02, NF-117): the data of the F24 exists whatever the flag says (the backend does not gate it), the rest only with the
 * flag of the tax exports, as at the server. The files name fiscal codes and addresses, so a role that may not read them is told so in the page and never sent away, and nothing is asked while a file of the page is
 * being made.
 */

const file = (name = 'export.csv') => ({ blob: new Blob(['a;b']), contentDisposition: `attachment; filename="${name}"` });

function renderSection(props: Partial<Parameters<typeof TaxExportsSection>[0]> = {}, taxReportingExports = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    createElement(
      FeatureFlagsContext.Provider,
      { value: { flags: { ...DEFAULT_FEATURE_FLAGS, taxReportingExports }, isLoading: false } },
      createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(TaxExportsSection, { year: 2026, month: 11, dataset: dataset({ year: 2026 }), ...props }))),
    ),
  );
}

/** Presses the button of one file once it is enabled and waits until the file is saved (`saves` is how many files were saved by then), so the next press finds the page ready. */
async function makeFile(testId: string, saves: number) {
  await waitFor(() => expect(screen.getByTestId(testId)).toBeEnabled());
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(saves));
}

const withOwners = (...ids: string[]): TaxReportingDataset => dataset({ year: 2026, payloadJson: JSON.stringify(ids.map((ownerId) => ({ ownerId, grossBase: 100, withheld: 21, evidence: 1 }))) });

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
  api.listOwners.mockResolvedValue([
    { id: OWNER_ID, firstName: 'Marta', lastName: 'Rossi' },
    { id: OTHER_OWNER_ID, firstName: 'Luca', lastName: 'Bianchi' },
  ]);
  for (const call of [api.downloadF24Data, api.downloadCuData, api.download770Data, api.downloadContractsCommunication, api.downloadCuProspect]) call.mockResolvedValue(file());
});

afterEach(() => cleanup());

describe('the exports of the withholding follow the flag as the backend does', () => {
  it('TaxExports_WithTheFlagOff_OnlyTheF24DataOfTheMonthIsOffered_AndNothingElseIsAsked', async () => {
    renderSection({ dataset: null }, false);

    expect(screen.getByTestId('tax-export-f24')).toBeInTheDocument();
    for (const row of ['cu', 'tax770', 'contracts']) expect(screen.queryByTestId(`tax-export-${row}`)).toBeNull();
    fireEvent.click(screen.getByTestId('tax-export-f24-csv'));
    await waitFor(() => expect(api.downloadF24Data).toHaveBeenCalledWith(2026, 11, 'csv'));
    expect(api.listOwners).not.toHaveBeenCalled();
    expect(api.downloadCuData).not.toHaveBeenCalled();
  });

  it('TaxExports_WithTheFlagOffAndNoMonthWithWithholding_NothingIsDrawn', () => {
    const { container } = renderSection({ month: null, dataset: null }, false);
    expect(container.textContent).toBe('');
  });

  it('TaxExports_WithTheFlagOn_EveryFileOfTheYearIsOffered_AndEachAsksTheServerForItsOwnFormat', async () => {
    renderSection();

    // One file at a time: the page asks nothing while one is being made, so each press waits for its button to be enabled and for the file to be saved.
    await makeFile('tax-export-cu-xlsx', 1);
    await makeFile('tax-export-tax770-csv', 2);
    await makeFile('tax-export-contracts-xlsx', 3);
    expect(api.downloadCuData).toHaveBeenCalledWith(2026, 'xlsx');
    expect(api.download770Data).toHaveBeenCalledWith(2026, 'csv');
    expect(api.downloadContractsCommunication).toHaveBeenCalledWith(2026, 'xlsx');
    // The communication of the contracts says when it is due and that CasaZen sends nothing.
    expect(screen.getByTestId('tax-export-contracts')).toHaveTextContent('30 giugno 2027');
    expect(screen.getByTestId('tax-exports')).toHaveTextContent(i18n.t('ownerAccounting.exports.note'));
  });
});

describe('a file is made once and told in words when it fails', () => {
  it('TaxExports_ADoubleClickAsksOnce_AndWhileOneIsOnItsWayNoOtherIsAsked', async () => {
    let finish!: (value: ReturnType<typeof file>) => void;
    api.downloadF24Data.mockReturnValue(new Promise((done) => (finish = done)));
    renderSection();

    const csv = screen.getByTestId('tax-export-f24-csv');
    fireEvent.click(csv);
    fireEvent.click(csv);
    await waitFor(() => expect(screen.getByTestId('tax-export-tax770-csv')).toBeDisabled());
    expect(api.downloadF24Data).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('tax-export-cu-csv')).toBeDisabled();

    finish(file('f24.csv'));
    await waitFor(() => expect(screen.getByTestId('tax-export-tax770-csv')).toBeEnabled());
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('TaxExports_WhileAFileOfThePageIsBeingMade_NothingIsAsked', () => {
    renderSection({ busy: true });
    for (const id of ['f24', 'cu', 'tax770', 'contracts']) {
      expect(screen.getByTestId(`tax-export-${id}-csv`)).toBeDisabled();
      expect(screen.getByTestId(`tax-export-${id}-xlsx`)).toBeDisabled();
    }
  });

  it('TaxExports_ARoleThatMayNotReadTheFile_IsToldWhereItIs_UnderTheFileItAskedFor', async () => {
    api.downloadContractsCommunication.mockRejectedValue(new ReportAccessDeniedError('/withholding/contracts-communication/2026/export'));
    renderSection();

    fireEvent.click(screen.getByTestId('tax-export-contracts-csv'));

    const failure = await screen.findByTestId('tax-export-contracts-failure');
    expect(failure).toHaveTextContent(i18n.t('ownerAccounting.exports.noAccess'));
    // The other files are not told to fail, and the page is still the page.
    expect(screen.queryByTestId('tax-export-tax770-failure')).toBeNull();
    expect(saved).not.toHaveBeenCalled();
  });

  it('TaxExports_ARefusalWithACode_IsToldInTheWordsOfTheCode', async () => {
    api.download770Data.mockRejectedValue(Object.assign(new Error('refused'), { isAxiosError: true, response: { status: 422, data: { code: 'tax_no_obligations' } } }));
    renderSection();

    fireEvent.click(screen.getByTestId('tax-export-tax770-xlsx'));

    expect(await screen.findByTestId('tax-export-tax770-failure')).toHaveTextContent(i18n.t('apiErrors.codes.taxNoObligations'));
  });
});

describe('the CU needs the annual data, and its prospects are one for each owner of them', () => {
  it('TaxExports_WithoutAnnualData_TheCuIsNotOffered_AndTheWayToMakeThemIsTold', () => {
    renderSection({ dataset: null, closeHref: '/app/account/owner-close?period=2026-11' });

    expect(screen.getByTestId('tax-export-cu-csv')).toBeDisabled();
    expect(screen.getByTestId('tax-export-cu-xlsx')).toBeDisabled();
    const none = screen.getByTestId('tax-export-cu-none');
    expect(within(none).getByRole('link')).toHaveAttribute('href', '/app/account/owner-close?period=2026-11');
    // The 770 and the communication do not need them.
    expect(screen.getByTestId('tax-export-tax770-csv')).toBeEnabled();
  });

  it('TaxExports_WhileTheAnnualDataAreRead_TheCuWaits', () => {
    renderSection({ dataset: undefined });
    expect(screen.getByTestId('tax-export-cu-csv')).toBeDisabled();
    expect(screen.queryByTestId('tax-export-cu-none')).toBeNull();
  });

  it('TaxExports_TheProspectOfAnOwner_IsAskedForThatOwnerOnly_WithItsNameNotItsId', async () => {
    renderSection({ dataset: withOwners(OWNER_ID, OTHER_OWNER_ID) });

    const list = screen.getByTestId('tax-export-cu-prospects');
    expect(await within(list).findByText('Luca Bianchi')).toBeInTheDocument();
    expect(within(list).getByText('Marta Rossi')).toBeInTheDocument();

    fireEvent.click(within(list).getByTestId(`tax-export-cu-prospect-pdf-${OTHER_OWNER_ID}`));
    await waitFor(() => expect(api.downloadCuProspect).toHaveBeenCalledWith(2026, OTHER_OWNER_ID));
    expect(api.downloadCuProspect).toHaveBeenCalledTimes(1);
  });

  it('TaxExports_AProspectThatCannotBeMade_IsToldUnderItsOwner', async () => {
    api.downloadCuProspect.mockRejectedValue(Object.assign(new Error('refused'), { isAxiosError: true, response: { status: 404, data: { code: 'tax_cu_record_not_found' } } }));
    renderSection({ dataset: withOwners(OWNER_ID) });

    fireEvent.click(await screen.findByTestId(`tax-export-cu-prospect-pdf-${OWNER_ID}`));

    expect(await screen.findByTestId('tax-export-cu-prospect-failure')).toHaveTextContent(i18n.t('apiErrors.codes.taxCuRecordNotFound'));
  });

  it('TaxExports_APayloadThatIsNotTheListOfTotals_IsToldNotListedAsNoOwners', () => {
    renderSection({ dataset: dataset({ year: 2026, payloadJson: '{"rows":[]}' }) });

    expect(screen.getByTestId('tax-export-cu-prospects-unreadable')).toBeInTheDocument();
  });
});
