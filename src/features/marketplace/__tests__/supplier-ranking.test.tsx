import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { SupplierPicker } from '@/types/service-request';
import { SupplierCard } from '../components/supplier-card';
import { SUPPLIER_SORTS, useSupplierFilters } from '../lib/use-supplier-filters';

const supplier = (overrides: Partial<SupplierPicker> = {}): SupplierPicker => ({
  orgId: 'org-1',
  legalName: 'Pulizie Rossi',
  phone: '',
  email: '',
  categories: ['cleaning'],
  comuni: ['Rimini'],
  photoUrls: [],
  ...overrides,
});

function renderCard(item: SupplierPicker, onOpen = vi.fn()) {
  render(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(SupplierCard, { supplier: item, rows: { facts: false, bio: false }, onOpen }),
    ),
  );
  return onOpen;
}

function filtersAt(address: string) {
  const wrapper = ({ children }: { children: ReactNode }) => createElement(MemoryRouter, { initialEntries: [address] }, children);
  return renderHook(() => useSupplierFilters(), { wrapper }).result.current;
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

describe('the ranking of the suppliers (SP-REL): what the host sees', () => {
  it('SupplierCard_OnlyTheSupplierTheServerMarks_IsSaidRecommended_WithoutAnyScore', () => {
    renderCard(supplier({ recommended: true, verified: true }));

    expect(screen.getByTestId('supplier-recommended-badge')).toHaveTextContent('Consigliato');
    // The badge is a word: no number, no points, no star count anywhere on the card.
    expect(screen.getByTestId('marketplace-supplier-org-1').textContent).not.toMatch(/\d+\s*(punti|pt|\/\s*100)/i);
    expect(screen.getByTestId('marketplace-verified-badge')).toBeInTheDocument();
  });

  it('SupplierCard_ASupplierThatIsNotMarked_HasNoBadge_AndTheCardStillOpens', () => {
    const onOpen = renderCard(supplier({ recommended: false }));
    renderCard(supplier({ orgId: 'org-2' }));

    expect(screen.queryByTestId('supplier-recommended-badge')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('marketplace-supplier-org-1'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('useSupplierFilters_TheListStartsFromTheRanking_AndTheOtherOrdersAreOneChoiceAway', () => {
    expect(SUPPLIER_SORTS[0]).toBe('recommended');
    expect(SUPPLIER_SORTS).toEqual(['recommended', 'name', 'price', 'response']);

    const start = filtersAt('/marketplace');
    expect(start.sort).toBe('recommended');
    expect(start.active).toBe(0);

    // The plain address is the plain list: asking for the ranking is not a filter; another order is one.
    expect(filtersAt('/marketplace?sort=recommended').active).toBe(0);
    const byPrice = filtersAt('/marketplace?sort=price');
    expect(byPrice.sort).toBe('price');
    expect(byPrice.active).toBe(1);
    // An order this version does not know is the start.
    expect(filtersAt('/marketplace?sort=rating').sort).toBe('recommended');
  });
});
