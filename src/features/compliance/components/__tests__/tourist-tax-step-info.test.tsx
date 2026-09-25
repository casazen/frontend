import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { ActivationTouristTax } from '@/types/compliance.types';
import { TouristTaxStepInfo } from '../tourist-tax-step-info';

function renderInfo(touristTax: ActivationTouristTax | null, city = 'Milano') {
  return render(
    <MemoryRouter>
      <TouristTaxStepInfo touristTax={touristTax} city={city} />
    </MemoryRouter>,
  );
}

const milano: ActivationTouristTax = {
  city: 'Milano',
  publicPageSlug: null,
  rate: {
    ratePerPersonPerNight: 9.5,
    maxNights: 14,
    minimumAge: 18,
    effectiveFrom: '2026-01-01T00:00:00Z',
    effectiveTo: null,
    sourceUrl: 'https://www.comune.milano.it/tariffe',
    verificationLevel: 'Official',
  },
};

describe('TouristTaxStepInfo', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('render_KnownRate_ShowsRateDetailsAndOfficialSource', () => {
    renderInfo(milano);

    expect(screen.getByText('Imposta di soggiorno a Milano')).toBeInTheDocument();
    expect(screen.getByText(/9,50/)).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('Esenti gli ospiti con meno di 18 anni')).toBeInTheDocument();
    expect(screen.getByText('01/01/2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Fonte ufficiale del comune/ })).toHaveAttribute(
      'href',
      'https://www.comune.milano.it/tariffe',
    );
    expect(screen.queryByTestId('activation-tourist-tax-missing')).not.toBeInTheDocument();
  });

  it('render_NoRateWithPublicPage_ShowsWarningAndLinksThePublicPageOnly', () => {
    renderInfo({ city: 'Palermo', rate: null, publicPageSlug: 'palermo' }, 'Palermo');

    expect(screen.getByRole('status')).toHaveTextContent('Il comune di Palermo non ha ancora una tariffa in CasaZen.');
    expect(screen.getByRole('status')).toHaveTextContent('Puoi completare comunque l');
    const link = screen.getByRole('link', { name: /Guida all'imposta di soggiorno a Palermo/ });
    expect(link).toHaveAttribute('href', '/p/tassa-soggiorno/palermo');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(document.querySelector('a[href*="/admin/"]')).toBeNull();
  });

  it('render_NoRateWithoutPublicPage_ShowsWarningWithoutLinks', () => {
    renderInfo({ city: 'Seveso', rate: null, publicPageSlug: null }, 'Seveso');

    expect(screen.getByRole('status')).toHaveTextContent('Il comune di Seveso non ha ancora una tariffa in CasaZen.');
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('render_NoInfoAndNoCity_AsksForTheCity', () => {
    renderInfo(null, '');

    expect(screen.getByRole('status')).toHaveTextContent("Inserisci la città dell'immobile nei dati base");
  });

  it('render_NoAgeExemptionInEnglish_ShowsEnglishTexts', async () => {
    await i18n.changeLanguage('en');
    renderInfo({ ...milano, rate: { ...milano.rate!, minimumAge: 0, maxNights: null } });

    expect(screen.getByText('Tourist tax in Milano')).toBeInTheDocument();
    expect(screen.getByText('No age exemption')).toBeInTheDocument();
    expect(screen.getByText('No limit')).toBeInTheDocument();
  });
});
