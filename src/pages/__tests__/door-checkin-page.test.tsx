import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { publicCheckinApi } from '@/api/checkin.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { checkInAddressOf, classifyDoorError, doorRequestOf, isCalendarDay, validateDoor } from '@/features/checkin/lib/door-model';
import { expectNoAxeViolations } from '@/test/axe';
import { DoorCheckInPage } from '../DoorCheckInPage';

vi.mock('@/api/checkin.api', () => ({
  publicCheckinApi: { openDoor: vi.fn(), setLanguage: vi.fn() },
}));

configure({ asyncUtilTimeout: 5_000 });

const DOOR = 'door-token-1234567890abcdef';

function httpError(status?: number, data?: unknown, code?: string): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const response = status === undefined ? undefined : { status, data, statusText: '', headers: {}, config };
  return new AxiosError('Request failed', code ?? AxiosError.ERR_BAD_REQUEST, config, {}, response);
}

/** Where the guest ends up: the address, as the page of the stay would read it. */
function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
}

function renderDoor({ flag = true }: { flag?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, checkInIdentityVerification: flag }, isLoading: false }}>
        <MemoryRouter initialEntries={[`/checkin/porta/${DOOR}`]}>
          <Routes>
            <Route path="/checkin/porta/:doorToken" element={<DoorCheckInPage />} />
            <Route path="/checkin/:token" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
}

const typeInto = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), { target: { value } });
const submit = () => fireEvent.click(screen.getByTestId('checkin-door-submit'));

beforeEach(async () => {
  vi.clearAllMocks();
  // The page opens in the language of the browser: Italian here.
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('it-IT');
  vi.mocked(publicCheckinApi.openDoor).mockResolvedValue({ token: 'link-token-1' });
  vi.mocked(publicCheckinApi.setLanguage).mockResolvedValue({ language: 'it' });
  await i18n.changeLanguage('it');
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await i18n.changeLanguage('it');
});

