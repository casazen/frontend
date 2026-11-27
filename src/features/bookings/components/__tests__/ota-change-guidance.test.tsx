import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import { OtaChangeGuidance } from '../ota-change-guidance';

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(cleanup);

describe('OtaChangeGuidance (how to ask the guest or the channel, NF-75 and NF-76)', () => {
  it('render_ChangeOfAChannelThatHasItsName_NamesTheChannel', () => {
    render(<OtaChangeGuidance action="modify" channel="Airbnb" />);

    expect(screen.getByTestId('ota-change-guidance')).toHaveTextContent(
      "Per modificare questa prenotazione di Airbnb chiedi all'ospite di richiedere la modifica su Airbnb.",
    );
  });

  it('render_CancellationOfAChannelThatHasItsName_NamesTheChannel', () => {
    render(<OtaChangeGuidance action="cancel" channel="TripAdvisor" />);

    expect(screen.getByTestId('ota-change-guidance')).toHaveTextContent(
      "Per cancellare questa prenotazione di Tripadvisor chiedi all'ospite di annullarla su Tripadvisor.",
    );
  });

  it('render_BookingCom_SaysHowItsGuestsChangeTheDates', () => {
    render(<OtaChangeGuidance action="modify" channel="BookingCom" />);

    expect(screen.getByTestId('ota-change-guidance')).toHaveTextContent("Su Booking.com l'ospite cambia le date dall'app o dall'extranet");
  });

  it.each(['OtherChannel', null, undefined, 'AChannelNobodyKnows'])('render_ChannelWithNoNameOfItsOwn_SaysItWithoutOne_%s', (channel) => {
    render(<OtaChangeGuidance action="cancel" channel={channel} />);

    expect(screen.getByTestId('ota-change-guidance')).toHaveTextContent(
      "Per cancellare questa prenotazione chiedi all'ospite di annullarla sul canale da cui ha prenotato.",
    );
  });

  it('render_English_UsesTheEnglishSentence', async () => {
    await i18n.changeLanguage('en');
    render(<OtaChangeGuidance action="modify" channel="Expedia" />);

    expect(screen.getByTestId('ota-change-guidance')).toHaveTextContent('To change this Expedia booking, ask the guest to request the change on Expedia.');
  });

  it.each(['it', 'en'])('render_EveryChannelAndAction_ReadsAsASentenceAndNeverAsAKey_%s', async (language) => {
    await i18n.changeLanguage(language);
    for (const action of ['modify', 'cancel'] as const) {
      for (const channel of ['Airbnb', 'BookingCom', 'Expedia', 'Vrbo', 'TripAdvisor', 'Agoda', 'OtherChannel', null]) {
        const { unmount } = render(<OtaChangeGuidance action={action} channel={channel} />);
        const text = screen.getByTestId('ota-change-guidance').textContent ?? '';
        expect(text).not.toMatch(/booking\.changeGuidance|\{\{/);
        expect(text.length).toBeGreaterThan(20);
        unmount();
      }
    }
  });
});
