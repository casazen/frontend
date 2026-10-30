import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { GuestsPicker, type GuestsPickerProps } from '../guests-picker';

/**
 * The guests of a stay: a guest with a dog wants to be asked, and to be told whether the home takes it, before choosing the home. The
 * question used to be there only for a home that takes pets, so a guest looking at one that does not never saw it.
 */
function renderPicker(props: Partial<GuestsPickerProps> = {}) {
  const onChange = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <GuestsPicker value={{ adults: 2, children: 0, pets: false }} onChange={onChange} {...props} />
    </I18nextProvider>,
  );
  return onChange;
}

describe('GuestsPicker pets question', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('GuestsPicker_HomeThatTakesPets_AsksAndSaysItTakesThem', () => {
    renderPicker({ petsAllowed: true });

    expect(screen.getByLabelText('Viaggi con animali?')).toBeInTheDocument();
    expect(screen.getByTestId('guests-pets-hint')).toHaveTextContent('Questa casa li ammette');
  });

  it('GuestsPicker_HomeThatTakesNoPets_StillAsksAndSaysItTakesNone', () => {
    renderPicker({ petsAllowed: false });

    expect(screen.getByTestId('guests-pets')).toBeInTheDocument();
    expect(screen.getByTestId('guests-pets-hint')).toHaveTextContent('Questa casa non ammette animali');
  });

  it('GuestsPicker_SiteWithManyHomes_AsksAndSaysTheResultsTellWhichTakeThem', () => {
    renderPicker();

    expect(screen.getByTestId('guests-pets')).toBeInTheDocument();
    expect(screen.getByTestId('guests-pets-hint')).toHaveTextContent('Ti diciamo quali case li ammettono');
  });

  it('GuestsPicker_PetsSwitchedOn_ReportsThePetAndKeepsTheGuests', () => {
    const onChange = renderPicker({ petsAllowed: false });

    fireEvent.click(screen.getByTestId('guests-pets'));

    expect(onChange).toHaveBeenLastCalledWith({ adults: 2, children: 0, pets: true });
  });

  it('GuestsPicker_InEnglish_AsksInEnglish', async () => {
    await i18n.changeLanguage('en');
    renderPicker();

    expect(screen.getByLabelText('Travelling with a pet?')).toBeInTheDocument();
  });
});
