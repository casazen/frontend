import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { QuickPropertyForm } from '../quick-property-form';

// The real picker searches the official list through the API (its own tests): an input that "picks" a comune stands in.
vi.mock('@/components/shared/comune-picker', () => ({
  ComunePicker: ({ id, onChange }: { id: string; onChange: (c: { istatCode: string; name: string } | null) => void }) => (
    <button type="button" id={id} onClick={() => onChange({ istatCode: '058091', name: 'Roma' })}>
      pick-comune
    </button>
  ),
}));

function fill(id: string, value: string) {
  fireEvent.change(document.getElementById(id) as HTMLElement, { target: { value } });
}

function renderForm(variant: 'short-rent' | 'long-rent', onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const onFullForm = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <QuickPropertyForm variant={variant} onSubmit={onSubmit} isLoading={false} onFullForm={onFullForm} />
    </I18nextProvider>,
  );
  return { onSubmit, onFullForm };
}

describe('QuickPropertyForm', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });
  afterEach(cleanup);

  it('shortRent_SendsOnlyWhatTheApiNeedsWithTheSameDefaultsAsTheFullForm', async () => {
    const { onSubmit } = renderForm('short-rent');

    fill('name', 'Casa Duomo');
    fireEvent.click(screen.getByText('pick-comune'));
    fill('address', 'Via Roma 1');
    fill('postalCode', '00153');
    fill('maxGuests', '4');
    fill('nightlyRate', '120');
    fireEvent.click(screen.getByTestId('quick-property-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Casa Duomo',
      address: 'Via Roma 1',
      city: 'Roma',
      comuneIstatCode: '058091',
      postalCode: '00153',
      description: '',
      bedrooms: 1,
      bathrooms: 1,
      maxGuests: 4,
      nightlyRate: 120,
      timezone: 'Europe/Rome',
    });
  });

  it('longRent_HasNoNightlyRateNorGuests_AndSendsThemAsNotSet', async () => {
    const { onSubmit } = renderForm('long-rent');
    expect(document.getElementById('nightlyRate')).toBeNull();
    expect(document.getElementById('maxGuests')).toBeNull();

    fill('name', 'Bilocale Navigli');
    fireEvent.click(screen.getByText('pick-comune'));
    fill('address', 'Via Torino 20');
    fill('postalCode', '20123');
    fireEvent.click(screen.getByTestId('quick-property-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ maxGuests: 0, nightlyRate: 0, comuneIstatCode: '058091' });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('timezone');
  });

  it('withoutAComuneFromTheList_DoesNotSubmitAndSaysSo', async () => {
    const { onSubmit } = renderForm('short-rent');

    fill('name', 'Casa Duomo');
    fill('address', 'Via Roma 1');
    fill('postalCode', '00153');
    fill('maxGuests', '2');
    fill('nightlyRate', '90');
    fireEvent.click(screen.getByTestId('quick-property-submit'));

    expect(await screen.findByText(i18n.t('property.quick.validation.comuneRequired'))).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('theCompleteFormStaysOneClickAway', () => {
    const { onFullForm } = renderForm('short-rent');
    fireEvent.click(screen.getByTestId('quick-property-full-form'));
    expect(onFullForm).toHaveBeenCalled();
  });
});
