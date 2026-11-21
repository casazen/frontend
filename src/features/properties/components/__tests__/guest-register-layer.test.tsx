import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { guestRegisterApi } from '@/api/guest-register.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import i18n from '@/i18n/config';
import { saveBlobAs } from '@/lib/file-download';
import { expectNoAxeViolations } from '@/test/axe';
import { GUEST_REGISTER_KEY } from '@/queries/guestRegister';
import type { GuestRegisterInfo } from '@/types/guest-register.types';
import { GuestRegisterLayerContent } from '../guest-register-layer';

vi.mock('@/api/guest-register.api', () => ({ guestRegisterApi: { getInfo: vi.fn(), download: vi.fn() } }));
vi.mock('@/lib/file-download', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/file-download')>()), saveBlobAs: vi.fn() }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }) }));
vi.mock('@/queries/use-properties', () => ({
  PROPERTIES_KEY: 'properties',
  useProperty: () => ({ data: { name: 'Casa Sciaffusa' } }),
  useUpdateProperty: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const permissions = vi.hoisted(() => ({ granted: [] as string[] }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (contextKey: string, permission: string) => contextKey === 'short-rent' && permissions.granted.includes(permission) }),
}));

const PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const NOW = '2026-11-21T10:00:00Z';
/** The last 30 days ending today in Zurich. */
const DEFAULT_PERIOD = { from: '2026-10-23', to: '2026-11-21' };
/** What the file of the server looks like: a byte order mark, `;`, CRLF, a quoted cell, and the signature column empty. */
const CSV = [
  'Arrivo;Partenza;Cognome;Nome;Data di nascita;Firma',
  '19.11.2026;22.11.2026;Rossi;Mario;04.01.1984;',
  '19.11.2026;22.11.2026;"Verdi; Bianchi";Anna;12.05.1990;',
  '',
].join('\r\n');

function infoOf(overrides: Partial<GuestRegisterInfo> = {}): GuestRegisterInfo {
  return { propertyId: PROPERTY_ID, ...DEFAULT_PERIOD, rowCount: 2, retentionYears: 5, regimeCode: 'CH-TI', ...overrides };
}

function apiError(status: number, code?: string) {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('failed', String(status), config, undefined, { status, statusText: '', headers: {}, config, data: code ? { code } : {} });
}

function renderLayer({ flagOn = true, id = PROPERTY_ID }: { flagOn?: boolean; id?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const close = vi.fn();
  const view = render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, guestRegistrationRegimes: flagOn }, isLoading: false }}>
        <GuestRegisterLayerContent id={id} close={close} />
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
  return { client, close, ...view };
}

const dateField = (which: 'from' | 'to') => screen.getByTestId(`guest-register-${which}`) as HTMLInputElement;

