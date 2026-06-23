import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertySearchCard } from '../property-search-card';
import i18n from '@/i18n/config';
import type { PublicPropertyDto } from '@/types';

// PropertySearchCard renders links via PropertyCinBadge — no router needed for these tests
// but we stub MemoryRouter for any Link descendants.
import { MemoryRouter } from 'react-router-dom';
import { createElement } from 'react';

function withRouter(ui: React.ReactElement) {
  return createElement(MemoryRouter, null, ui);
}

const baseProperty: PublicPropertyDto = {
  id: 'prop-abc',
  name: 'Trastevere Suite',
  description: 'Appartamento luminoso nel cuore di Roma.',
  city: 'Roma',
  postalCode: '00153',
  bedrooms: 2,
  bathrooms: 1,
  maxGuests: 4,
  nightlyRate: 165,
  cleaningFee: 55,
  amenities: ['Wifi', 'Aria condizionata'],
  photoUrls: ['https://cdn.example.com/photo.jpg'],
  cinCode: 'IT-12345-0123456789',
  cinStatus: 'Valid',
  timezone: 'Europe/Rome',
};

describe('PropertySearchCard (listing card used in public booking site, AC6)', () => {
  it('renders the property name', () => {
    render(withRouter(<PropertySearchCard property={baseProperty} onViewDetails={vi.fn()} />));
    expect(screen.getByText('Trastevere Suite')).toBeInTheDocument();
  });

  it('renders the city', () => {
    render(withRouter(<PropertySearchCard property={baseProperty} onViewDetails={vi.fn()} />));
    // City and postalCode are rendered together e.g. "Roma (00153)"
    expect(screen.getAllByText(/Roma/).length).toBeGreaterThan(0);
  });

  it('renders the nightly rate', () => {
    render(withRouter(<PropertySearchCard property={baseProperty} onViewDetails={vi.fn()} />));
    // The rate is formatted as locale currency (e.g. "165,00 €" in Italian locale)
    expect(screen.getByText(/165/)).toBeInTheDocument();
  });

  it('renders capacity badges (beds, bathrooms, guests)', () => {
    render(withRouter(<PropertySearchCard property={baseProperty} onViewDetails={vi.fn()} />));
    const bedsLabel = i18n.t('search.card.bed_other', { count: 2 });
    const bathsLabel = i18n.t('search.card.bath_one', { count: 1 });
    const guestsLabel = i18n.t('search.card.guests', { count: 4 });
    expect(screen.getByText(new RegExp(`2 ${bedsLabel}`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`1 ${bathsLabel}`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`4 ${guestsLabel}`))).toBeInTheDocument();
  });

  it('shows the hero photo when photoUrls is non-empty', () => {
    render(withRouter(<PropertySearchCard property={baseProperty} onViewDetails={vi.fn()} />));
    const img = screen.getByRole('img', { name: 'Trastevere Suite' });
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/photo.jpg');
  });

  it('shows a fallback emoji when photoUrls is empty', () => {
    const noPhoto = { ...baseProperty, photoUrls: [] };
    render(withRouter(<PropertySearchCard property={noPhoto} onViewDetails={vi.fn()} />));
    expect(screen.getByText('🏠')).toBeInTheDocument();
  });

  it('calls onViewDetails with the property when details button is clicked', () => {
    const onViewDetails = vi.fn();
    render(withRouter(<PropertySearchCard property={baseProperty} onViewDetails={onViewDetails} />));

    const detailsLabel = i18n.t('search.card.details');
    fireEvent.click(screen.getByRole('button', { name: detailsLabel }));
    expect(onViewDetails).toHaveBeenCalledOnce();
    expect(onViewDetails).toHaveBeenCalledWith(baseProperty);
  });

  it('renders the CIN badge for a valid CIN', () => {
    render(withRouter(<PropertySearchCard property={baseProperty} onViewDetails={vi.fn()} />));
    // Badge shows label · cinCode when cinCode is present
    expect(screen.getByText(/CIN valido/)).toBeInTheDocument();
  });

  it('shows description when provided', () => {
    render(withRouter(<PropertySearchCard property={baseProperty} onViewDetails={vi.fn()} />));
    expect(screen.getByText(/Appartamento luminoso/)).toBeInTheDocument();
  });
});
