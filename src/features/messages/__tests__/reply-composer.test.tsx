import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import i18n from '@/i18n/config';
import { messageHubApi } from '@/api/message-hub.api';
import { ReplyComposer } from '../components/reply-composer';

vi.mock('@/api/message-hub.api', () => ({
  messageHubApi: { listTemplates: vi.fn(), listChannelTemplates: vi.fn(), renderTemplate: vi.fn(), translate: vi.fn() },
}));

const KEY = 'ota:6f1c9a52-1111-4222-8333-944455556666';

interface HarnessProps {
  initial?: string;
  busy?: boolean;
  contactDetailsAllowed?: boolean;
  withChannelTemplates?: boolean;
  disabledReason?: string | null;
  onSend: (text: string) => void;
}

/** The page owns the draft: the composer is controlled, as it is inside `ThreadPage`. */
function Harness({ initial = '', busy = false, contactDetailsAllowed = true, withChannelTemplates = true, disabledReason = null, onSend }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return (
    <ReplyComposer
      threadKey={KEY}
      withChannelTemplates={withChannelTemplates}
      value={value}
      onChange={setValue}
      onSend={onSend}
      busy={busy}
      disabledReason={disabledReason}
      contactDetailsAllowed={contactDetailsAllowed}
    />
  );
}

function renderComposer(props: Partial<HarnessProps> = {}) {
  const onSend = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Harness onSend={onSend} {...props} />
    </QueryClientProvider>,
  );
  return { onSend };
}

const textbox = () => screen.getByRole('textbox', { name: "Messaggio per l'ospite" });

function httpError(status: number, data: Record<string, unknown> = {}): AxiosError {
  return new AxiosError('failed', String(status), undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never });
}