beforeEach(async () => {
  vi.clearAllMocks();
  // Only the clock is held still: the timers stay real, so that React and the queries settle by themselves.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  permissions.granted = ['guest.read', 'booking.read'];
  await i18n.changeLanguage('it');
  vi.mocked(guestRegisterApi.getInfo).mockResolvedValue(infoOf());
  vi.mocked(guestRegisterApi.download).mockResolvedValue({
    blob: new Blob([`\uFEFF${CSV}`], { type: 'text/csv' }),
    contentDisposition: 'attachment; filename=registro-ospiti-ch-2026-10-23-2026-11-21.csv',
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('GuestRegisterLayer, the guest register of a property in Switzerland (E31/F02/US02/T01, NF-130)', () => {
  describe('the period and the count', () => {
    it('GuestRegisterLayer_Opens_OnTheLast30DaysEndingTodayAndSaysHowManyGuestsAndHowLongToKeepIt', async () => {
      renderLayer();

      expect(await screen.findByTestId('guest-register-count')).toHaveTextContent('2 ospiti arrivati nel periodo');
      expect(dateField('from').value).toBe(DEFAULT_PERIOD.from);
      expect(dateField('to').value).toBe(DEFAULT_PERIOD.to);
      expect(guestRegisterApi.getInfo).toHaveBeenCalledWith(PROPERTY_ID, DEFAULT_PERIOD);
      expect(screen.getByTestId('guest-register-retention')).toHaveTextContent('Da conservare almeno 5 anni, secondo le fonti del tuo cantone.');
      // The register is the host's own responsibility and not legal advice; nothing is sent to anybody.
      expect(screen.getByTestId('guest-register-responsibility')).toHaveTextContent(/una tua responsabilità.*non dà consulenza legale.*comune o la polizia/);
    });

    it('GuestRegisterLayer_AnotherPeriod_AsksTheCountOfThatPeriod', async () => {
      renderLayer();
      await screen.findByTestId('guest-register-count');

      fireEvent.change(dateField('from'), { target: { value: '2026-09-01' } });
      fireEvent.change(dateField('to'), { target: { value: '2026-09-30' } });

      await waitFor(() => expect(guestRegisterApi.getInfo).toHaveBeenLastCalledWith(PROPERTY_ID, { from: '2026-09-01', to: '2026-09-30' }));
    });

    it.each([
      ['more than 366 days', { from: '2025-01-01', to: '2026-01-02' }, 'Il periodo può durare al massimo 366 giorni.'],
      ['an end before the start', { from: '2026-11-21', to: '2026-11-01' }, "L'ultimo giorno non può venire prima del primo."],
    ])('GuestRegisterLayer_%s_IsToldAndNothingIsAskedOfTheServer', async (_what, period, text) => {
      renderLayer();
      await screen.findByTestId('guest-register-count');

      fireEvent.change(dateField('from'), { target: { value: period.from } });
      fireEvent.change(dateField('to'), { target: { value: period.to } });

      expect(await screen.findByText(text)).toBeInTheDocument();
      expect(screen.queryByTestId('guest-register-count')).not.toBeInTheDocument();
      expect(screen.getByTestId('guest-register-download')).toBeDisabled();
      expect(screen.getByTestId('guest-register-print')).toBeDisabled();
      expect(vi.mocked(guestRegisterApi.getInfo)).not.toHaveBeenCalledWith(PROPERTY_ID, period);
    });

    it('GuestRegisterLayer_ADayStillBeingTyped_IsNotAMistakeAndTheButtonsWait', async () => {
      renderLayer();
      await screen.findByTestId('guest-register-count');

      fireEvent.change(dateField('to'), { target: { value: '' } });

      expect(screen.getByTestId('guest-register-download')).toBeDisabled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('GuestRegisterLayer_APeriodWithNoGuest_SaysNobodyArrivedAndThereIsNothingToKeepOrPrint', async () => {
      vi.mocked(guestRegisterApi.getInfo).mockResolvedValue(infoOf({ rowCount: 0 }));
      renderLayer();

      expect(await screen.findByTestId('guest-register-count')).toHaveTextContent('Nessun ospite è arrivato in questo periodo');
      expect(screen.getByTestId('guest-register-download')).toBeDisabled();
      expect(screen.getByTestId('guest-register-print')).toBeDisabled();
    });

    it('GuestRegisterLayer_ACantonWhoseSourcesGiveNoNumberOfYears_SendsTheHostToCheckAndNeverMakesOneUp', async () => {
      vi.mocked(guestRegisterApi.getInfo).mockResolvedValue(infoOf({ retentionYears: null, regimeCode: 'CH-ZH' }));
      renderLayer();

      const retention = await screen.findByTestId('guest-register-retention');
      expect(retention).toHaveTextContent('Le fonti non indicano per quanto tempo conservarlo: verifica con il comune o la polizia.');
      expect(retention.textContent).not.toMatch(/\d+ ann/);
    });

    it('GuestRegisterLayer_APlaceThatIsNotKnown_SaysItHasNoCantonYetButStillHasTheRegister', async () => {
      vi.mocked(guestRegisterApi.getInfo).mockResolvedValue(infoOf({ retentionYears: null, regimeCode: 'CH-UNKNOWN' }));
      renderLayer();

      expect(await screen.findByTestId('guest-register-retention')).toHaveTextContent(/Non sappiamo in quale comune/);
      expect(screen.getByTestId('guest-register-download')).toBeEnabled();
    });

    it('GuestRegisterLayer_AGuestWhoCompletesTheCheckIn_ReadsTheCountAgainWithoutAReload', async () => {
      const { client } = renderLayer();
      await screen.findByTestId('guest-register-count');
      vi.mocked(guestRegisterApi.getInfo).mockResolvedValue(infoOf({ rowCount: 3 }));

      // What `use-notifications-realtime.ts` does for a check-in completed: the count is under the root the event reads again.
      await act(async () => {
        await client.invalidateQueries({ queryKey: [GUEST_REGISTER_KEY] });
      });

      await waitFor(() => expect(screen.getByTestId('guest-register-count')).toHaveTextContent('3 ospiti arrivati nel periodo'));
    });
  });

  describe('the CSV', () => {
    it('GuestRegisterLayer_Download_SavesTheFileOfThePeriodUnderTheNameOfTheServerInTheLanguageOfThePage', async () => {
      renderLayer();
      const button = await screen.findByTestId('guest-register-download');
      await waitFor(() => expect(button).toBeEnabled());

      fireEvent.click(button);

      await waitFor(() => expect(guestRegisterApi.download).toHaveBeenCalledWith(PROPERTY_ID, DEFAULT_PERIOD, 'it'));
      await waitFor(() => expect(saveBlobAs).toHaveBeenCalledWith(expect.any(Blob), 'registro-ospiti-ch-2026-10-23-2026-11-21.csv'));
      expect(toast.success).toHaveBeenCalledWith(i18n.t('guestRegister.download.done'));
    });

    it('GuestRegisterLayer_TheServerGivesNoName_TheFileIsSavedUnderTheNameItWouldHaveGiven', async () => {
      vi.mocked(guestRegisterApi.download).mockResolvedValue({ blob: new Blob([CSV]), contentDisposition: null });
      renderLayer();
      const button = await screen.findByTestId('guest-register-download');
      await waitFor(() => expect(button).toBeEnabled());

      fireEvent.click(button);

      await waitFor(() => expect(saveBlobAs).toHaveBeenCalledWith(expect.any(Blob), 'registro-ospiti-ch-2026-10-23-2026-11-21.csv'));
    });

    it('GuestRegisterLayer_ARefusedDownload_IsToldWithTheWordsOfItsCodeAndTheButtonsComeBack', async () => {
      vi.mocked(guestRegisterApi.download).mockRejectedValue(apiError(422, 'csv_too_many_rows'));
      renderLayer();
      const button = await screen.findByTestId('guest-register-download');
      await waitFor(() => expect(button).toBeEnabled());

      fireEvent.click(button);

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.csvTooManyRows')));
      await waitFor(() => expect(screen.getByTestId('guest-register-download')).toBeEnabled());
      expect(saveBlobAs).not.toHaveBeenCalled();
    });

    it('GuestRegisterLayer_WhileTheFileIsOnItsWay_BothButtonsWait', async () => {
      vi.mocked(guestRegisterApi.download).mockReturnValue(new Promise(() => undefined));
      renderLayer();
      const button = await screen.findByTestId('guest-register-download');
      await waitFor(() => expect(button).toBeEnabled());

      fireEvent.click(button);

      await waitFor(() => expect(screen.getByTestId('guest-register-print')).toBeDisabled());
      expect(screen.getByTestId('guest-register-download')).toBeDisabled();
      expect(screen.getByTestId('guest-register-layer')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('the print view', () => {
    it('GuestRegisterLayer_Print_DrawsTheTableWithAnEmptySignatureColumnTheNameOfThePropertyAndThePeriodBeforeThePrinterSeesIt', async () => {
      let seen: { sheet: boolean; header: string[]; rows: string[][]; property: string; period: string } | null = null;
      vi.spyOn(window, 'print').mockImplementation(() => {
        const sheet = document.querySelector('.guest-register-sheet');
        seen = {
          sheet: sheet !== null,
          header: Array.from(sheet?.querySelectorAll('thead th') ?? []).map((cell) => cell.textContent ?? ''),
          rows: Array.from(sheet?.querySelectorAll('tbody tr') ?? []).map((row) => Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent ?? '')),
          property: sheet?.querySelector('[data-testid="guest-register-sheet-property"]')?.textContent ?? '',
          period: sheet?.querySelector('[data-testid="guest-register-sheet-period"]')?.textContent ?? '',
        };
      });
      renderLayer();
      const button = await screen.findByTestId('guest-register-print');
      await waitFor(() => expect(button).toBeEnabled());

      fireEvent.click(button);

      await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
      expect(guestRegisterApi.download).toHaveBeenCalledWith(PROPERTY_ID, DEFAULT_PERIOD, 'it');
      // The sheet was in the page when the printer was asked: the columns of the file (the last one the signature), one line for each guest, and the signature cells empty.
      expect(seen).toEqual({
        sheet: true,
        header: ['Arrivo', 'Partenza', 'Cognome', 'Nome', 'Data di nascita', 'Firma'],
        rows: [
          ['19.11.2026', '22.11.2026', 'Rossi', 'Mario', '04.01.1984', ''],
          ['19.11.2026', '22.11.2026', 'Verdi; Bianchi', 'Anna', '12.05.1990', ''],
        ],
        property: 'Casa Sciaffusa',
        period: 'Dal 23 ottobre 2026 al 21 novembre 2026',
      });
      expect(screen.getByTestId('guest-register-signature-header')).toHaveTextContent('Firma');
    });

    it('GuestRegisterLayer_ThePrintIsOver_TakesTheGuestsOutOfThePageAndNothingIsKeptInTheMutations', async () => {
      vi.spyOn(window, 'print').mockImplementation(() => undefined);
      const { client } = renderLayer();
      const button = await screen.findByTestId('guest-register-print');
      await waitFor(() => expect(button).toBeEnabled());
      fireEvent.click(button);
      await waitFor(() => expect(document.querySelector('.guest-register-sheet')).not.toBeNull());
      // What the mutation kept is nothing: the table lives in the page for the printer and not a moment longer.
      expect(client.getMutationCache().getAll().every((mutation) => mutation.state.data === undefined)).toBe(true);

      act(() => {
        window.dispatchEvent(new Event('afterprint'));
      });

      expect(document.querySelector('.guest-register-sheet')).toBeNull();
      expect(document.body.textContent).not.toContain('Rossi');
    });

    it('GuestRegisterLayer_TheLayerClosedWhileTheSheetIsInThePage_TakesTheGuestsWithIt', async () => {
      vi.spyOn(window, 'print').mockImplementation(() => undefined);
      const { unmount } = renderLayer();
      const button = await screen.findByTestId('guest-register-print');
      await waitFor(() => expect(button).toBeEnabled());
      fireEvent.click(button);
      await waitFor(() => expect(document.querySelector('.guest-register-sheet')).not.toBeNull());

      unmount();

      expect(document.querySelector('.guest-register-sheet')).toBeNull();
    });

    // A request is not cancelled when the layer is closed: the file that arrives afterwards finds no sheet to draw, and the browser must not print the page behind it.
    it('GuestRegisterLayer_TheLayerClosedWhileTheFileIsOnItsWay_PrintsNothingWhenTheFileArrives', async () => {
      const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
      let deliver: (file: { blob: Blob; contentDisposition: string | null }) => void = () => undefined;
      vi.mocked(guestRegisterApi.download).mockReturnValue(new Promise((resolve) => (deliver = resolve)));
      const { client, unmount } = renderLayer();
      const button = await screen.findByTestId('guest-register-print');
      await waitFor(() => expect(button).toBeEnabled());
      fireEvent.click(button);
      await waitFor(() => expect(guestRegisterApi.download).toHaveBeenCalledTimes(1));
      const mutation = client.getMutationCache().getAll()[0];

      // The host closes the layer while the file is on its way; the file arrives afterwards and the request runs to its end.
      unmount();
      deliver({ blob: new Blob([`\uFEFF${CSV}`], { type: 'text/csv' }), contentDisposition: null });
      await waitFor(() => expect(mutation.state.status).toBe('success'));

      expect(print).not.toHaveBeenCalled();
      expect(document.querySelector('.guest-register-sheet')).toBeNull();
    });

    it('GuestRegisterLayer_AFailedPrint_IsToldAndNothingIsPrinted', async () => {
      const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
      vi.mocked(guestRegisterApi.download).mockRejectedValue(apiError(500));
      renderLayer();
      const button = await screen.findByTestId('guest-register-print');
      await waitFor(() => expect(button).toBeEnabled());

      fireEvent.click(button);

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('guestRegister.print.failed')));
      expect(print).not.toHaveBeenCalled();
      expect(document.querySelector('.guest-register-sheet')).toBeNull();
    });
  });

  describe('what the layer tells when the register cannot be shown', () => {
    it('GuestRegisterLayer_TheModuleIsOff_SaysSoAndAsksNothingOfTheServer', () => {
      renderLayer({ flagOn: false });

      expect(screen.getByTestId('guest-register-unavailable')).toBeInTheDocument();
      expect(guestRegisterApi.getInfo).not.toHaveBeenCalled();
    });

    it.each([['guest.read'], ['booking.read']])('GuestRegisterLayer_WithoutThePermission_%s_AsksNothingOfTheServer', (missing) => {
      permissions.granted = ['guest.read', 'booking.read'].filter((permission) => permission !== missing);
      renderLayer();

      expect(screen.getByTestId('guest-register-problem')).toHaveTextContent(i18n.t('guestRegister.layer.forbidden'));
      expect(guestRegisterApi.getInfo).not.toHaveBeenCalled();
    });

    it('GuestRegisterLayer_AnIdThatIsNotAnAddressOfTheLayer_SaysItCannotFindItAndAsksNothing', () => {
      renderLayer({ id: '../admin' });

      expect(screen.getByTestId('guest-register-problem')).toHaveTextContent(i18n.t('guestRegister.layer.notFound'));
      expect(guestRegisterApi.getInfo).not.toHaveBeenCalled();
    });

    it.each([
      [404, 'guest_register_not_available', 'guestRegister.layer.notAvailable'],
      [404, 'property_not_found', 'guestRegister.layer.notFound'],
      [403, undefined, 'guestRegister.layer.forbidden'],
    ])('GuestRegisterLayer_A%sOfTheServer_%s_IsToldAsSuchAndNeverAsTheCountOfAMomentAgo', async (status, code, key) => {
      const { client } = renderLayer();
      await screen.findByTestId('guest-register-count');
      // The count is in the cache: the next read is refused, and the refusal comes first (the cache keeps the old answer of a read that fails).
      vi.mocked(guestRegisterApi.getInfo).mockRejectedValue(apiError(status, code));
      await act(async () => {
        await client.refetchQueries({ queryKey: [GUEST_REGISTER_KEY, PROPERTY_ID] });
      });

      expect(await screen.findByTestId('guest-register-problem')).toHaveTextContent(i18n.t(key));
      expect(screen.queryByTestId('guest-register-layer')).not.toBeInTheDocument();
    });

    it('GuestRegisterLayer_AFailureOfTheLineWithTheCountOnScreen_KeepsTheCountWithALineToReadItAgain', async () => {
      const { client } = renderLayer();
      await screen.findByTestId('guest-register-count');
      vi.mocked(guestRegisterApi.getInfo).mockRejectedValue(apiError(500));
      await act(async () => {
        await client.refetchQueries({ queryKey: [GUEST_REGISTER_KEY, PROPERTY_ID] });
      });

      expect(await screen.findByTestId('guest-register-stale')).toBeInTheDocument();
      expect(screen.getByTestId('guest-register-count')).toHaveTextContent('2 ospiti');
      // What the person typed (the period) goes nowhere.
      expect(dateField('from').value).toBe(DEFAULT_PERIOD.from);
    });

    it('GuestRegisterLayer_AFailureOfTheLineWithNoCount_IsAnErrorWithARetryAndThePeriodStaysAsItWas', async () => {
      vi.mocked(guestRegisterApi.getInfo).mockRejectedValue(apiError(500));
      renderLayer();

      expect(await screen.findByTestId('guest-register-error')).toBeInTheDocument();
      expect(dateField('to').value).toBe(DEFAULT_PERIOD.to);
      expect(screen.getByTestId('guest-register-download')).toBeDisabled();
      vi.mocked(guestRegisterApi.getInfo).mockResolvedValue(infoOf());
      fireEvent.click(within(screen.getByTestId('guest-register-error')).getByRole('button'));
      expect(await screen.findByTestId('guest-register-count')).toBeInTheDocument();
    });

    it('GuestRegisterLayer_ThePeriodTheCountAndTheButtons_HaveNoAccessibilityViolation', async () => {
      const { container } = renderLayer();
      await screen.findByTestId('guest-register-count');

      await expectNoAxeViolations(container);
    });

    it('GuestRegisterLayer_TheTexts_SayItIsNotLegalAdviceAndNameNoSupplier', async () => {
      renderLayer();
      await screen.findByTestId('guest-register-count');

      expect(document.body.textContent ?? '').toMatch(/consulenza legale/);
      expect(document.body.textContent ?? '').not.toMatch(/hoko|unisys|u-stay|feratel|chekin|stellar\s*check-?in|chargeautomation|smoobu|lodgify|octorate|concordato\s*facile|\bavs\b/i);
    });
  });
});
