import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import * as propertyQueries from '@/queries/use-properties';
import * as cinQueries from '@/queries/use-cin';
import type { Property } from '@/types';
import { PropertiesPage } from '../properties-page';

vi.mock('@/queries/use-properties', () => ({
  useProperties: vi.fn(),
  useUpdateProperty: vi.fn(),
  useCreateProperty: vi.fn(),
  useCancellationPolicies: vi.fn(),
}));
vi.mock('@/queries/use-cin', () => ({ useCinCompliance: vi.fn() }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));

/** A row as `GET /properties` returns it: no country nor currency field. */
const STUDIO = {
  id: 'prop-1',
  name: 'Monolocale sul porto',
  description: '',
  address: 'Via del Porto 3',
  city: 'Genova',
  postalCode: '16128',
  bedrooms: 0,
  bathrooms: 1,
  maxGuests: 2,
  nightlyRate: 120,
  cleaningFee: 60,
  damageDeposit: 0,
  amenities: ['WiFi', 'Kitchen', 'AirConditioning', 'Heating'],
  photoUrls: [],
  houseRules: '',
  cinCode: null,
  timezone: 'Europe/Rome',
  cancellationPolicyId: null,
  isActive: true,
  ownerId: 'auth0|owner',
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: '2026-09-01T10:00:00Z',
} satisfies Property;

function mockList(result: Partial<{ data: Property[]; isLoading: boolean; error: unknown }>) {
  vi.mocked(propertyQueries.useProperties).mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    ...result,
  } as unknown as ReturnType<typeof propertyQueries.useProperties>);
}

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <PropertiesPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('PropertiesPage (A2-27)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.mocked(cinQueries.useCinCompliance).mockReturnValue({ data: undefined } as unknown as ReturnType<
      typeof cinQueries.useCinCompliance
    >);
    const mutation = { mutateAsync: vi.fn(), isPending: false };
    vi.mocked(propertyQueries.useUpdateProperty).mockReturnValue(
      mutation as unknown as ReturnType<typeof propertyQueries.useUpdateProperty>,
    );
    vi.mocked(propertyQueries.useCreateProperty).mockReturnValue(
      mutation as unknown as ReturnType<typeof propertyQueries.useCreateProperty>,
    );
  });

  it('PropertiesPage_Row_ShowsEuroPriceFullAddressTranslatedLabelsAndAnEditAction', () => {
    mockList({ data: [STUDIO] });

    renderPage();

    const row = screen.getByRole('link', { name: STUDIO.name }).closest('tr')!;
    const cells = within(row);
    expect(cells.getByText('Via del Porto 3, 16128 Genova')).toBeInTheDocument();
    expect(row).not.toHaveTextContent('undefined');
    // Amounts are in euros: never a "$" whatever the row carries.
    expect(row).toHaveTextContent(/120,00\s€/);
    expect(row).not.toHaveTextContent('$');
    // Studio flat and bathrooms, translated.
    expect(i18n.t('property.table.bedroomsCount', { count: 0 })).toBe('Monolocale');
    expect(row).toHaveTextContent('Monolocale · 1 bagno');
    expect(row).toHaveTextContent(i18n.t('property.table.bathroomsCount', { count: 1 }));
    // Amenities by their label, not the API enum name.
    expect(cells.getByText('Cucina')).toBeInTheDocument();
    expect(cells.getByText('Aria condizionata')).toBeInTheDocument();
    expect(cells.queryByText('AirConditioning')).not.toBeInTheDocument();
    expect(cells.getByText('+1')).toBeInTheDocument();
    // The row action opens the edit page; no button without an action.
    const edit = cells.getByRole('link', { name: i18n.t('property.table.editAria', { name: STUDIO.name }) });
    expect(edit).toHaveAttribute('href', '/app/short-rent/properties/prop-1/edit');
    for (const button of cells.getAllByRole('button')) {
      expect(button).toHaveAccessibleName();
    }
  });

  it('PropertiesPage_EnglishRow_UsesEnglishLabels', async () => {
    await i18n.changeLanguage('en');
    mockList({ data: [STUDIO] });

    renderPage();

    const row = screen.getByRole('link', { name: STUDIO.name }).closest('tr')!;
    expect(row).toHaveTextContent('Studio');
    expect(row).toHaveTextContent('1 bathroom');
    expect(within(row).getByText('Kitchen')).toBeInTheDocument();
  });

  it('PropertiesPage_RowWithoutShortStayRate_ShowsNotSetInsteadOfZero', () => {
    mockList({ data: [{ ...STUDIO, nightlyRate: 0 }] });

    renderPage();

    const row = screen.getByRole('link', { name: STUDIO.name }).closest('tr')!;
    expect(row).toHaveTextContent(i18n.t('property.table.noRate'));
  });

  it('PropertiesPage_LoadError_ShowsTheErrorNotAnEmptyList', () => {
    mockList({ error: new Error('boom') });

    renderPage();

    expect(screen.getByText(i18n.t('property.page.errorLoad'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('property.page.emptyTitle'))).not.toBeInTheDocument();
  });

  it('PropertiesPage_NoProperties_ShowsTheEmptyState', () => {
    mockList({ data: [] });

    renderPage();

    expect(screen.getByText(i18n.t('property.page.emptyTitle'))).toBeInTheDocument();
  });
});
