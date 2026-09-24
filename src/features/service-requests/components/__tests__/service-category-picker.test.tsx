import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { ServiceCategoryPicker, ServiceCategorySelect } from '../service-category-picker';
import { keepKnownCategories, unknownCategories } from '@/lib/service-categories';

const { fetchServiceCategories } = vi.hoisted(() => ({ fetchServiceCategories: vi.fn() }));
vi.mock('@/api/service-categories.api', () => ({ fetchServiceCategories }));

const CATALOG = ['cleaning', 'maintenance', 'gardening'];

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('ServiceCategoryPicker', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    fetchServiceCategories.mockResolvedValue(CATALOG);
    await i18n.changeLanguage('it');
  });

  it('ServiceCategoryPicker_CatalogLoaded_ShowsTranslatedCodesAndTogglesCodes', async () => {
    const onChange = vi.fn();
    renderWithClient(<ServiceCategoryPicker value={['cleaning']} onChange={onChange} />);

    const cleaning = await screen.findByTestId('service-category-cleaning');
    expect(cleaning).toHaveTextContent('Pulizie');
    expect(cleaning).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('service-category-gardening')).toHaveTextContent('Giardinaggio');

    fireEvent.click(screen.getByTestId('service-category-maintenance'));
    expect(onChange).toHaveBeenLastCalledWith(['cleaning', 'maintenance']);

    fireEvent.click(cleaning);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('ServiceCategoryPicker_StoredValueNotACode_WarnsThatItWillBeRemoved', async () => {
    renderWithClient(<ServiceCategoryPicker value={['cleaning', 'Idraulica speciale']} onChange={vi.fn()} />);

    const warning = await screen.findByTestId('service-categories-unknown');
    expect(warning).toHaveTextContent('Idraulica speciale');
    expect(screen.queryByText('Idraulica speciale', { selector: 'button' })).toBeNull();
  });

  it('ServiceCategoryPicker_CatalogFails_ShowsErrorAndRetries', async () => {
    fetchServiceCategories.mockRejectedValueOnce(new Error('network'));
    renderWithClient(<ServiceCategoryPicker value={[]} onChange={vi.fn()} />);

    const error = await screen.findByTestId('service-categories-error');
    expect(error).toHaveTextContent(i18n.t('serviceCategories.loadError'));
    expect(screen.queryByTestId('service-category-picker')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('serviceCategories.retry') }));
    expect(await screen.findByTestId('service-category-cleaning')).toBeInTheDocument();
  });

  it('ServiceCategorySelect_WithEmptyOption_ListsAllThenCodes', async () => {
    const onChange = vi.fn();
    renderWithClient(
      <ServiceCategorySelect value="" onChange={onChange} emptyOptionLabel="Tutte" data-testid="filter" />,
    );

    const select = (await screen.findByTestId('filter')) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['', ...CATALOG]);
    fireEvent.change(select, { target: { value: 'gardening' } });
    expect(onChange).toHaveBeenCalledWith('gardening');
  });
});

describe('service category helpers', () => {
  it('keepKnownCategories_CatalogLoaded_DropsValuesThatAreNotCodes', () => {
    expect(keepKnownCategories(['cleaning', 'Pulizie'], CATALOG)).toEqual(['cleaning']);
    expect(unknownCategories(['cleaning', 'Pulizie'], CATALOG)).toEqual(['Pulizie']);
  });

  it('keepKnownCategories_CatalogMissing_KeepsEverythingForTheApiToValidate', () => {
    expect(keepKnownCategories(['Pulizie'], undefined)).toEqual(['Pulizie']);
    expect(unknownCategories(['Pulizie'], undefined)).toEqual([]);
  });
});
