import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { alloggiatiApi } from '@/api/alloggiati.api';
import { swissComplianceApi } from '@/api/swissCompliance.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { COMPLIANCE_KEY } from '@/features/compliance/use-compliance';
import i18n from '@/i18n/config';
import { SWISS_NOTIFICATION_KEY } from '@/queries/swissCompliance';
import { expectNoAxeViolations } from '@/test/axe';
import { SwissLayerContent } from '../swiss-notification-layer';
import { SWISS_BOOKING_ID, SWISS_DAY, SWISS_OTHER_BOOKING_ID, SWISS_OTHER_DAY, SWISS_PROPERTY_ID, declaredSwissDay, swissDay, swissGuest } from './swiss-fixtures';

vi.mock('@/api/swissCompliance.api', () => ({
  swissComplianceApi: { getSwissDay: vi.fn(), declareSwissDay: vi.fn(), undeclareSwissDay: vi.fn() },
}));
vi.mock('@/api/alloggiati.api', () => ({ alloggiatiApi: { getGuestSummary: vi.fn() } }));
// The host form of the guests is not what is asked here: the layer opens it for a stay and gets it back when it closes.
vi.mock('@/features/alloggiati/components/stay-guests-edit-dialog', () => ({
  StayGuestsEditDialog: ({ bookingId, onOpenChange }: { bookingId: string; onOpenChange: (open: boolean) => void }) => (
    <div data-testid="stay-guests-edit-dialog">
      {bookingId}
      <button type="button" onClick={() => onOpenChange(false)}>
        chiudi-ospiti
      </button>
    </div>
  ),
}));
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

const EVERYTHING = ['guest.read', 'booking.read', 'alloggiati.submit', 'booking.write'];
const writeText = vi.fn();

function apiError(status: number, code?: string) {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('failed', String(status), config, undefined, { status, statusText: '', headers: {}, config, data: code ? { code } : {} });
}

function renderLayer(id = `${SWISS_PROPERTY_ID}:${SWISS_DAY}`, { flagOn = true }: { flagOn?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const close = vi.fn();
  const view = render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, guestRegistrationRegimes: flagOn }, isLoading: false }}>
        <MemoryRouter>
          <SwissLayerContent id={id} close={close} />
        </MemoryRouter>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
  return { client, close, ...view };
}

const stepOf = (step: string) => screen.getByTestId(`swiss-step-${step}`);
const isOpen = (step: string) => stepOf(step).getAttribute('data-open') === 'true';
/** Opens a step the way a person does: by its line, unless it is open already (pressing the open one closes it). */
function openStep(step: string) {
  if (!isOpen(step)) fireEvent.click(screen.getByTestId(`swiss-step-${step}-toggle`));
}

