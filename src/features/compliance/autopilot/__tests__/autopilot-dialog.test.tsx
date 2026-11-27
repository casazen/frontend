import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { complianceAutopilotApi } from '@/api/compliance-autopilot.api';
import type { AutopilotItem, AutopilotOutcome, AutopilotPlan, AutopilotRunResult } from '@/types/compliance-autopilot.types';
import { AutopilotDialog } from '../autopilot-dialog';

vi.mock('@/api/compliance-autopilot.api', () => ({
  complianceAutopilotApi: { getPlan: vi.fn(), run: vi.fn() },
}));

const item = (over: Partial<AutopilotItem>): AutopilotItem => ({
  key: 'GuestData:b1',
  topic: 'GuestData',
  status: 'Ready',
  reason: 'ask_guests',
  bookingId: 'b1',
  propertyId: 'p1',
  guestName: 'Anna Verdi',
  propertyName: 'Casa Rossi',
  channels: ['email', 'chat'],
  dueAt: null,
  ...over,
});

const PLAN: AutopilotPlan = {
  aiAvailable: true,
  beyondLimit: 0,
  items: [
    item({ key: 'GuestData:b1', bookingId: 'b1', guestName: 'Anna Verdi' }),
    item({ key: 'GuestData:b2', bookingId: 'b2', guestName: 'Bruno Neri', channels: ['email'] }),
    item({ key: 'Departure:b3', topic: 'Departure', reason: 'close_departure', bookingId: 'b3', guestName: 'Carla Rossi', channels: [] }),
    item({ key: 'Departure:b4', topic: 'Departure', status: 'Waiting', reason: 'awaiting_guest_data', bookingId: 'b4', guestName: 'Dario Bianchi', channels: [] }),
    item({ key: 'Alloggiati:b5', topic: 'Alloggiati', status: 'Host', reason: 'ready_to_upload', bookingId: 'b5', guestName: 'Elena Gialli', channels: [] }),
    item({ key: 'GuestData:b6', status: 'Host', reason: 'no_contact', bookingId: 'b6', guestName: 'Franco Verdi', channels: [] }),
  ],
};

const outcome = (over: Partial<AutopilotOutcome>): AutopilotOutcome => ({
  key: 'GuestData:b1',
  topic: 'GuestData',
  bookingId: 'b1',
  guestName: 'Anna Verdi',
  propertyName: 'Casa Rossi',
  status: 'Done',
  code: 'email_queued',
  emailStatus: 'Queued',
  emailError: null,
  chat: null,
  errorCode: null,
  ...over,
});

const RESULT: AutopilotRunResult = {
  aiUsed: true,
  aiReason: null,
  beyondLimit: 0,
  outcomes: [
    outcome({
      chat: {
        language: 'it',
        text: 'Ciao Anna, servono i dati: https://app.example/checkin/tok',
        whatsAppUrl: 'https://wa.me/393331234567?text=Ciao',
        smsUrl: 'sms:+393331234567?&body=Ciao',
        aiWritten: true,
      },
    }),
    outcome({ key: 'GuestData:b2', bookingId: 'b2', guestName: 'Bruno Neri' }),
    outcome({ key: 'Departure:b3', topic: 'Departure', bookingId: 'b3', guestName: 'Carla Rossi', code: 'departure_closed', emailStatus: null }),
  ],
};