describe('ReplyComposer (NF-63)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(messageHubApi.listTemplates).mockResolvedValue([
      { id: 't-1', name: 'Orari del check-in', language: 'it', body: 'Ciao {{guest_name}}', isActive: true, variables: ['guest_name'], updatedAt: '2026-11-01T10:00:00Z' },
    ]);
    vi.mocked(messageHubApi.listChannelTemplates).mockResolvedValue([{ name: 'Benvenuto', language: 'it', text: 'Benvenuto a casa nostra.' }]);
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('ReplyComposer_EmptyText_CannotBeSent', () => {
    renderComposer();

    expect(screen.getByTestId('reply-send')).toBeDisabled();
    fireEvent.change(textbox(), { target: { value: '   ' } });
    expect(screen.getByTestId('reply-send')).toBeDisabled();
  });

  it('ReplyComposer_Text_IsHandedToTheSendTrimmed', () => {
    const { onSend } = renderComposer();

    fireEvent.change(textbox(), { target: { value: '  Dalle 15.  ' } });
    fireEvent.click(screen.getByTestId('reply-send'));

    expect(onSend).toHaveBeenCalledWith('Dalle 15.');
  });

  it('ReplyComposer_EnterSends_ShiftEnterDoesNot', () => {
    const { onSend } = renderComposer({ initial: 'Dalle 15.' });

    fireEvent.keyDown(textbox(), { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(textbox(), { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('Dalle 15.');
  });

  it('ReplyComposer_MessageOnItsWay_TheButtonWaitsSoASecondClickCannotSendItTwice', () => {
    const { onSend } = renderComposer({ initial: 'Dalle 15.', busy: true });

    expect(screen.getByTestId('reply-send')).toBeDisabled();
    fireEvent.keyDown(textbox(), { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('ReplyComposer_Offline_SaysWhyAndKeepsTheText', () => {
    const { onSend } = renderComposer({ initial: 'Dalle 15.', disabledReason: 'Sei offline: puoi inviare il messaggio quando torni online.' });

    expect(screen.getByRole('status')).toHaveTextContent('Sei offline');
    expect(screen.getByTestId('reply-send')).toBeDisabled();
    expect(textbox()).toHaveValue('Dalle 15.');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('ReplyComposer_TextUpTo2000Characters_LongerIsNotTaken', () => {
    renderComposer();

    expect(textbox()).toHaveAttribute('maxlength', '2000');
  });

  it('ReplyComposer_RequestBeforeTheBooking_SaysContactDetailsAndLinksCannotBeSent', () => {
    renderComposer({ contactDetailsAllowed: false });

    expect(screen.getByTestId('reply-no-contacts')).toHaveTextContent('Prima della prenotazione il canale non permette di scrivere link, indirizzi e-mail o numeri di telefono');
  });

  it('ReplyComposer_ChannelThatAllowsContacts_SaysNothingAboutThem', () => {
    renderComposer({ contactDetailsAllowed: true });

    expect(screen.queryByTestId('reply-no-contacts')).not.toBeInTheDocument();
  });

  it('ReplyComposer_TemplateOfTheHost_IsFilledInByTheServerAndPutInTheDraftNotSent', async () => {
    vi.mocked(messageHubApi.renderTemplate).mockResolvedValue({ text: 'Ciao Sofia, il check-in è dalle 15.' });
    const { onSend } = renderComposer();

    fireEvent.click(screen.getByTestId('template-picker-trigger'));
    fireEvent.click(await screen.findByTestId('template-option'));

    await waitFor(() => expect(textbox()).toHaveValue('Ciao Sofia, il check-in è dalle 15.'));
    expect(messageHubApi.renderTemplate).toHaveBeenCalledWith('t-1', KEY);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('ReplyComposer_TemplateAfterSomeText_GoesBelowItAndKeepsWhatWasTyped', async () => {
    vi.mocked(messageHubApi.renderTemplate).mockResolvedValue({ text: 'Il check-in è dalle 15.' });
    renderComposer({ initial: 'Grazie del messaggio.' });

    fireEvent.click(screen.getByTestId('template-picker-trigger'));
    fireEvent.click(await screen.findByTestId('template-option'));

    await waitFor(() => expect(textbox()).toHaveValue('Grazie del messaggio.\n\nIl check-in è dalle 15.'));
  });

  it('ReplyComposer_TemplateWithAVariableTheConversationHasNoValueFor_ShowsTheSentenceThatNamesItAndInsertsNothing', async () => {
    vi.mocked(messageHubApi.renderTemplate).mockRejectedValue(
      httpError(422, { code: 'template_variable_missing', detail: 'Per questa conversazione non c’è un valore per «check_in_date»: scegli un altro modello o completa il testo a mano.' }),
    );
    renderComposer({ initial: 'Ciao' });

    fireEvent.click(screen.getByTestId('template-picker-trigger'));
    fireEvent.click(await screen.findByTestId('template-option'));

    expect(await screen.findByTestId('template-render-problem')).toHaveTextContent('«check_in_date»');
    expect(textbox()).toHaveValue('Ciao');
  });

  it('ReplyComposer_TemplateOfTheChannel_IsReadOnlyAndCopiedAsItIs', async () => {
    renderComposer();

    fireEvent.click(screen.getByTestId('template-picker-trigger'));
    const picker = await screen.findByTestId('template-picker');
    expect(within(picker).getByText('Modelli del canale')).toBeInTheDocument();
    fireEvent.click(await screen.findByTestId('channel-template-option'));

    await waitFor(() => expect(textbox()).toHaveValue('Benvenuto a casa nostra.'));
    expect(messageHubApi.renderTemplate).not.toHaveBeenCalled();
  });

  it('ReplyComposer_DirectConversation_OffersNoTemplatesOfAChannel', async () => {
    renderComposer({ withChannelTemplates: false });

    fireEvent.click(screen.getByTestId('template-picker-trigger'));
    await screen.findByTestId('template-option');

    expect(screen.queryByText('Modelli del canale')).not.toBeInTheDocument();
    expect(messageHubApi.listChannelTemplates).not.toHaveBeenCalled();
  });

  it('ReplyComposer_TemplatesAreNotReadUntilTheListIsOpened', () => {
    renderComposer();

    expect(messageHubApi.listTemplates).not.toHaveBeenCalled();
  });

  it('ReplyComposer_Draft_IsTranslatedIntoTheLanguageOfTheGuestAndUsedOnlyWhenTheHostChoosesIt', async () => {
    vi.mocked(messageHubApi.translate).mockResolvedValue({ text: 'Check-in is from 3 pm.', targetLanguage: 'en', machineTranslated: true });
    const { onSend } = renderComposer({ initial: 'Il check-in è dalle 15.' });

    fireEvent.click(screen.getByTestId('translate-button'));

    const translation = await screen.findByTestId('message-translation');
    expect(translation).toHaveTextContent('Check-in is from 3 pm.');
    expect(translation).toHaveTextContent('Traduzione automatica');
    expect(messageHubApi.translate).toHaveBeenCalledWith({ threadKey: KEY, text: 'Il check-in è dalle 15.', targetLanguage: 'en' });
    // The translation is not in the draft until it is chosen, and nothing was sent.
    expect(textbox()).toHaveValue('Il check-in è dalle 15.');
    fireEvent.click(within(translation).getByRole('button', { name: 'Usa la traduzione' }));
    expect(textbox()).toHaveValue('Check-in is from 3 pm.');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('ReplyComposer_LanguageOfTheTranslation_CanBeChosenAmongTheFourteen', () => {
    renderComposer({ initial: 'Ciao' });

    const select = screen.getByTestId('translate-language');
    expect(select).toHaveValue('en');
    expect(within(select).getAllByRole('option')).toHaveLength(14);
    fireEvent.change(select, { target: { value: 'de' } });
    expect(select).toHaveValue('de');
  });

  it('ReplyComposer_NoDraft_OffersNothingToTranslate', () => {
    renderComposer();

    expect(screen.queryByTestId('translate-button')).not.toBeInTheDocument();
  });
});