beforeEach(async () => {
  vi.clearAllMocks();
  // Only the clock is held still (the instant the day is read at): the timers stay real, so that React and the queries settle by themselves.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-19T20:30:00Z'));
  permissions.granted = [...EVERYTHING];
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  await i18n.changeLanguage('it');
  vi.mocked(swissComplianceApi.getSwissDay).mockResolvedValue(swissDay());
  vi.mocked(swissComplianceApi.declareSwissDay).mockResolvedValue({
    propertyId: SWISS_PROPERTY_ID,
    arrivalDay: SWISS_DAY,
    regimeCode: 'CH-SH',
    declaredAt: '2026-11-19T20:30:00Z',
    declaredBy: 'Luca Bianchi',
    created: true,
  });
  vi.mocked(swissComplianceApi.undeclareSwissDay).mockResolvedValue(undefined);
  vi.mocked(alloggiatiApi.getGuestSummary).mockResolvedValue({ guests: [], missingCodeTables: [], arrivalDate: SWISS_DAY } as never);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SwissNotificationLayer, the assisted notification of the guests of another canton (E31/F02/US02/T02, NF-131)', () => {
  describe('the day and what the canton asks', () => {
    it('SwissLayer_DayToNotify_OpensOnTheGuestsWithTheThreeStepsTheDeadlineAndWhatTheCantonAsks', async () => {
      renderLayer();

      expect(await screen.findByTestId('swiss-layer')).toBeInTheDocument();
      expect(screen.getByTestId('swiss-day-title')).toHaveTextContent('Arrivi di giovedì 19 novembre');
      // The deadline in words, from `dueAt` (02:00 of the next night, in the time of Switzerland).
      expect(screen.getByTestId('swiss-day-state')).toHaveTextContent(/Da notificare entro venerdì 20 novembre.*02:00/);
      expect(isOpen('guests')).toBe(true);
      expect(stepOf('guests')).toHaveAttribute('data-state', 'done');
      expect(within(screen.getByTestId('swiss-steps')).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
        expect.stringContaining('Ospiti'),
        expect.stringContaining('Apri il portale'),
        expect.stringContaining('Ho notificato'),
      ]);
      // What the canton asks, in the words of the regime, with how sure the source is (never in red) and the sentence that sends the host to check.
      const canton = screen.getByTestId('swiss-canton');
      expect(canton).toHaveTextContent('Cosa chiede il cantone SH');
      expect(canton).toHaveTextContent(i18n.t('guestRegistration.channel.PortalForm'));
      expect(canton).toHaveTextContent('Invio giornaliero entro le 02:00.');
      expect(canton).toHaveAttribute('data-certainty', 'Partial');
      expect(screen.getByTestId('swiss-certainty')).toHaveTextContent(i18n.t('guestRegistration.certainty.Partial.label'));
      expect(canton).toHaveTextContent(/Verifica con il comune o la polizia/);
      expect(swissComplianceApi.getSwissDay).toHaveBeenCalledWith(SWISS_PROPERTY_ID, SWISS_DAY);
    });

    it('SwissLayer_NoDayInTheAddress_AsksTheFirstDayToNotifyAndOpensOnThatOne', async () => {
      vi.mocked(swissComplianceApi.getSwissDay).mockResolvedValue(swissDay({ day: SWISS_OTHER_DAY }));
      renderLayer(SWISS_PROPERTY_ID);

      expect(await screen.findByTestId('swiss-day-title')).toHaveTextContent('Arrivi di mercoledì 18 novembre');
      expect(swissComplianceApi.getSwissDay).toHaveBeenCalledWith(SWISS_PROPERTY_ID, undefined);
    });

    // The sources of Fribourg, Thurgau, Zurich (and the daily regimes with no time) give no deadline: a time is never made up.
    it('SwissLayer_ACantonWithNoDeadline_SaysTheDeadlineIsNotKnownAndNeverShowsATime', async () => {
      vi.mocked(swissComplianceApi.getSwissDay).mockResolvedValue(swissDay({ dueAt: null, deadlineKind: 'None', deadlineNote: null, pendingDays: [{ day: SWISS_DAY, stayCount: 1, dueAt: null }] }));
      renderLayer();

      const state = await screen.findByTestId('swiss-day-state');
      expect(state).toHaveTextContent(/Scadenza non nota/);
      expect(state.textContent).not.toMatch(/\d{2}:\d{2}/);
      expect(screen.getByTestId('swiss-canton-deadline')).toHaveTextContent(i18n.t('guestRegistration.deadline.None'));
    });

    it('SwissLayer_ThePassedDeadline_SaysTheDeadlineIsOver', async () => {
      vi.setSystemTime(new Date('2026-11-21T09:00:00Z'));
      renderLayer();

      expect(await screen.findByTestId('swiss-day-state')).toHaveTextContent(/La scadenza per notificare questo giorno è passata/);
    });

    it.each([
      ['Verified', 'Verificato'],
      ['Unverified', 'Non verificato'],
    ] as const)('SwissLayer_Certainty%s_IsAWordAndNeverAnAlarm', async (certainty, word) => {
      vi.mocked(swissComplianceApi.getSwissDay).mockResolvedValue(swissDay({ certainty }));
      renderLayer();

      const badge = await screen.findByTestId('swiss-certainty');
      expect(badge).toHaveTextContent(word);
      expect(badge.className).not.toMatch(/danger|destructive|red/);
      expect(screen.getByTestId('swiss-canton')).toHaveTextContent(/consulenza legale/);
    });

    it('SwissLayer_ACertaintyThisVersionDoesNotKnow_ReadsAsNotVerified', async () => {
      vi.mocked(swissComplianceApi.getSwissDay).mockResolvedValue(swissDay({ certainty: 'Maybe' as never }));
      renderLayer();

      expect(await screen.findByTestId('swiss-canton')).toHaveAttribute('data-certainty', 'Unverified');
      expect(document.body.textContent).not.toContain('Maybe');
    });

    it('SwissLayer_TheHostWhoMayChooseOrAnsweredNo_IsToldInOneLine', async () => {
      vi.mocked(swissComplianceApi.getSwissDay).mockResolvedValue(swissDay({ effectiveDuty: 'Ask' }));
      const first = renderLayer();
      expect(await screen.findByTestId('swiss-duty')).toHaveTextContent(/decidi tu/);
      first.unmount();

      vi.mocked(swissComplianceApi.getSwissDay).mockResolvedValue(swissDay({ effectiveDuty: 'NotRequired', pendingDays: [] }));
      renderLayer();
      expect(await screen.findByTestId('swiss-duty')).toHaveTextContent(/non devi notificare/);
    });

    it('SwissLayer_ADayWithNoArrival_SaysSoAndShowsNoStep', async () => {
      vi.mocked(swissComplianceApi.getSwissDay).mockResolvedValue(swissDay({ stayCount: 0, guests: [], pendingDays: [] }));
      renderLayer();

      expect(await screen.findByTestId('swiss-day-state')).toHaveTextContent('Nessun arrivo in questo giorno.');
      expect(screen.queryByTestId('swiss-steps')).not.toBeInTheDocument();
    });

    it('SwissLayer_OtherDaysToNotify_AreOneButtonEachAndLoadThatDay', async () => {
      vi.mocked(swissComplianceApi.getSwissDay).mockImplementation(async (_property, date) =>
        date === SWISS_OTHER_DAY
          ? swissDay({ day: SWISS_OTHER_DAY })
          : swissDay({ pendingDays: [{ day: SWISS_OTHER_DAY, stayCount: 1, dueAt: '2026-11-19T01:00:00Z' }, { day: SWISS_DAY, stayCount: 1, dueAt: '2026-11-20T01:00:00Z' }] }),
      );
      renderLayer();

      const others = await screen.findByTestId('swiss-other-days');
      expect(within(others).getAllByTestId('swiss-pick-day')).toHaveLength(1);
      fireEvent.click(within(others).getByTestId('swiss-pick-day'));

      await waitFor(() => expect(screen.getByTestId('swiss-day-title')).toHaveTextContent('Arrivi di mercoledì 18 novembre'));
      expect(swissComplianceApi.getSwissDay).toHaveBeenLastCalledWith(SWISS_PROPERTY_ID, SWISS_OTHER_DAY);
    });
  });

  describe('step 1: the guests as data ready to copy', () => {
    const twoGuests = () =>
      swissDay({ guests: [swissGuest(), swissGuest({ position: 1, firstName: 'Anna', lastName: 'Verdi', documentNumber: 'CA7654321', plate: null })] });

    it('SwissLayer_EveryFieldOfEveryGuest_HasItsOwnButtonThatCopiesItsValue', async () => {
      vi.mocked(swissComplianceApi.getSwissDay).mockResolvedValue(twoGuests());
      renderLayer();

      const blocks = await screen.findAllByTestId('swiss-guest');
      expect(blocks).toHaveLength(2);
      // The first guest has the 15 fields of the day, each with a button named after the field and the guest; the second has no plate, so no button for it.
      expect(within(blocks[0]).getAllByTestId(/^swiss-copy-(?!all)/)).toHaveLength(15);
      expect(within(blocks[1]).getAllByTestId(/^swiss-copy-(?!all)/)).toHaveLength(14);
      expect(within(blocks[1]).queryByTestId('swiss-copy-plate')).not.toBeInTheDocument();

      fireEvent.click(within(blocks[0]).getByRole('button', { name: 'Copia Numero del documento: Mario Rossi' }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith('YA1234567'));
      fireEvent.click(within(blocks[1]).getByRole('button', { name: 'Copia Data di nascita: Anna Verdi' }));
      await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('04.01.1984'));
      // The words and the dates are the ones a person pastes: the document as a word, the day as the Swiss write it.
      expect(within(blocks[0]).getByTestId('swiss-field-documentType-value')).toHaveTextContent('Passaporto');
      expect(within(blocks[0]).getByTestId('swiss-field-birthDate-value')).toHaveTextContent('04.01.1984');
    });

    it('SwissLayer_CopyEverythingOfAGuest_PutsALineForEachFieldOnTheClipboard', async () => {
      renderLayer();

      const block = await screen.findByTestId('swiss-guest');
      fireEvent.click(within(block).getByTestId('swiss-copy-all'));

      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      const text = writeText.mock.calls[0][0] as string;
      expect(text.split('\n')).toHaveLength(15);
      expect(text).toContain('Cognome: Rossi');
      expect(text).toContain('Numero del documento: YA1234567');
      expect(text).toContain('Arrivo: 19.11.2026');
    });

    it('SwissLayer_NoClipboard_SaysSoAndTheValueIsStillOnTheScreen', async () => {
      writeText.mockRejectedValue(new Error('denied'));
      renderLayer();

      const block = await screen.findByTestId('swiss-guest');
      fireEvent.click(within(block).getByTestId('swiss-copy-lastName'));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('swissNotification.copy.failed'), expect.anything()));
      expect(within(block).getByTestId('swiss-field-lastName-value')).toHaveTextContent('Rossi');
    });

    it('SwissLayer_AGuestThatMissesData_IsListedWithWhatItMissesAndCompleteDataOpensTheFormInsideTheLayer', async () => {
      vi.mocked(swissComplianceApi.getSwissDay).mockResolvedValue(
        swissDay({
          guests: [swissGuest({ bookingId: SWISS_OTHER_BOOKING_ID, firstName: 'Anna', lastName: 'Verdi', birthDate: null, documentType: null })],
          issues: [{ bookingId: SWISS_OTHER_BOOKING_ID, position: 0, guestName: 'Anna Verdi', missing: ['birthDate', 'documentType'] }],
        }),
      );
      renderLayer();

      await screen.findByTestId('swiss-layer');
      expect(stepOf('guests')).toHaveAttribute('data-state', 'attention');
      expect(screen.getByTestId('swiss-issues')).toHaveTextContent('Anna Verdi: data di nascita, tipo di documento');
      // The guest is listed with what the check-in has: nothing is made up for the two fields that are missing.
      expect(screen.queryByTestId('swiss-copy-birthDate')).not.toBeInTheDocument();
      expect(screen.queryByTestId('swiss-copy-documentType')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('swiss-complete-guest'));
      expect(await screen.findByTestId('stay-guests-edit-dialog')).toHaveTextContent(SWISS_OTHER_BOOKING_ID);
      // The layer is still there under the form, and it reads the day again when the form closes.
      expect(screen.getByTestId('swiss-layer')).toBeInTheDocument();
      const reads = vi.mocked(swissComplianceApi.getSwissDay).mock.calls.length;
      fireEvent.click(screen.getByText('chiudi-ospiti'));
      await waitFor(() => expect(vi.mocked(swissComplianceApi.getSwissDay).mock.calls.length).toBeGreaterThan(reads));
      expect(screen.queryByTestId('stay-guests-edit-dialog')).not.toBeInTheDocument();
    });

    it('SwissLayer_WhoMayNotWriteTheBookings_IsLedToTheBookingInsteadOfTheForm', async () => {
      permissions.granted = ['guest.read', 'booking.read', 'alloggiati.submit'];
      vi.mocked(swissComplianceApi.getSwissDay).mockResolvedValue(
        swissDay({ issues: [{ bookingId: SWISS_BOOKING_ID, position: 0, guestName: 'Mario Rossi', missing: ['nationality'] }] }),
      );
      renderLayer();

      const link = await screen.findByRole('link', { name: 'Apri la prenotazione: Mario Rossi' });
      expect(link).toHaveAttribute('href', `/app/short-rent/bookings/${SWISS_BOOKING_ID}?tab=alloggiati`);
      expect(screen.queryByTestId('swiss-complete-guest')).not.toBeInTheDocument();
    });
  });

  describe('step 2: the portal, the one way out', () => {
    it('SwissLayer_ThePortalLink_OpensInANewTabAndTheLayerLandsOnTheDeclarationWhenThePersonIsBack', async () => {
      renderLayer();
      await screen.findByTestId('swiss-layer');
      openStep('portal');

      const link = screen.getByTestId('swiss-portal-link');
      expect(link).toHaveAttribute('href', 'https://gast.sh.ch/meldung');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
      expect(link).toHaveTextContent('gast.sh.ch');
      // CasaZen never logs into the portal and says so.
      expect(screen.getByTestId('swiss-portal')).toHaveTextContent(/non accede al portale e non conosce le tue credenziali/);

      // The browser opens the tab (the click is not followed here); the layer is on the next step when the person comes back.
      link.addEventListener('click', (event) => event.preventDefault());
      fireEvent.click(link);
      await waitFor(() => expect(isOpen('declare')).toBe(true));
    });

    it('SwissLayer_ACantonWithNoPortal_SaysHowItIsDoneAndGoesOnWithoutALink', async () => {
      vi.mocked(swissComplianceApi.getSwissDay).mockResolvedValue(swissDay({ portalUrl: null, channel: 'EmailFile' }));
      renderLayer();
      await screen.findByTestId('swiss-layer');
      openStep('portal');

      expect(screen.queryByTestId('swiss-portal-link')).not.toBeInTheDocument();
      expect(screen.getByTestId('swiss-portal-channel')).toHaveTextContent(i18n.t('guestRegistration.channel.EmailFile'));
      fireEvent.click(screen.getByTestId('swiss-portal-next'));
      await waitFor(() => expect(isOpen('declare')).toBe(true));
    });

    it.each(['http://gast.sh.ch', 'javascript:alert(1)'])('SwissLayer_APortalThatIsNotHttps_%s_IsNeverALink', async (portalUrl) => {
      vi.mocked(swissComplianceApi.getSwissDay).mockResolvedValue(swissDay({ portalUrl }));
      renderLayer();
      await screen.findByTestId('swiss-layer');
      openStep('portal');

      expect(screen.queryByTestId('swiss-portal-link')).not.toBeInTheDocument();
      expect(screen.getByTestId('swiss-portal-none')).toBeInTheDocument();
    });
  });

  describe('step 3: the declaration', () => {
    it('SwissLayer_Declare_ClosesTheDayAndTheCockpitAndTheCounterOfTheMenuReadAgainWithoutAReload', async () => {
      const { client } = renderLayer();
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      await screen.findByTestId('swiss-layer');
      openStep('declare');
      // The day the server picked is the day on screen from the first action on.
      vi.mocked(swissComplianceApi.getSwissDay).mockResolvedValue(declaredSwissDay());

      const button = screen.getByTestId('swiss-declare-button');
      expect(button).toBeEnabled();
      fireEvent.click(button);

      await waitFor(() => expect(swissComplianceApi.declareSwissDay).toHaveBeenCalledWith(SWISS_PROPERTY_ID, { arrivalDay: SWISS_DAY }));
      // The cockpit (its item, and the red number of the menu, which reads the same summary) and the days of the property are read again.
      await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: [COMPLIANCE_KEY] }));
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [SWISS_NOTIFICATION_KEY, SWISS_PROPERTY_ID] });
      await waitFor(() => expect(screen.getByTestId('swiss-day-state')).toHaveTextContent(/Già notificato il 19 novembre.*15:20 da Luca Bianchi\./));
      expect(screen.getByTestId('swiss-declared')).toBeInTheDocument();
      expect(screen.queryByTestId('swiss-declare-button')).not.toBeInTheDocument();
    });

    it('SwissLayer_TheDayDeclaredWhileTheLayerHadNoDayInItsAddress_StaysOnScreenClosedAndDoesNotMoveOnToTheNextDay', async () => {
      // A read without a date always answers the oldest day still to notify: declaring it must not move the layer on to the next one.
      vi.mocked(swissComplianceApi.getSwissDay).mockImplementation(async (_property, date) => {
        if (date === SWISS_DAY) return declaredSwissDay();
        return swissDay({ pendingDays: [{ day: SWISS_DAY, stayCount: 1, dueAt: '2026-11-20T01:00:00Z' }, { day: SWISS_OTHER_DAY, stayCount: 1, dueAt: '2026-11-19T01:00:00Z' }] });
      });
      renderLayer(SWISS_PROPERTY_ID);
      await screen.findByTestId('swiss-layer');
      openStep('declare');

      fireEvent.click(screen.getByTestId('swiss-declare-button'));

      await waitFor(() => expect(screen.getByTestId('swiss-day-state')).toHaveTextContent(/Già notificato/));
      expect(screen.getByTestId('swiss-day-title')).toHaveTextContent('Arrivi di giovedì 19 novembre');
      expect(swissComplianceApi.getSwissDay).toHaveBeenLastCalledWith(SWISS_PROPERTY_ID, SWISS_DAY);
    });

    it('SwissLayer_ADeclaredDay_SaysWhoDeclaredItAndWhenAndTheUndoReopensIt', async () => {
      vi.mocked(swissComplianceApi.getSwissDay).mockResolvedValue(declaredSwissDay());
      renderLayer();

      expect(await screen.findByTestId('swiss-day-state')).toHaveTextContent(/Già notificato il 19 novembre.*15:20 da Luca Bianchi\./);
      // A closed day opens on its declaration, and every step is done.
      expect(isOpen('declare')).toBe(true);
      for (const step of ['guests', 'portal', 'declare']) expect(stepOf(step)).toHaveAttribute('data-state', 'done');
      vi.mocked(swissComplianceApi.getSwissDay).mockResolvedValue(swissDay());

      fireEvent.click(screen.getByTestId('swiss-undeclare'));

      await waitFor(() => expect(swissComplianceApi.undeclareSwissDay).toHaveBeenCalledWith(SWISS_PROPERTY_ID, SWISS_DAY));
      expect(await screen.findByTestId('swiss-declare-button')).toBeInTheDocument();
    });

    it('SwissLayer_TheButtonsWaitWhileTheDeclarationIsOnItsWay_AndAFailureIsToldWithoutLosingTheDay', async () => {
      let refuse: (error: unknown) => void = () => undefined;
      vi.mocked(swissComplianceApi.declareSwissDay).mockReturnValue(new Promise((_resolve, reject) => (refuse = reject)));
      renderLayer();
      await screen.findByTestId('swiss-layer');
      openStep('declare');

      fireEvent.click(screen.getByTestId('swiss-declare-button'));

      await waitFor(() => expect(screen.getByTestId('swiss-declare-button')).toBeDisabled());
      expect(screen.getByTestId('swiss-guests-next')).toBeDisabled();
      await act(async () => refuse(apiError(422, 'swiss_declaration_day_in_future')));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.swissDeclarationDayInFuture')));
      await waitFor(() => expect(screen.getByTestId('swiss-declare-button')).toBeEnabled());
      expect(screen.getByTestId('swiss-day-title')).toBeInTheDocument();
    });

    it('SwissLayer_WhoMayNotDeclareTheCommunications_IsToldSoAndHasNoButton', async () => {
      permissions.granted = ['guest.read', 'booking.read'];
      renderLayer();
      await screen.findByTestId('swiss-layer');
      openStep('declare');

      expect(screen.getByTestId('swiss-declare-needs-submit')).toBeInTheDocument();
      expect(screen.queryByTestId('swiss-declare-button')).not.toBeInTheDocument();
    });

    it('SwissLayer_ADayThatHasNotStartedInSwitzerland_CannotBeDeclared', async () => {
      vi.mocked(swissComplianceApi.getSwissDay).mockResolvedValue(swissDay({ day: '2026-11-20' }));
      renderLayer(`${SWISS_PROPERTY_ID}:2026-11-20`);
      await screen.findByTestId('swiss-layer');
      openStep('declare');

      expect(screen.getByTestId('swiss-declare-future')).toBeInTheDocument();
      expect(screen.getByTestId('swiss-day-state')).toHaveTextContent(/non è ancora iniziato/);
      expect(screen.queryByTestId('swiss-declare-button')).not.toBeInTheDocument();
    });
  });

  describe('what the layer tells when the day cannot be shown', () => {
    it.each([
      [404, 'swissNotification.layer.notFound'],
      [403, 'swissNotification.layer.forbidden'],
      [422, 'swissNotification.layer.notApplicable'],
    ])('SwissLayer_A%sOfTheServer_IsToldAsSuchAndNeverAsTheDayOfAMomentAgo', async (status, key) => {
      const { client } = renderLayer();
      await screen.findByTestId('swiss-layer');
      // The day is in the cache: the next read is refused, and the refusal comes first (the cache keeps the old answer of a read that fails).
      vi.mocked(swissComplianceApi.getSwissDay).mockRejectedValue(apiError(status, status === 422 ? 'swiss_notification_not_applicable' : undefined));
      await act(async () => {
        await client.refetchQueries({ queryKey: [SWISS_NOTIFICATION_KEY, SWISS_PROPERTY_ID] });
      });

      expect(await screen.findByTestId('swiss-layer-problem')).toHaveTextContent(i18n.t(key));
      expect(screen.queryByTestId('swiss-layer')).not.toBeInTheDocument();
    });

    it('SwissLayer_AFailureOfTheLineWithTheDayOnScreen_LeavesTheDayWhereItIsWithALineToReadItAgain', async () => {
      const { client } = renderLayer();
      await screen.findByTestId('swiss-layer');
      openStep('portal');
      vi.mocked(swissComplianceApi.getSwissDay).mockRejectedValue(apiError(500));
      await act(async () => {
        await client.refetchQueries({ queryKey: [SWISS_NOTIFICATION_KEY, SWISS_PROPERTY_ID] });
      });

      // What the person is in the middle of (the step that is open) goes nowhere, and the day is the last one read.
      expect(await screen.findByTestId('swiss-layer-stale')).toBeInTheDocument();
      expect(screen.getByTestId('swiss-layer')).toBeInTheDocument();
      expect(isOpen('portal')).toBe(true);
      vi.mocked(swissComplianceApi.getSwissDay).mockResolvedValue(swissDay());
      fireEvent.click(screen.getByTestId('swiss-layer-stale-retry'));
      await waitFor(() => expect(screen.queryByTestId('swiss-layer-stale')).not.toBeInTheDocument());
    });

    it('SwissLayer_AFailureOfTheLineWithNoDay_IsAnErrorWithARetry', async () => {
      vi.mocked(swissComplianceApi.getSwissDay).mockRejectedValue(apiError(500));
      renderLayer();

      expect(await screen.findByTestId('swiss-layer-error')).toBeInTheDocument();
      expect(screen.queryByTestId('swiss-layer')).not.toBeInTheDocument();
    });

    it('SwissLayer_TheModuleIsOff_SaysSoAndAsksNothingOfTheServer', () => {
      renderLayer(undefined, { flagOn: false });

      expect(screen.getByTestId('swiss-layer-unavailable')).toBeInTheDocument();
      expect(swissComplianceApi.getSwissDay).not.toHaveBeenCalled();
    });

    it.each([['guest.read'], ['booking.read']])('SwissLayer_WithoutThePermission_%s_AsksNothingOfTheServer', (missing) => {
      permissions.granted = EVERYTHING.filter((permission) => permission !== missing);
      renderLayer();

      expect(screen.getByTestId('swiss-layer-problem')).toHaveTextContent(i18n.t('swissNotification.layer.forbidden'));
      expect(swissComplianceApi.getSwissDay).not.toHaveBeenCalled();
    });

    it('SwissLayer_AnIdThatIsNotAnAddressOfTheLayer_SaysItCannotFindItAndAsksNothing', () => {
      renderLayer('../admin');

      expect(screen.getByTestId('swiss-layer-problem')).toHaveTextContent(i18n.t('swissNotification.layer.notFound'));
      expect(swissComplianceApi.getSwissDay).not.toHaveBeenCalled();
    });
  });

  // Privacy: the day holds the guests with their documents and addresses.
  it('SwissLayer_Closed_LeavesNoGuestInTheCacheOfTheQueries', async () => {
    const { client, unmount } = renderLayer();
    await screen.findByTestId('swiss-guest');
    expect(client.getQueryCache().findAll({ queryKey: [SWISS_NOTIFICATION_KEY] }).length).toBeGreaterThan(0);

    unmount();

    expect(client.getQueryCache().findAll({ queryKey: [SWISS_NOTIFICATION_KEY] })).toHaveLength(0);
  });

  it.each([['guests'], ['portal'], ['declare']])('SwissLayer_TheStep%sOpen_HasNoAccessibilityViolation', async (step) => {
    const { container } = renderLayer();
    await screen.findByTestId('swiss-guest');
    openStep(step);

    await expectNoAxeViolations(container);
  });

  it('SwissLayer_TheTextsOfTheDay_NameNoSupplier', async () => {
    renderLayer();
    await screen.findByTestId('swiss-layer');
    openStep('portal');

    expect(document.body.textContent ?? '').not.toMatch(/hoko|unisys|u-stay|feratel|chekin|stellar\s*check-?in|chargeautomation|smoobu|lodgify|octorate|concordato\s*facile|\bavs\b/i);
  });
});