function renderDialog(hostOnly = { activation: 0, turnovers: 0 }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AutopilotDialog open onOpenChange={onOpenChange} hostOnly={hostOnly} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

beforeEach(() => {
  vi.mocked(complianceAutopilotApi.getPlan).mockResolvedValue(PLAN);
  vi.mocked(complianceAutopilotApi.run).mockResolvedValue(RESULT);
});

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('AutopilotDialog', () => {
  it('dialog_ThePlan_SaysWhatTheAssistantDoesWhatItLeavesForLaterAndWhatStaysWithTheHost', async () => {
    renderDialog({ activation: 3, turnovers: 1 });

    const plan = await screen.findByTestId('autopilot-plan');
    expect(within(plan).getByTestId('autopilot-plan-ask')).toHaveTextContent('Chiedo i dati a 2 ospiti');
    expect(within(plan).getByTestId('autopilot-plan-ask')).toHaveTextContent('Anna Verdi e Bruno Neri');
    expect(within(plan).getByTestId('autopilot-plan-ask')).toHaveTextContent('li scrive l\'AI');
    expect(within(plan).getByTestId('autopilot-plan-close')).toHaveTextContent('Chiudo 1 partenza');
    expect(within(plan).getByTestId('autopilot-plan-close')).toHaveTextContent('Carla Rossi');
    expect(within(plan).getByTestId('autopilot-plan-wait-awaiting_guest_data')).toHaveTextContent('Chiuderò la partenza di Dario Bianchi');
    expect(within(plan).getByTestId('autopilot-plan-host-ready_to_upload')).toHaveTextContent('Alloggiati pronti da caricare sul portale (Elena Gialli)');
    expect(within(plan).getByTestId('autopilot-plan-host-no_contact')).toHaveTextContent('Nessun contatto per chiedere i dati a Franco Verdi');
    expect(within(plan).getByTestId('autopilot-plan-host-activation')).toHaveTextContent('Immobili da attivare: 3');
    expect(within(plan).getByTestId('autopilot-plan-host-turnovers')).toHaveTextContent('Case da dichiarare pronte: 1');
    expect(within(plan).getByTestId('autopilot-plan-footnote')).toHaveTextContent('ISTAT');
    expect(complianceAutopilotApi.getPlan).toHaveBeenCalledTimes(1);
    expect(complianceAutopilotApi.run).not.toHaveBeenCalled();
  });

  it('dialog_Start_RunsExactlyWhatWasShown_AndThenShowsWhatWasDoneWithTheMessagesToSend', async () => {
    renderDialog();

    fireEvent.click(await screen.findByTestId('autopilot-start'));

    await waitFor(() =>
      expect(complianceAutopilotApi.run).toHaveBeenCalledWith({ keys: ['GuestData:b1', 'GuestData:b2', 'Departure:b3'] }),
    );
    const result = await screen.findByTestId('autopilot-result');
    expect(screen.getByTestId('autopilot-result-sentence')).toHaveTextContent(
      "Ho mandato l'e-mail a 2 ospiti e chiuso 1 partenza.",
    );
    expect(within(result).getByTestId('autopilot-result-emailed')).toHaveTextContent('Anna Verdi e Bruno Neri');
    expect(within(result).getByTestId('autopilot-result-closed')).toHaveTextContent('Carla Rossi');

    // The e-mail went: the message is only there for the host who wants to remind the guest another way.
    const draft = within(result).getByTestId('autopilot-chat-draft');
    expect(draft).toHaveAttribute('data-optional', 'true');
    expect(within(draft).getByTestId('autopilot-chat-whatsapp')).toHaveAttribute('href', 'https://wa.me/393331234567?text=Ciao');
    expect(within(draft).getByTestId('autopilot-chat-whatsapp')).toHaveAttribute('target', '_blank');
    expect(within(draft).getByTestId('autopilot-chat-sms')).toHaveAttribute('href', 'sms:+393331234567?&body=Ciao');
    expect(within(draft).getByTestId('autopilot-chat-text')).toHaveTextContent('Ciao Anna, servono i dati');
    expect(screen.getByTestId('ai-content-notice')).toBeInTheDocument();
    expect(screen.queryByTestId('autopilot-start')).not.toBeInTheDocument();
  });

  it('dialog_AMessageTheHostMustSend_IsCopiedWithOneTap', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    vi.mocked(complianceAutopilotApi.run).mockResolvedValue({
      aiUsed: false,
      aiReason: 'ai_unavailable',
      beyondLimit: 2,
      outcomes: [
        outcome({
          code: 'chat_ready',
          emailStatus: 'Failed',
          emailError: 'queue_failed',
          chat: { language: 'it', text: 'Ciao Anna, ecco il link', whatsAppUrl: null, smsUrl: null, aiWritten: false },
        }),
        outcome({ key: 'GuestData:b2', bookingId: 'b2', guestName: 'Bruno Neri', status: 'Failed', code: 'failed', emailStatus: null, errorCode: 'checkin_already_completed' }),
      ],
    });
    renderDialog();

    fireEvent.click(await screen.findByTestId('autopilot-start'));

    const chat = await screen.findByTestId('autopilot-result-chat');
    expect(chat).toHaveTextContent("L'e-mail non è partita");
    expect(screen.getByTestId('autopilot-chat-draft')).not.toHaveAttribute('data-optional');
    expect(screen.queryByTestId('autopilot-chat-whatsapp')).not.toBeInTheDocument();
    expect(screen.getByTestId('autopilot-chat-draft')).toHaveTextContent('Manca un numero con il prefisso internazionale');
    fireEvent.click(screen.getByTestId('autopilot-chat-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Ciao Anna, ecco il link'));

    expect(screen.getByTestId('autopilot-ai-fallback')).toBeInTheDocument();
    expect(screen.getByTestId('autopilot-result-failed')).toHaveTextContent('Bruno Neri: L\'ospite ha già compilato il modulo');
    expect(screen.getByTestId('autopilot-result-beyond')).toHaveTextContent('Ne restano 2');
    expect(screen.getByTestId('autopilot-result-sentence')).toHaveTextContent('preparato 1 messaggio da mandare tu');
  });

  it('dialog_NothingTheAssistantCanDo_SaysSo_AndOffersNoStart', async () => {
    vi.mocked(complianceAutopilotApi.getPlan).mockResolvedValue({
      aiAvailable: false,
      beyondLimit: 0,
      items: [item({ key: 'Alloggiati:b5', topic: 'Alloggiati', status: 'Host', reason: 'ready_to_upload', bookingId: 'b5', guestName: 'Elena Gialli', channels: [] })],
    });
    const { onOpenChange } = renderDialog();

    expect(await screen.findByTestId('autopilot-plan-nothing')).toHaveTextContent("Per ora non c'è niente che io possa fare da solo.");
    expect(screen.queryByTestId('autopilot-start')).not.toBeInTheDocument();
    expect(screen.getByTestId('autopilot-open-alloggiati')).toHaveAttribute('href', '/app/short-rent/alloggiati');

    fireEvent.click(screen.getByTestId('autopilot-close'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('dialog_ThePlanThatCannotBeRead_SaysSo_AndCanBeTriedAgain', async () => {
    vi.mocked(complianceAutopilotApi.getPlan).mockRejectedValueOnce(new Error('boom'));
    renderDialog();

    expect(await screen.findByTestId('autopilot-error')).toHaveTextContent('Non riesco a controllare gli adempimenti adesso.');
    fireEvent.click(screen.getByTestId('autopilot-retry'));

    expect(await screen.findByTestId('autopilot-plan')).toBeInTheDocument();
    expect(complianceAutopilotApi.getPlan).toHaveBeenCalledTimes(2);
  });

  it('dialog_ACheckAfterTheRun_ReadsThePlanAgain', async () => {
    renderDialog();
    fireEvent.click(await screen.findByTestId('autopilot-start'));
    await screen.findByTestId('autopilot-result');

    fireEvent.click(screen.getByTestId('autopilot-again'));

    expect(await screen.findByTestId('autopilot-plan')).toBeInTheDocument();
    expect(complianceAutopilotApi.getPlan).toHaveBeenCalledTimes(2);
  });
});