describe('the page of the door of the property (E22/F02/US01/T01)', () => {
  it('DoorCheckInPage_FlagOff_IsTheAddressNobodyKnewAndAsksNothing', () => {
    renderDoor({ flag: false });

    expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-door-form')).not.toBeInTheDocument();
    expect(publicCheckinApi.openDoor).not.toHaveBeenCalled();
  });

  it('DoorCheckInPage_BookingCodeAndArrivalDate_FindTheStayAndGoOnToTheCheckInAtTheIdentityStep', async () => {
    renderDoor();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Check-in all'ingresso");
    typeInto('checkin-door-code', '  ABC123  ');
    typeInto('checkin-door-arrival', '2026-11-20');
    submit();

    await waitFor(() => expect(publicCheckinApi.openDoor).toHaveBeenCalledWith(DOOR, { bookingCode: 'ABC123', arrivalDate: '2026-11-20' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/checkin/link-token-1?step=identity');
    // The guest never chose a language here: nothing is saved on the session.
    expect(publicCheckinApi.setLanguage).not.toHaveBeenCalled();
  });

  it('DoorCheckInPage_NoBookingCode_TheSurnameIsSentInsteadAndNeverBoth', async () => {
    renderDoor();

    fireEvent.click(screen.getByTestId('checkin-door-mode-surname'));
    expect(screen.queryByTestId('checkin-door-code')).not.toBeInTheDocument();
    typeInto('checkin-door-surname', 'Rossi');
    typeInto('checkin-door-arrival', '2026-11-20');
    submit();

    await waitFor(() => expect(publicCheckinApi.openDoor).toHaveBeenCalledWith(DOOR, { surname: 'Rossi', arrivalDate: '2026-11-20' }));
    expect(vi.mocked(publicCheckinApi.openDoor).mock.calls[0][1]).not.toHaveProperty('bookingCode');
  });

  it('DoorCheckInPage_WhatWasTyped_IsNeverInTheAddressNorInAStorage', async () => {
    const stored = vi.spyOn(Storage.prototype, 'setItem');
    renderDoor();
    typeInto('checkin-door-code', 'SECRETCODE9');
    typeInto('checkin-door-arrival', '2026-11-20');
    submit();

    const where = await screen.findByTestId('where');
    // Only the token of the link is in the address of the stay: not the code, not the date.
    expect(where.textContent).toBe('/checkin/link-token-1?step=identity');
    expect(where.textContent).not.toContain('SECRETCODE9');
    expect(stored).not.toHaveBeenCalled();
    expect(window.location.href).not.toContain('SECRETCODE9');
  });

  it('DoorCheckInPage_AChosenLanguage_IsSavedOnTheStayWhoseLinkTheDoorOpened', async () => {
    renderDoor();
    fireEvent.change(screen.getByTestId('checkin-language-select'), { target: { value: 'en' } });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Check-in at the entrance'));
    typeInto('checkin-door-code', 'ABC123');
    typeInto('checkin-door-arrival', '2026-11-20');

    submit();

    await waitFor(() => expect(publicCheckinApi.setLanguage).toHaveBeenCalledWith('link-token-1', 'en'));
  });

  it.each([
    ['a code that does not exist', httpError(404, { code: 'door_checkin_not_found' })],
    ['a stay of another property', httpError(404, { code: 'door_checkin_not_found', detail: 'other' })],
    ['a door that was replaced', httpError(404)],
  ])('DoorCheckInPage_%s_IsTheSameOneAnswerThatNeverSaysWhichPartWasWrong', async (_cause, error) => {
    vi.mocked(publicCheckinApi.openDoor).mockRejectedValue(error);
    renderDoor();
    typeInto('checkin-door-code', 'WRONG1');
    typeInto('checkin-door-arrival', '2026-11-20');

    submit();

    const alert = await screen.findByTestId('checkin-door-error');
    expect(alert).toHaveTextContent(i18n.t('checkin.door.errors.notFound'));
    expect(alert.textContent).not.toContain('WRONG1');
    expect(alert.textContent).not.toContain('other');
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });

  it('DoorCheckInPage_TooManyAttempts_SaysToWaitAMinute', async () => {
    vi.mocked(publicCheckinApi.openDoor).mockRejectedValue(httpError(429, { code: 'rate_limited' }));
    renderDoor();
    typeInto('checkin-door-code', 'ABC123');
    typeInto('checkin-door-arrival', '2026-11-20');

    submit();

    expect(await screen.findByTestId('checkin-door-error')).toHaveTextContent(i18n.t('checkin.door.errors.tooManyRequests'));
  });

  it('DoorCheckInPage_NoAnswerFromTheServer_SaysItIsTheNetworkAndNotThatTheStayWasNotFound', async () => {
    vi.mocked(publicCheckinApi.openDoor).mockRejectedValue(httpError(undefined, undefined, AxiosError.ERR_NETWORK));
    renderDoor();
    typeInto('checkin-door-code', 'ABC123');
    typeInto('checkin-door-arrival', '2026-11-20');

    submit();

    expect(await screen.findByTestId('checkin-door-error')).toHaveTextContent(i18n.t('checkin.door.errors.network'));
  });

  it('DoorCheckInPage_NothingTyped_SaysWhatIsMissingAndSendsNothing', () => {
    renderDoor();

    submit();

    expect(screen.getAllByRole('alert').map((alert) => alert.textContent)).toEqual([
      i18n.t('checkin.door.errors.codeRequired'),
      i18n.t('checkin.door.errors.arrivalRequired'),
    ]);
    expect(publicCheckinApi.openDoor).not.toHaveBeenCalled();
  });

  it('DoorCheckInPage_AttemptInFlight_TheFormStaysDisabledAndAsecondTapSendsNothing', async () => {
    let answer: (value: { token: string }) => void = () => undefined;
    vi.mocked(publicCheckinApi.openDoor).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    renderDoor();
    typeInto('checkin-door-code', 'ABC123');
    typeInto('checkin-door-arrival', '2026-11-20');

    submit();
    await waitFor(() => expect(screen.getByTestId('checkin-door-submit')).toBeDisabled());
    expect(screen.getByTestId('checkin-door-code')).toBeDisabled();
    fireEvent.submit(screen.getByTestId('checkin-door-form'));
    expect(publicCheckinApi.openDoor).toHaveBeenCalledTimes(1);

    answer({ token: 'link-token-1' });
    await screen.findByTestId('where');
  });

  it('DoorCheckInPage_TheForm_HasNoAccessibilityViolations', async () => {
    const { container } = renderDoor();

    await expectNoAxeViolations(container);
  });
});

describe('the model of the door', () => {
  it.each([
    ['2026-11-20', true],
    ['2026-02-30', false],
    ['20-11-2026', false],
    ['', false],
    ['1999-01-01', false],
  ])('isCalendarDay_%s_Is_%s', (value, expected) => {
    expect(isCalendarDay(value)).toBe(expected);
  });

  it('validateDoor_ASurnameThatIsTooLong_IsInvalid_AndEachModeChecksOnlyItsOwnBox', () => {
    expect(validateDoor('code', { code: 'x'.repeat(65), surname: '', arrival: '2026-11-20' })).toEqual({ code: 'invalid' });
    expect(validateDoor('surname', { code: '', surname: 'x'.repeat(101), arrival: '2026-11-20' })).toEqual({ surname: 'invalid' });
    expect(validateDoor('surname', { code: '', surname: 'Rossi', arrival: '2026-11-20' })).toEqual({});
  });

  it('doorRequestOf_EachMode_SendsOnlyItsOwnBoxAndTheDate', () => {
    expect(doorRequestOf('code', { code: ' A1 ', surname: 'Rossi', arrival: '2026-11-20' })).toEqual({ bookingCode: 'A1', arrivalDate: '2026-11-20' });
    expect(doorRequestOf('surname', { code: 'A1', surname: ' Rossi ', arrival: '2026-11-20' })).toEqual({ surname: 'Rossi', arrivalDate: '2026-11-20' });
  });

  it('classifyDoorError_Statuses_AreReducedToTheFourSentences', () => {
    expect(classifyDoorError(httpError(404))).toBe('not_found');
    expect(classifyDoorError(httpError(429))).toBe('too_many_requests');
    expect(classifyDoorError(httpError(500))).toBe('failed');
    expect(classifyDoorError(httpError(undefined, undefined, AxiosError.ERR_NETWORK))).toBe('network');
    expect(classifyDoorError(new Error('boom'))).toBe('failed');
  });

  it('checkInAddressOf_AToken_IsTheCheckInPageAtTheIdentityStepWithNothingElse', () => {
    expect(checkInAddressOf('abc')).toBe('/checkin/abc?step=identity');
    expect(checkInAddressOf('a/b')).toBe('/checkin/a%2Fb?step=identity');
  });
});
