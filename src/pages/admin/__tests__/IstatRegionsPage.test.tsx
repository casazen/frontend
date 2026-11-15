import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { istatApi } from '@/api/istat.api';
import type { IstatRegionRule, SaveIstatRegionRequest } from '@/types/istat.types';
import { IstatRegionsPage } from '../IstatRegionsPage';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/istat.api', () => ({ istatApi: { listRegions: vi.fn(), saveRegion: vi.fn(), getCoverage: vi.fn() } }));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) =>
    createElement('div', null, createElement('h1', null, title), description ? createElement('p', null, description) : null),
}));

const LOMBARDIA: IstatRegionRule = {
  id: 'rule-03',
  regionIstatCode: '03',
  provinceCode: null,
  regionName: 'Lombardia',
  system: 'Ross1000',
  portalUrl: 'https://ross1000.example.com/guida',
  deadlineKind: 'Monthly',
  deadlineDay: 5,
  requiredGuestFields: null,
  octorateCoverage: 'Unknown',
  sourceUrl: 'https://fonte.example.com/lombardia',
  verifiedAt: null,
  notes: null,
  updatedAt: '2026-11-15T17:00:00Z',
};

const BOLZANO: IstatRegionRule = {
  id: 'rule-04-bz',
  regionIstatCode: '04',
  provinceCode: 'BZ',
  regionName: 'Bolzano',
  system: null,
  portalUrl: null,
  deadlineKind: 'Unknown',
  deadlineDay: null,
  requiredGuestFields: ['TourismType', 'TravelWay'],
  octorateCoverage: 'Covered',
  sourceUrl: 'https://fonte.example.com/bolzano',
  verifiedAt: '2026-11-10T09:00:00Z',
  notes: 'Verificata sul sito della Provincia.',
  updatedAt: '2026-11-10T09:00:00Z',
};

function problem(status: number, data: unknown = {}): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

/** What the server holds: the fake of the endpoints applies the save to it, as the real one does (it replaces the row). */
let table: IstatRegionRule[];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(QueryClientProvider, { client }, createElement(IstatRegionsPage)),
  );
}

async function openDialog(rowId: string) {
  fireEvent.click(await screen.findByTestId(`istat-region-edit-${rowId}`));
  return screen.findByTestId('istat-region-dialog');
}

