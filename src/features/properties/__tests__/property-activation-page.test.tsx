import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import { PropertyActivationPage } from '../property-activation-page';

const reads = vi.hoisted(() => ({ canWrite: true, catalog: vi.fn() }));

vi.mock('../property-import-review', () => ({ PropertyImportReview: () => null }));
vi.mock('../property-activation-services', () => ({ PropertyActivationServices: () => null }));

vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock('@/hooks/use-feature-flags', () => ({
  useFeatureFlags: () => ({ flags: { octorateConnector: true } }),
}));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (_area: string, permission: string) => permission.endsWith('.read') || reads.canWrite }),
}));
vi.mock('@/queries/use-properties', () => ({
  SHORT_PROPERTIES_OVERVIEW: {},
  useProperties: () => ({
    data: [
      { id: 'one', name: 'Lario', city: 'Brienno', siteVisibility: 'Published' },
      { id: 'two', name: 'Villa', city: 'Varenna', lifecycleStatus: 'NeedsAttention' },
    ],
  }),
}));
vi.mock('@/queries/use-marketplace', () => ({
  useMarketplaceCatalog: (propertyId: string) => {
    reads.catalog(propertyId);
    return {
      data: {
        groups: [{
          id: 'salesChannels',
          entries: [{ kind: 'Channel', code: '142', name: 'Booking.com', status: 'Pending', canActivate: true, connectByPropertyId: true }],
        }],
      },
    };
  },
}));

function openPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/app/short-rent/activation${search}`]}>
      <PropertyActivationPage />
    </MemoryRouter>,
  );
}

describe('property activation overview', () => {
  it('keeps the search on return and scopes the catalog to the chosen property', () => {
    reads.canWrite = true;
    reads.catalog.mockClear();
    openPage('?propertyId=outside-scope');

    expect(reads.catalog).not.toHaveBeenCalled();
    const search = screen.getByRole('searchbox', { name: i18n.t('activationJourney.search') });
    fireEvent.change(search, { target: { value: 'Brienno' } });
    expect(screen.queryByRole('link', { name: /Villa/ })).not.toBeInTheDocument();
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    expect(screen.getByRole('link', { name: /Lario/ })).toHaveFocus();
    fireEvent.keyDown(search, { key: 'Enter' });

    const property = screen.getByRole('region', { name: 'Lario' });
    expect(reads.catalog).toHaveBeenLastCalledWith('one');
    expect(within(property).getByText(i18n.t('activationJourney.published'))).toBeInTheDocument();
    const setup = within(property).getByRole('link', { name: i18n.t('activationJourney.openChannel', { name: 'Booking.com' }) });
    const destination = new URL(setup.getAttribute('href')!, window.location.origin);
    expect(destination.pathname).toBe('/app/short-rent/marketplace/activate/channel/142');
    expect(destination.searchParams.get('propertyId')).toBe('one');
    expect(destination.searchParams.get('returnTo')).toBe('/app/short-rent/activation?propertyId=one&q=Brienno');
    expect(screen.getByRole('link', { name: i18n.t('activationJourney.back') })).toHaveAttribute('href', '/app/short-rent/activation?q=Brienno');
  });

  it('shows progress without setup actions in read-only scope', () => {
    reads.canWrite = false;
    openPage('?propertyId=two');

    const property = screen.getByRole('region', { name: 'Villa' });
    expect(within(property).getByText(i18n.t('activationJourney.needsAttention'))).toBeInTheDocument();
    expect(within(property).getByText('Booking.com')).toBeInTheDocument();
    expect(within(property).queryByRole('link', { name: i18n.t('activationJourney.openChannel', { name: 'Booking.com' }) })).not.toBeInTheDocument();
  });
});
