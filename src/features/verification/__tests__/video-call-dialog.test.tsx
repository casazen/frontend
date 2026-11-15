import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { verificationApi } from '@/api/verification.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { VerificationItem } from '@/components/verification/VerificationItem';
import { expectNoAxeViolations } from '@/test/axe';
import type { PendingVerification } from '@/types/verification.types';
import { VideoCallAction } from '../components/video-call-dialog';
import { classifyVideoCallError, isMeetingUrl, VIDEO_CALL_PROBLEMS, videoCallProblemKey } from '../lib/video-call-model';

vi.mock('@/api/verification.api', () => ({
  verificationApi: {
    getPending: vi.fn(),
    getMetrics: vi.fn(),
    requestNewPhoto: vi.fn(),
    recordVerification: vi.fn(),
    rejectVerification: vi.fn(),
    proposeVideoCall: vi.fn(),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

configure({ asyncUtilTimeout: 5_000 });

const BOOKING = '11111111-1111-4111-8111-111111111111';
const MEETING = 'https://meet.example.test/room-1234';

function httpError(status?: number, data?: unknown, code?: string): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const response = status === undefined ? undefined : { status, data, statusText: '', headers: {}, config };
  return new AxiosError('Request failed', code ?? AxiosError.ERR_BAD_REQUEST, config, {}, response);
}

/** The workspace of a person who holds the permissions given (a context key and a permission each). */
function workspaceWith(...held: string[]): WorkspaceContextValue {
  return {
    contexts: [],
    activeContext: 'short-rent',
    isReady: true,
    setActiveContext: vi.fn(),
    hasPermission: (contextKey, permission) => held.includes(`${contextKey}:${permission}`),
    getDefaultRoute: () => '/app/short-rent',
  };
}

const DECIDES = 'short-rent:verification.decision';

function withProviders(children: ReactNode, { flag = true, held = [DECIDES] }: { flag?: boolean; held?: string[] } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, checkInIdentityVerification: flag }, isLoading: false }}>
            <WorkspaceContext.Provider value={workspaceWith(...held)}>{children}</WorkspaceContext.Provider>
          </FeatureFlagsContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

function renderAction(onSend: (url: string) => Promise<unknown>, options: { flag?: boolean; held?: string[]; busy?: boolean; pending?: boolean } = {}) {
  const { busy = false, pending = false, ...providers } = options;
  return render(withProviders(<VideoCallAction guestName="Mario Rossi" busy={busy} pending={pending} onSend={onSend} />, providers));
}

const openDialog = () => fireEvent.click(screen.getByTestId('verification-video-call'));
const typeLink = (value: string) => fireEvent.change(screen.getByTestId('verification-video-call-url'), { target: { value } });
const send = () => fireEvent.click(screen.getByTestId('verification-video-call-send'));

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('the video call of the verification queue: who sees it (E22/F02/US01/T02, NF-24)', () => {
  it('VideoCallDialog_WithoutVerificationDecision_IsHidden_Test', () => {
    // The page of the queue already asks the permission; the action asks it again, so it is never on a screen of someone who may not decide.
    renderAction(vi.fn(), { held: ['short-rent:property.write', 'short-rent:booking.write', 'long-rent:verification.decision'] });

    expect(screen.queryByTestId('verification-video-call')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('verification.videoCall.button') })).not.toBeInTheDocument();
  });

  it('VideoCallDialog_WithVerificationDecision_ShowsTheActionAndOpensTheDialog', () => {
    renderAction(vi.fn());

    expect(screen.getByTestId('verification-video-call')).toHaveTextContent('Videochiamata');
    expect(screen.queryByTestId('verification-video-call-form')).not.toBeInTheDocument();

    openDialog();

    const form = screen.getByTestId('verification-video-call-form');
    expect(within(form).getByText('Proponi una videochiamata a Mario Rossi')).toBeInTheDocument();
    expect(screen.getByTestId('verification-video-call-url')).toHaveAttribute('type', 'url');
  });

  it('VideoCallDialog_TheIdentityVerificationIsOff_IsHiddenWhateverThePermissionIs', () => {
    renderAction(vi.fn(), { flag: false });

    expect(screen.queryByTestId('verification-video-call')).not.toBeInTheDocument();
  });
});