beforeEach(async () => {
  vi.clearAllMocks();
  // Only the clock: the timers stay real, so the dialog and the queries settle as they do.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-15T10:00:00Z'));
  await i18n.changeLanguage('it');
  table = [{ ...LOMBARDIA }, { ...BOLZANO }];
  vi.mocked(istatApi.listRegions).mockReset().mockImplementation(async () => table.map((row) => ({ ...row })));
  vi.mocked(istatApi.saveRegion).mockReset().mockImplementation(async (request: SaveIstatRegionRequest) => {
    const index = table.findIndex((row) => row.regionIstatCode === request.regionIstatCode && row.provinceCode === request.provinceCode);
    const saved: IstatRegionRule = {
      ...table[index],
      system: request.system,
      portalUrl: request.portalUrl,
      deadlineKind: request.deadlineKind,
      deadlineDay: request.deadlineDay,
      requiredGuestFields: request.requiredGuestFields,
      octorateCoverage: request.octorateCoverage,
      sourceUrl: request.sourceUrl,
      verifiedAt: request.verifiedAt,
      notes: request.notes,
    };
    table[index] = saved;
    return saved;
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// E21/F01/US02/T01 (NF-44, NF-52): the staff page of the region table.
describe('IstatRegionsPage', () => {
  it('IstatRegionsPage_Table_ShowsEveryRowWithItsCoverageAndWhatIsNotVerifiedAsToVerify', async () => {
    renderPage();

    expect(await screen.findByTestId('istat-regions-table')).toBeInTheDocument();
    const lombardia = screen.getByTestId('istat-region-row-03');
    expect(lombardia).toHaveAttribute('data-coverage', 'Unknown');
    expect(within(lombardia).getByTestId('istat-region-coverage-03')).toHaveTextContent(text('istatRegions.coverage.Unknown'));
    expect(within(lombardia).getByTestId('istat-region-verified-03')).toHaveTextContent(text('istatRegions.neverVerified'));
    expect(within(lombardia).getByText(text('istatRegions.deadline.monthly', { day: 5 }))).toBeInTheDocument();
    expect(within(lombardia).getByTestId('istat-region-portal-link-03')).toHaveAttribute('href', 'https://ross1000.example.com/guida');

    // The autonomous province has its own row, named with its plate code, and what the staff verified says so.
    const bolzano = screen.getByTestId('istat-region-row-04-BZ');
    expect(bolzano).toHaveTextContent('Bolzano (BZ)');
    expect(within(bolzano).getByTestId('istat-region-coverage-04-BZ')).toHaveTextContent(text('istatRegions.coverage.Covered'));
    expect(within(bolzano).getByTestId('istat-region-verified-04-BZ')).toHaveTextContent('10/11/2026');
    expect(within(bolzano).getByTestId('istat-region-system-04-BZ')).toHaveTextContent(text('istatRegions.notStated'));
    expect(screen.getByTestId('istat-regions-summary')).toHaveTextContent(text('istatRegions.summary', { pending: 1, total: 2 }));
  });

  it('IstatRegionsPage_AddressThatIsNotHttps_IsNeverALink', async () => {
    table = [{ ...LOMBARDIA, portalUrl: 'javascript:alert(1)', sourceUrl: 'http://fonte.example.com' }];
    renderPage();

    const row = await screen.findByTestId('istat-region-row-03');
    expect(row.querySelector('a[href]')).toBeNull();
  });

  it('IstatRegionsPage_ReadFails_IsAnErrorWithRetryAndShowsNoRows', async () => {
    vi.mocked(istatApi.listRegions).mockRejectedValueOnce(problem(500));
    renderPage();

    const error = await screen.findByTestId('istat-regions-error');
    expect(error).toHaveTextContent(text('istatRegions.loadError'));
    expect(screen.queryByTestId('istat-regions-table')).not.toBeInTheDocument();

    fireEvent.click(within(error).getByRole('button', { name: text('shared.errorState.retry') }));
    expect(await screen.findByTestId('istat-regions-table')).toBeInTheDocument();
  });

  it('IstatRegionsPage_EditAndSave_SendsEveryValueOfTheRowWithItsSourceAndTheDayOfTheCheck', async () => {
    renderPage();
    const dialog = await openDialog('03');

    // The form starts from the row, and the day of the check starts as today.
    expect(within(dialog).getByTestId('istat-region-system')).toHaveValue('Ross1000');
    expect(within(dialog).getByTestId('istat-region-source')).toHaveValue('https://fonte.example.com/lombardia');
    expect(within(dialog).getByTestId('istat-region-verified-at')).toHaveValue('2026-11-15');
    expect(within(dialog).getByTestId('istat-region-fields-mode')).toHaveValue('toVerify');

    fireEvent.change(within(dialog).getByTestId('istat-region-coverage'), { target: { value: 'NotCovered' } });
    fireEvent.click(within(dialog).getByTestId('istat-region-save'));

    await waitFor(() => expect(istatApi.saveRegion).toHaveBeenCalledTimes(1));
    // A save REPLACES the row: everything it holds goes, so nothing is erased by leaving it out («not verified» stays null, not an empty list).
    expect(istatApi.saveRegion).toHaveBeenCalledWith({
      regionIstatCode: '03',
      provinceCode: null,
      system: 'Ross1000',
      portalUrl: 'https://ross1000.example.com/guida',
      deadlineKind: 'Monthly',
      deadlineDay: 5,
      requiredGuestFields: null,
      octorateCoverage: 'NotCovered',
      sourceUrl: 'https://fonte.example.com/lombardia',
      verifiedAt: '2026-11-15T00:00:00.000Z',
      notes: null,
    });
    await waitFor(() => expect(screen.queryByTestId('istat-region-dialog')).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledTimes(1);
    // The table shows the row as saved: verified today and not covered.
    await waitFor(() => expect(screen.getByTestId('istat-region-coverage-03')).toHaveTextContent(text('istatRegions.coverage.NotCovered')));
    expect(screen.getByTestId('istat-region-verified-03')).toHaveTextContent('15/11/2026');
  });

  it('IstatRegionsPage_EditOfAProvince_KeepsItsFieldsAndNamesTheProvinceInTheRequest', async () => {
    renderPage();
    const dialog = await openDialog('04-BZ');

    expect(within(dialog).getByTestId('istat-region-fields-mode')).toHaveValue('some');
    expect(within(dialog).getByTestId('istat-region-field-TourismType')).toBeChecked();
    expect(within(dialog).getByTestId('istat-region-field-TravelWay')).toBeChecked();
    expect(within(dialog).getByTestId('istat-region-field-EducationLevel')).not.toBeChecked();

    fireEvent.click(within(dialog).getByTestId('istat-region-save'));

    await waitFor(() => expect(istatApi.saveRegion).toHaveBeenCalledTimes(1));
    expect(istatApi.saveRegion).toHaveBeenCalledWith(
      expect.objectContaining({
        regionIstatCode: '04',
        provinceCode: 'BZ',
        deadlineKind: 'Unknown',
        deadlineDay: null,
        requiredGuestFields: ['TourismType', 'TravelWay'],
        octorateCoverage: 'Covered',
        notes: 'Verificata sul sito della Provincia.',
      }),
    );
  });

  it('IstatRegionsPage_SourceThatIsMissingOrNotHttps_IsToldOnTheFieldAndSendsNothing', async () => {
    renderPage();
    const dialog = await openDialog('03');

    fireEvent.change(within(dialog).getByTestId('istat-region-source'), { target: { value: '   ' } });
    fireEvent.change(within(dialog).getByTestId('istat-region-portal'), { target: { value: 'http://portale.example.com' } });
    fireEvent.click(within(dialog).getByTestId('istat-region-save'));

    expect(await within(dialog).findByText(text('istatRegions.errors.sourceRequired'))).toBeInTheDocument();
    expect(within(dialog).getByText(text('istatRegions.errors.portalHttps'))).toBeInTheDocument();
    expect(within(dialog).getByTestId('istat-region-source')).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(within(dialog).getByTestId('istat-region-source'), { target: { value: 'http://fonte.example.com' } });
    fireEvent.change(within(dialog).getByTestId('istat-region-portal'), { target: { value: '' } });
    fireEvent.click(within(dialog).getByTestId('istat-region-save'));

    expect(await within(dialog).findByText(text('istatRegions.errors.sourceHttps'))).toBeInTheDocument();
    expect(istatApi.saveRegion).not.toHaveBeenCalled();
  });

  it('IstatRegionsPage_MonthlyDeadlineWithoutADayOrAListWithNoField_IsToldAndSendsNothing', async () => {
    renderPage();
    const dialog = await openDialog('03');

    fireEvent.change(within(dialog).getByTestId('istat-region-deadline-day'), { target: { value: '' } });
    fireEvent.change(within(dialog).getByTestId('istat-region-fields-mode'), { target: { value: 'some' } });
    fireEvent.click(within(dialog).getByTestId('istat-region-save'));

    expect(await within(dialog).findByText(text('istatRegions.errors.dayInvalid'))).toBeInTheDocument();
    expect(within(dialog).getByTestId('istat-region-fields-error')).toHaveTextContent(text('istatRegions.errors.fieldsNeeded'));
    expect(istatApi.saveRegion).not.toHaveBeenCalled();
  });

  it('IstatRegionsPage_RefusalOfTheServer_IsToldInWordsAndTheFormStaysOpenWithWhatWasTyped', async () => {
    vi.mocked(istatApi.saveRegion).mockRejectedValueOnce(problem(422, { code: 'istat_region_source_invalid' }));
    renderPage();
    const dialog = await openDialog('03');

    fireEvent.change(within(dialog).getByTestId('istat-region-notes'), { target: { value: 'Nota di prova' } });
    fireEvent.click(within(dialog).getByTestId('istat-region-save'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(text('apiErrors.codes.istatRegionSourceInvalid')));
    expect(screen.getByTestId('istat-region-dialog')).toBeInTheDocument();
    expect(within(screen.getByTestId('istat-region-dialog')).getByTestId('istat-region-notes')).toHaveValue('Nota di prova');
    expect(toast.success).not.toHaveBeenCalled();
    // Nothing of the table changed: the row is still «da verificare».
    expect(screen.getByTestId('istat-region-coverage-03')).toHaveTextContent(text('istatRegions.coverage.Unknown'));
  });

  it('IstatRegionsPage_WhileTheSaveIsInFlight_NothingOfTheFormCanBePressedAgain', async () => {
    let finish: (row: IstatRegionRule) => void = () => undefined;
    vi.mocked(istatApi.saveRegion).mockReturnValueOnce(new Promise<IstatRegionRule>((resolve) => (finish = resolve)));
    renderPage();
    const dialog = await openDialog('03');

    fireEvent.click(within(dialog).getByTestId('istat-region-save'));

    await waitFor(() => expect(within(dialog).getByTestId('istat-region-save')).toBeDisabled());
    expect(within(dialog).getByTestId('istat-region-cancel')).toBeDisabled();
    expect(within(dialog).getByTestId('istat-region-coverage')).toBeDisabled();
    fireEvent.click(within(dialog).getByTestId('istat-region-save'));
    expect(istatApi.saveRegion).toHaveBeenCalledTimes(1);

    finish({ ...LOMBARDIA, verifiedAt: '2026-11-15T00:00:00.000Z' });
    await waitFor(() => expect(screen.queryByTestId('istat-region-dialog')).not.toBeInTheDocument());
  });
});
