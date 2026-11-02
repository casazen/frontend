import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import * as leaseQueries from '@/queries/use-leases';
import * as aggregateQueries from '@/queries/use-long-rent-properties';
import * as propertyQueries from '@/queries/use-properties';
import type { LeaseSummary, Property } from '@/types';
import type { ServiceRequest } from '@/types/service-request';
import { LongRentPropertiesPage } from '../long-rent-properties-page';

const access = vi.hoisted(() => ({ writeProperties: true }));

vi.mock('@/features/onboarding/components/long-rent-guide', () => ({ LongRentGuide: () => null }));
vi.mock('@/queries/use-properties');
vi.mock('@/queries/use-leases');
vi.mock('@/queries/use-long-rent-properties');
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (_area: string, permission: string) => permission !== 'property.write' || access.writeProperties,
    activeContext: 'long-rent',
  }),
}));
vi.mock('@/hooks/use-list-views-scope', () => ({ useListViewsScope: () => null }));
// The window of the request has its own tests: here it is a stand-in that says which property it was opened for and can finish.
vi.mock('@/features/service-requests/components/service-request-form', () => ({
  ServiceRequestForm: ({ propertyId, context, onCreated }: { propertyId: string; context?: string; onCreated?: (request: ServiceRequest) => void }) => (
    <div data-testid="request-form" data-property={propertyId} data-context={context}>
      <button type="button" onClick={() => onCreated?.({ id: 'req-1' } as ServiceRequest)}>
        made
      </button>
    </div>
  ),
}));

const PROPERTY = { id: 'prop-1', name: 'Bilocale Monza', address: 'Via Italia 1', postalCode: '20900', city: 'Monza', bedrooms: 2, bathrooms: 1 } as unknown as Property;

function query<T>(result: Partial<{ data: T }>) {
  return { data: undefined, isLoading: false, isError: false, error: null, isFetching: false, refetch: vi.fn(), ...result };
}

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/app/long-rent/properties']}>
        <Routes>
          <Route path="/app/long-rent/properties" element={<LongRentPropertiesPage />} />
          <Route path="/app/long-rent/service-requests/:id" element={<div data-testid="request-page" />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

const openMenu = () => {
  const table = within(screen.getByRole('table'));
  fireEvent.keyDown(table.getByRole('button', { name: i18n.t('listView.row.more', { name: 'Bilocale Monza' }) }), { key: 'Enter' });
  return screen.findByRole('menu');
};

beforeEach(() => {
  void i18n.changeLanguage('it');
  access.writeProperties = true;
  vi.mocked(propertyQueries.useProperties).mockReturnValue(query({ data: [PROPERTY] }) as unknown as ReturnType<typeof propertyQueries.useProperties>);
  vi.mocked(leaseQueries.useLeases).mockReturnValue(query({ data: [] as LeaseSummary[] }) as unknown as ReturnType<typeof leaseQueries.useLeases>);
  vi.mocked(aggregateQueries.useLongRentPropertyAggregate).mockReturnValue(
    query({}) as unknown as ReturnType<typeof aggregateQueries.useLongRentPropertyAggregate>,
  );
});

describe('LongRentPropertiesPage: "Richiedi intervento" from the row (LR-07b)', () => {
  it('LongRentPropertiesPage_RequestFromTheRow_OpensTheRequestOnThatPropertyAndLeadsToTheNewOne', async () => {
    renderPage();

    const menu = await openMenu();
    fireEvent.click(within(menu).getByRole('menuitem', { name: i18n.t('longRentProperties.list.actions.request') }));

    // The window of the request, for this property and in the section of the long-term (never a booking).
    const form = screen.getByTestId('request-form');
    expect(form).toHaveAttribute('data-property', 'prop-1');
    expect(form).toHaveAttribute('data-context', 'long-rent');

    // Once made, the page of the new request is the way on.
    fireEvent.click(within(form).getByRole('button', { name: 'made' }));
    expect(screen.getByTestId('request-page')).toBeInTheDocument();
  });

  it('LongRentPropertiesPage_WithoutThePermissionToWriteProperties_HasNoRequestInTheMenu', async () => {
    access.writeProperties = false;
    renderPage();

    const menu = await openMenu();

    expect(within(menu).getByRole('menuitem', { name: i18n.t('longRentProperties.list.actions.page') })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: i18n.t('longRentProperties.list.actions.request') })).not.toBeInTheDocument();
    expect(screen.queryByTestId('request-form')).not.toBeInTheDocument();
  });
});