describe('the video call dialog: what the operator sends', () => {
  it('VideoCallDialog_AValidLink_IsSentOnceTrimmedAndTheDialogClosesAndForgetsIt', async () => {
    const onSend = vi.fn().mockResolvedValue({ status: 'sent' });
    renderAction(onSend);
    openDialog();

    typeLink(`  ${MEETING}  `);
    send();

    await waitFor(() => expect(onSend).toHaveBeenCalledWith(MEETING));
    expect(onSend).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('verification-video-call-form')).not.toBeInTheDocument());
    expect(screen.getByTestId('verification-video-call-sent')).toBeInTheDocument();
    // The link is not kept: the next time the dialog opens it is empty.
    openDialog();
    expect(screen.getByTestId('verification-video-call-url')).toHaveValue('');
  });

  it.each([
    ['', 'Incolla il link della riunione.'],
    ['not a link', 'Il link non è valido'],
    ['http://meet.example.test/room', 'Il link non è valido'],
    ['https://user:secret@meet.example.test/room', 'Il link non è valido'],
    ['https://meet.example.test/room with space', 'Il link non è valido'],
    [`https://meet.example.test/${'a'.repeat(500)}`, 'Il link non è valido'],
  ])('VideoCallDialog_Link_%s_IsRefusedBeforeAnythingLeaves', (value, message) => {
    const onSend = vi.fn();
    renderAction(onSend);
    openDialog();

    typeLink(value);
    send();

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('VideoCallDialog_TheServerRefusesTheAddress_SaysItNextToTheFieldAndKeepsWhatWasTyped', async () => {
    renderAction(vi.fn().mockRejectedValue(httpError(422, { code: 'video_call_url_invalid' })));
    openDialog();
    typeLink(MEETING);

    send();

    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('verification.videoCall.errors.invalid_url'));
    expect(screen.getByTestId('verification-video-call-url')).toHaveValue(MEETING);
    expect(screen.getByTestId('verification-video-call-form')).toBeInTheDocument();
  });

  it.each([
    [httpError(409, { code: 'guest_unreachable' }), 'unreachable'],
    [httpError(409, { code: 'video_call_not_sent' }), 'not_sent'],
    [httpError(404, { code: 'no_pending_verification' }), 'not_pending'],
    // An answer that never came, or a server that failed, is an outcome nobody knows: the dialog never says that nothing was sent.
    [httpError(undefined, undefined, AxiosError.ERR_NETWORK), 'outcome_unknown'],
    [httpError(500), 'outcome_unknown'],
    [httpError(429), 'too_many_requests'],
  ])('VideoCallDialog_TheCallFails_%#_TellsTheOperatorWhyInWordsAndTheDialogStaysOpen', async (error, problem) => {
    renderAction(vi.fn().mockRejectedValue(error));
    openDialog();
    typeLink(MEETING);

    send();

    const message = await screen.findByTestId('verification-video-call-error');
    expect(message).toHaveAttribute('data-problem', problem);
    expect(message).toHaveTextContent(i18n.t(videoCallProblemKey(problem as (typeof VIDEO_CALL_PROBLEMS)[number])));
    expect(screen.getByTestId('verification-video-call-form')).toBeInTheDocument();
    expect(screen.queryByTestId('verification-video-call-sent')).not.toBeInTheDocument();
  });

  it('VideoCallDialog_TheEmailIsBeingQueued_EveryButtonOfTheDialogStaysDisabledSoASecondSendCannotStart', async () => {
    renderAction(vi.fn(), { pending: true });
    openDialog();

    expect(screen.getByTestId('verification-video-call-send')).toBeDisabled();
    expect(screen.getByTestId('verification-video-call-url')).toBeDisabled();
    expect(screen.getByRole('button', { name: i18n.t('shared.cancel') })).toBeDisabled();
  });

  it('VideoCallDialog_AnotherWriteOfTheCardIsInFlight_TheActionStaysDisabled', () => {
    renderAction(vi.fn(), { busy: true });

    expect(screen.getByTestId('verification-video-call')).toBeDisabled();
  });

  it('VideoCallDialog_TheOpenDialog_HasNoAccessibilityViolations', async () => {
    renderAction(vi.fn());
    openDialog();
    await screen.findByTestId('verification-video-call-form');

    await expectNoAxeViolations(document.body);
  });
});

