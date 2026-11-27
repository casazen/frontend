import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import enLocale from '@/i18n/locales/en.json';
import itLocale from '@/i18n/locales/it.json';
import type { DashboardOverview } from '@/types/dashboard.types';
import { HomeNumbers } from '../components/home-numbers';

// NF-96 / AC-NF96-1: ADR, RevPAR and the year-over-year trend live on the Reports page. The Home keeps its calm rules: one "Now"
// block and at most three numbers. This is the guard that a later change does not add them back.

const OVERVIEW: DashboardOverview = {
  period: { kind: 'Month', from: '2026-11-01', to: '2026-11-30', nights: 30 },
  today: '2026-11-05',
  propertyCount: 2,
  occupancy: { occupiedNights: 30, availableNights: 60, closedNights: 0, rate: 0.5, deltaPoints: 3.5 },
  revenue: { amount: 1200, currency: 'EUR', stayCount: 4, deltaPercent: 6.5 },
  upcoming: { count: 3, previousCount: 2, pendingApproval: 1 },
  nextArrivals: [
    {
      bookingId: 'b-1',
      propertyId: 'p-1',
      propertyName: 'Casa Mare',
      guestName: 'Sofia Marino',
      numberOfGuests: 2,
      checkInDate: '2026-11-07T00:00:00',
      checkOutDate: '2026-11-09T00:00:00',
      awaitingApproval: false,
    },
  ],
};

const REPORT_ONLY_NUMBERS = /\bADR\b|RevPAR/i;

/** Every text of a branch of a locale file. */
function textsOf(tree: unknown): string[] {
  if (typeof tree === 'string') return [tree];
  if (Array.isArray(tree)) return tree.flatMap(textsOf);
  if (tree !== null && typeof tree === 'object') return Object.values(tree).flatMap(textsOf);
  return [];
}

/** The strip of the Home, rendered with the revenue it shows to who may read payments (the fullest it gets). */
function renderNumbers(): HTMLElement {
  render(
    <MemoryRouter>
      <HomeNumbers overview={OVERVIEW} period="month" />
    </MemoryRouter>,
  );
  return screen.getByTestId('home-numbers');
}

describe('the calm rules of the Home (NF-96)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('it');
  });

  it('HomeNumbers_FullestOverview_RendersAtMostThreeNumbers', () => {
    const strip = renderNumbers();

    // The strip is a list; the list of the next arrivals is not a number, the other items are the tiles.
    const items = Array.from(strip.querySelector('ul')?.children ?? []);
    const tiles = items.filter((item) => item.querySelector('[data-testid="home-next-arrivals"]') === null);

    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThanOrEqual(3);
  });

  it.each(['it', 'en'])('HomeNumbers_%s_NeverShowsAdrOrRevPar', async (language) => {
    await i18n.changeLanguage(language);

    expect(renderNumbers().textContent).not.toMatch(REPORT_ONLY_NUMBERS);
  });

  it('HomeTexts_BothLanguages_NeverMentionAdrOrRevPar', () => {
    for (const locale of [itLocale, enLocale]) {
      expect(textsOf(locale.dashboard).filter((text) => REPORT_ONLY_NUMBERS.test(text))).toEqual([]);
    }
  });
});
