import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { onboardingAssistApi } from '@/api/onboarding-assist.api';
import { problemError } from '@/features/onboarding/__tests__/onboarding-fixtures';
import type { SupportVaultReveal } from '@/types/onboarding.types';
import { RevealSecretDialog } from '../reveal-secret-dialog';

vi.mock('@/api/onboarding-assist.api', () => ({ onboardingAssistApi: { revealSecret: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const REQUEST_ID = '9d4f6a0e-2c1b-4c5d-8e7f-3a2b1c0d9e8f';
const REASON = 'Collego la Questura per conto dell’host che ha chiesto aiuto.';
const USERNAME = 'RM000123-utente';
const PASSWORD = 'Pa55-Word-S3cret!';
const EXTRA = 'WSKEY-91ab-chiave';
const SECRETS = [USERNAME, PASSWORD, EXTRA];

function opened(overrides: Partial<SupportVaultReveal> = {}): SupportVaultReveal {
  return {
    kind: 'Police',
    username: USERNAME,
    password: PASSWORD,
    extraCode: EXTRA,
    openedAt: '2026-11-15T10:00:00Z',
    visibleUntil: '2026-11-15T10:01:00Z',
    ...overrides,
  };
}

/** The dialog as its parent holds it: open until it asks to be closed, and gone after, with whatever state it had. */
function Harness({ onClosed }: { onClosed: () => void }) {
  const [open, setOpen] = useState(true);
  return open ? (
    <RevealSecretDialog
      requestId={REQUEST_ID}
      kind="Police"
      subject="Casa del Mare"
      onClose={() => {
        setOpen(false);
        onClosed();
      }}
    />
  ) : (
    <p data-testid="gone" />
  );
}

let client: QueryClient;
const onClosed = vi.fn();

function renderDialog() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <Harness onClosed={onClosed} />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

/** Lets React and the query client finish what they started: the promises first, then the zero-delay timers TanStack Query uses to tell React. */
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

/** Moves the clock, with everything that was waiting for it. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function typeReason(reason: string) {
  await settle();
  fireEvent.change(screen.getByTestId('assist-reveal-reason'), { target: { value: reason } });
}

/** Writes the reason and presses the button once it can be pressed: what staff does, and then the values are on screen. */
async function openWithReason(reason: string = REASON) {
  await typeReason(reason);
  const confirm = screen.getByTestId('assist-reveal-confirm');
  expect(confirm).toBeEnabled();
  fireEvent.click(confirm);
  await settle();
}

const valuesOnScreen = () => screen.queryByTestId('assist-reveal-values');

/** Everything the app keeps of the queries and the mutations, as one text: the place a value must never be found. */
function whatTheCachesHold(): string {
  const queries = client.getQueryCache().getAll().map((query) => query.state);
  const mutations = client.getMutationCache().getAll().map((mutation) => ({ state: mutation.state, key: mutation.options.mutationKey }));
  return JSON.stringify({ queries, mutations });
}

/** What the browser stores: the three storages a value could be put in. */
function whatTheBrowserStores(): string {
  return JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, title: document.title });
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  localStorage.clear();
  sessionStorage.clear();
  onClosed.mockReset();
  vi.mocked(onboardingAssistApi.revealSecret).mockReset().mockResolvedValue(opened());
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  vi.useFakeTimers();
});

afterEach(async () => {
  cleanup();
  // What Radix left to do after the dialog went (a focus handed back) is done before the real clock is back.
  await vi.runOnlyPendingTimersAsync();
  vi.useRealTimers();
});

// E20/F03/US02/T01 (NF-15, NF-107, decision O5): the values of a credential are the one thing in the app that must not stay anywhere.
describe('RevealSecretDialog, the controlled opening of a credential of the support vault', () => {
  it('RevealSecretDialog_ReasonTooShort_AsksAgainAndOpensNothing', async () => {
    renderDialog();

    // Eight characters once the spaces around it are gone (eleven with them): the server counts the reason trimmed, and so does the dialog.
    await openWithReason('   serve ok   ');

    // The server would answer 422: the dialog does not even ask. No value, no call.
    expect(screen.getByTestId('assist-reveal-reason-error')).toHaveTextContent(i18n.t('onboardingPlan.assist.reveal.reason.invalid'));
    expect(screen.getByTestId('assist-reveal-reason')).toHaveAttribute('aria-invalid', 'true');
    expect(onboardingAssistApi.revealSecret).not.toHaveBeenCalled();
    expect(valuesOnScreen()).not.toBeInTheDocument();
  });

  it('RevealSecretDialog_WithAReason_SendsTheKindAndTheReasonAndShowsEachValueWithACopyButton', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderDialog();

    // The counter says how much of the 300 characters is used, and the field takes no more.
    await typeReason(REASON);
    expect(screen.getByTestId('assist-reveal-reason-counter')).toHaveTextContent(`${REASON.length}/300`);
    expect(screen.getByTestId('assist-reveal-reason')).toHaveAttribute('maxlength', '300');
    fireEvent.click(screen.getByTestId('assist-reveal-confirm'));
    await settle();

    expect(onboardingAssistApi.revealSecret).toHaveBeenCalledWith(REQUEST_ID, { kind: 'Police', reason: REASON });
    expect(screen.getByTestId('assist-reveal-value-username')).toHaveTextContent(USERNAME);
    expect(screen.getByTestId('assist-reveal-value-password')).toHaveTextContent(PASSWORD);
    expect(screen.getByTestId('assist-reveal-value-extraCode')).toHaveTextContent(EXTRA);
    // A button copies each value, and the reason is not kept for a next opening.
    fireEvent.click(screen.getByTestId('assist-reveal-copy-password'));
    await settle();
    expect(writeText).toHaveBeenCalledWith(PASSWORD);
    expect(toast.success).toHaveBeenCalledWith(i18n.t('onboardingPlan.assist.copied'));
    expect(screen.queryByTestId('assist-reveal-reason')).not.toBeInTheDocument();
  });

  it('RevealSecretDialog_AfterAMinute_HidesTheValuesAndAsksForANewReason', async () => {
    renderDialog();
    await openWithReason();
    expect(valuesOnScreen()).toBeInTheDocument();

    // Still there when a second is left, with the seconds that are left...
    await advance(59_000);
    expect(valuesOnScreen()).toBeInTheDocument();
    expect(screen.getByTestId('assist-reveal-remaining')).toHaveTextContent(i18n.t('onboardingPlan.assist.reveal.visible.remaining', { seconds: 1 }));
    expect(document.body.textContent).toContain(PASSWORD);

    // ...and gone with the minute: nothing of them is left on the page, and the next opening asks a new reason.
    await advance(1_000);
    expect(valuesOnScreen()).not.toBeInTheDocument();
    for (const secret of SECRETS) expect(document.body.textContent).not.toContain(secret);
    expect(screen.getByTestId('assist-reveal-hidden')).toHaveTextContent(i18n.t('onboardingPlan.assist.reveal.hidden.title'));
    expect(screen.getByTestId('assist-reveal-reason')).toHaveValue('');
    expect(onClosed).not.toHaveBeenCalled();
  });

  it('RevealSecretDialog_TheServerSaysAShorterSpan_HidesThemWhenThatSpanIsOver', async () => {
    vi.mocked(onboardingAssistApi.revealSecret).mockResolvedValue(opened({ visibleUntil: '2026-11-15T10:00:20Z' }));
    renderDialog();
    await openWithReason();

    await advance(19_000);
    expect(valuesOnScreen()).toBeInTheDocument();
    await advance(1_000);

    expect(valuesOnScreen()).not.toBeInTheDocument();
  });

  it('RevealSecretDialog_HideNow_ClearsTheValuesAtOnce', async () => {
    renderDialog();
    await openWithReason();

    fireEvent.click(screen.getByTestId('assist-reveal-hide'));
    await settle();

    expect(valuesOnScreen()).not.toBeInTheDocument();
    for (const secret of SECRETS) expect(document.body.textContent).not.toContain(secret);
    expect(screen.getByTestId('assist-reveal-hidden')).toBeInTheDocument();
  });

  it('RevealSecretDialog_Closed_TheValuesAreGoneAndTheTimerIsGoneWithThem', async () => {
    renderDialog();
    await openWithReason();
    expect(valuesOnScreen()).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('assist-reveal-close'));
    await settle();

    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('gone')).toBeInTheDocument();
    for (const secret of SECRETS) expect(document.body.textContent).not.toContain(secret);
    // A minute later nothing wakes up for a dialog that is not there.
    await advance(60_000);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('RevealSecretDialog_Unmounted_LeavesNoValueAndNoTimerBehind', async () => {
    const { unmount } = renderDialog();
    await openWithReason();
    const before = vi.getTimerCount();

    unmount();
    await settle();

    for (const secret of SECRETS) expect(document.body.textContent).not.toContain(secret);
    expect(vi.getTimerCount()).toBeLessThan(before);
    await advance(60_000);
    expect(onClosed).not.toHaveBeenCalled();
  });

  it('RevealSecretDialog_WhileTheValuesAreOpen_NothingOfThemIsInTheCacheOfTheQueriesNorInTheBrowserStorage', async () => {
    renderDialog();
    await openWithReason();
    expect(valuesOnScreen()).toBeInTheDocument();

    // The values are in the state of the dialog and nowhere else: not in a query, not in a mutation (neither its data nor what it was asked), not in a storage of the browser.
    const caches = whatTheCachesHold();
    const stored = whatTheBrowserStores();
    for (const secret of SECRETS) {
      expect(caches).not.toContain(secret);
      expect(stored).not.toContain(secret);
    }
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    // The mutation that asked is dropped as soon as nothing watches it (`gcTime: 0`).
    expect(client.getMutationCache().getAll().filter((mutation) => mutation.state.data !== undefined)).toHaveLength(0);

    // And after the minute, nothing either.
    await advance(60_000);
    for (const secret of SECRETS) {
      expect(whatTheCachesHold()).not.toContain(secret);
      expect(whatTheBrowserStores()).not.toContain(secret);
    }
  });

  it('RevealSecretDialog_AFailedOpening_KeepsNothingOfWhatWasAskedAndSaysWhyInWords', async () => {
    vi.mocked(onboardingAssistApi.revealSecret).mockRejectedValue(problemError(429, { code: 'support_vault_too_many_openings' }));
    renderDialog();

    await openWithReason();

    expect(screen.getByTestId('assist-reveal-error')).toHaveTextContent(i18n.t('apiErrors.codes.supportVaultTooManyOpenings'));
    expect(valuesOnScreen()).not.toBeInTheDocument();
    // The reason stays to be sent again; a failure is kept without the request that was sent.
    expect(screen.getByTestId('assist-reveal-reason')).toHaveValue(REASON);
    expect(screen.getByTestId('assist-reveal-confirm')).toBeEnabled();
    expect(whatTheCachesHold()).not.toContain('config');
  });

  it('RevealSecretDialog_WhileTheCallIsOnItsWay_CannotBePressedTwiceNorClosed', async () => {
    let finish: (values: SupportVaultReveal) => void = () => undefined;
    vi.mocked(onboardingAssistApi.revealSecret).mockImplementation(
      () =>
        new Promise<SupportVaultReveal>((resolve) => {
          finish = resolve;
        }),
    );
    renderDialog();
    await typeReason(REASON);
    const confirm = screen.getByTestId('assist-reveal-confirm');
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    await settle();
    fireEvent.click(confirm);
    await settle();

    expect(onboardingAssistApi.revealSecret).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('assist-reveal-cancel')).toBeDisabled();
    await act(async () => {
      finish(opened());
      await vi.advanceTimersByTimeAsync(0);
    });
    await settle();

    expect(valuesOnScreen()).toBeInTheDocument();
    expect(onboardingAssistApi.revealSecret).toHaveBeenCalledTimes(1);
  });
});