describe('the model of the video call', () => {
  it.each([
    [MEETING, true],
    ['https://example.test', true],
    ['http://example.test/room', false],
    ['ftp://example.test/room', false],
    ['//example.test/room', false],
    ['https://u:p@example.test/room', false],
    ['https://example.test/a b', false],
    ['   ', false],
  ])('isMeetingUrl_%s_Is_%s', (value, expected) => {
    expect(isMeetingUrl(value)).toBe(expected);
  });

  it('classifyVideoCallError_EveryProblemHasItsWordsInItalianAndEnglish', async () => {
    const en = await import('@/i18n/locales/en.json');
    const it_ = await import('@/i18n/locales/it.json');
    const words = (tree: unknown, key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], tree);

    for (const problem of VIDEO_CALL_PROBLEMS) {
      expect(typeof words(it_.default, videoCallProblemKey(problem))).toBe('string');
      expect(typeof words(en.default, videoCallProblemKey(problem))).toBe('string');
    }
    expect(classifyVideoCallError(new Error('boom'))).toBe('failed');
  });
});

const waiting: PendingVerification = {
  bookingId: BOOKING,
  propertyId: 'p-1',
  propertyName: 'Villa Demo',
  checkInDate: '2099-10-10T00:00:00Z',
  checkOutDate: '2099-10-12T00:00:00Z',
  guestName: 'Mario Rossi',
  guestEmail: 'mario@example.test',
  biometricOutcome: 'Escalate',
  biometricAttempts: 1,
  raisedAt: '2099-10-01T08:00:00Z',
  reasons: [],
};

describe('the card of the verification with the video call', () => {
  it('VerificationItem_VideoCallOn_ProposesTheCallFromTheCardAndEveryOtherButtonWaitsForIt', async () => {
    let answer: (value: { status: 'sent' }) => void = () => undefined;
    vi.mocked(verificationApi.proposeVideoCall).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    render(withProviders(<VerificationItem verification={waiting} />));
    // The words say the call is proposed here; the old advice to contact the guest outside CasaZen is gone while the call is offered.
    expect(screen.getByTestId('verification-contact-hint')).toHaveTextContent('Proponi una videochiamata');
    expect(screen.getByTestId('verification-contact-hint')).not.toHaveTextContent('fuori da CasaZen');

    openDialog();
    typeLink(MEETING);
    send();

    await waitFor(() => expect(verificationApi.proposeVideoCall).toHaveBeenCalledWith(BOOKING, { url: MEETING }));
    // One write of the card at a time: the other actions wait while the e-mail is queued.
    await waitFor(() => expect(screen.getByTestId('verification-decide')).toBeDisabled());
    expect(screen.getByTestId('verification-reject')).toBeDisabled();
    expect(screen.getByTestId('verification-video-call')).toBeDisabled();

    answer({ status: 'sent' });

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('verification.videoCall.sent')));
    await waitFor(() => expect(screen.getByTestId('verification-decide')).toBeEnabled());
    // The verification still waits for the decision after the call: its buttons are the usual ones.
    expect(screen.getByTestId('verification-video-call-sent')).toBeInTheDocument();
  });

  it('VerificationItem_VideoCallOff_IsTheCardItAlwaysWas', () => {
    render(withProviders(<VerificationItem verification={waiting} />, { flag: false }));

    expect(screen.queryByTestId('verification-video-call')).not.toBeInTheDocument();
    expect(screen.getByTestId('verification-contact-hint')).toHaveTextContent('Contatta l\'ospite fuori da CasaZen');
  });

  it('VerificationItem_NoRequestKeepsTheLinkOfTheMeeting_AFailureIsKeptWithoutIt', async () => {
    vi.mocked(verificationApi.proposeVideoCall).mockRejectedValue(httpError(409, { code: 'guest_unreachable' }));
    render(withProviders(<VerificationItem verification={waiting} />));
    openDialog();
    typeLink(MEETING);

    send();

    expect(await screen.findByTestId('verification-video-call-error')).toHaveAttribute('data-problem', 'unreachable');
    // Nothing of the link is on the page but the box the operator typed it in; no write of the card is left in flight.
    expect(document.body.textContent ?? '').not.toContain('room-1234');
    expect(screen.getByTestId('verification-decide')).toBeEnabled();
  });
});
