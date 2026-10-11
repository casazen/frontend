import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { LongRentGuide } from '../long-rent-guide';

const queries = vi.hoisted(() => ({
  properties: { data: undefined as unknown[] | undefined },
  leases: { data: undefined as unknown[] | undefined },
}));
vi.mock('@/queries/use-properties', () => ({ useProperties: () => queries.properties }));
vi.mock('@/queries/use-leases', () => ({ useLeases: () => queries.leases }));

function renderGuide() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <LongRentGuide />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('LongRentGuide', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    queries.properties.data = undefined;
    queries.leases.data = undefined;
  });
  afterEach(cleanup);

  it('whileTheDataIsNotThere_ShowsNothing_NeverATodoItDoesNotKnow', () => {
    renderGuide();
    expect(screen.queryByTestId('long-rent-guide')).not.toBeInTheDocument();
    queries.properties.data = [];
    cleanup();
    renderGuide();
    expect(screen.queryByTestId('long-rent-guide')).not.toBeInTheDocument();
  });

  it('newLandlord_AsksForTheFirstPropertyAndHoldsTheLeaseBack', () => {
    queries.properties.data = [];
    queries.leases.data = [];
    renderGuide();

    expect(screen.getByTestId('long-rent-guide-property')).toHaveAttribute('data-state', 'todo');
    expect(screen.getByRole('link', { name: i18n.t('longRentGuide.steps.property.cta') })).toHaveAttribute(
      'href',
      '/app/long-rent/properties/new?first=1',
    );
    // A lease needs a property: no link yet.
    expect(screen.getByTestId('long-rent-guide-lease')).toHaveAttribute('data-state', 'todo');
    expect(screen.queryByRole('link', { name: i18n.t('longRentGuide.steps.lease.cta') })).not.toBeInTheDocument();
  });

  it('withAProperty_OffersTheFirstLease', () => {
    queries.properties.data = [{ id: 'p1' }];
    queries.leases.data = [];
    renderGuide();

    expect(screen.getByTestId('long-rent-guide-property')).toHaveAttribute('data-state', 'done');
    expect(screen.getByRole('link', { name: i18n.t('longRentGuide.steps.lease.cta') })).toHaveAttribute(
      'href',
      '/app/long-rent/leases/new',
    );
  });

  it('everyStepDone_TheGuideGoesAway', () => {
    queries.properties.data = [{ id: 'p1' }];
    queries.leases.data = [{ id: 'l1' }];
    renderGuide();
    expect(screen.queryByTestId('long-rent-guide')).not.toBeInTheDocument();
  });
});
