import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { PropertyForm } from '../property-form';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

function fill(label: string, value: string | number) {
  fireEvent.change(screen.getByLabelText(i18n.t(label)), { target: { value } });
}

describe('PropertyForm long-rent variant (A7-06)', () => {
  beforeEach(() => {
    void i18n.changeLanguage('it');
  });

  it('PropertyForm_LongRent_HidesShortStayFieldsAndSubmitsWithoutNightlyRate', async () => {
    const onSubmit = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <PropertyForm variant="long-rent" onSubmit={onSubmit} />
      </I18nextProvider>,
    );

    expect(screen.queryByLabelText(i18n.t('property.form.nightlyRate'))).not.toBeInTheDocument();
    expect(screen.queryByLabelText(i18n.t('property.form.maxGuests'))).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-cin-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-slug-input')).not.toBeInTheDocument();

    fill('property.form.name', 'Bilocale Monza');
    fill('property.form.description', 'Bilocale luminoso per locazione a lungo termine');
    fill('property.form.address', 'Via Italia 1');
    fill('property.form.city', 'Monza');
    fill('property.form.postalCode', '20900');
    fill('property.form.bedrooms', 2);
    fill('property.form.bathrooms', 1);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('property.form.create') }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: 'Bilocale Monza',
      city: 'Monza',
      bedrooms: 2,
      bathrooms: 1,
      nightlyRate: 0,
      maxGuests: 0,
    });
  });

  it('PropertyForm_ShortRent_StillRequiresTheNightlyRate', async () => {
    const onSubmit = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <PropertyForm onSubmit={onSubmit} />
      </I18nextProvider>,
    );

    fill('property.form.name', 'Casa Vacanze');
    fill('property.form.description', 'Appartamento per affitti brevi in centro');
    fill('property.form.address', 'Via Roma 10');
    fill('property.form.city', 'Roma');
    fill('property.form.postalCode', '00100');
    fill('property.form.bedrooms', 2);
    fill('property.form.bathrooms', 1);
    fill('property.form.maxGuests', 4);
    fill('property.form.nightlyRate', 0);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('property.form.create') }));

    expect(await screen.findByText(i18n.t('property.validation.nightlyRate.min'))).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
