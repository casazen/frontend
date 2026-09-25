import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { PricingDashboardPage } from '../pricing-dashboard-page';
import * as pricingQueries from '@/queries/use-pricing-adapter';
import type { PricingAdapterConfig, SeasonalSuggestionsResponse } from '@/types';

vi.mock('@/queries/use-pricing-adapter');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', { 'data-testid': 'app-shell' }, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));
vi.mock('@/components/shared/loading-screen', () => ({
  LoadingScreen: ({ message }: { message: string }) => createElement('div', { 'data-testid': 'loading' }, message),
}));
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children?: React.ReactNode }) => createElement('div', { 'data-testid': 'line-chart' }, children),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => createElement('div', null, children),
}));

// The page reads only a few fields of each hook result: partial objects are cast to the full type.
type ConfigResult = ReturnType<typeof pricingQueries.usePricingAdapterConfig>;
type SuggestionsResult = ReturnType<typeof pricingQueries.useSeasonalSuggestions>;
type SaveResult = ReturnType<typeof pricingQueries.useSavePricingAdapterConfig>;
type DisableResult = ReturnType<typeof pricingQueries.useDisablePricingAdapter>;
type RecalculateResult = ReturnType<typeof pricingQueries.useRecalculateSuggestions>;

const PROPERTY_ID = 'prop-test';

const mockConfig: PricingAdapterConfig = {
  propertyId: PROPERTY_ID,
  isEnabled: true,
  adaptationFrequency: 'weekly',
  includeSeasonality: true,
  highSeasonMonths: [6, 7, 8],
  highSeasonMultiplier: 1.3,
  lowSeasonMonths: [1, 2, 11, 12],
  lowSeasonMultiplier: 0.8,
  includePublicHolidays: true,
  holidayMultiplier: 1.5,
  lastAdaptedAt: '2026-07-01T02:00:00Z',
  nextRunOn: '2026-07-08',
  createdAt: '2026-05-11T00:00:00Z',
  updatedAt: '2026-05-11T00:00:00Z',
};

const mockSuggestions: SeasonalSuggestionsResponse = {
  isEnabled: true,
  currentBasePrice: 180,
  computedAt: '2026-07-01T02:00:00Z',
  nextRunOn: '2026-07-08',
  items: [
    { date: '2026-07-01', basePrice: 180, suggestedPrice: 234, multiplier: 1.3, rule: 'HighSeason', holiday: null },
    { date: '2026-08-15', basePrice: 180, suggestedPrice: 270, multiplier: 1.5, rule: 'Holiday', holiday: 'Assumption' },
    { date: '2026-09-01', basePrice: 180, suggestedPrice: 180, multiplier: 1, rule: 'None', holiday: null },
  ],
};

function noopMutation() {
  return { mutate: vi.fn(), isPending: false, isSuccess: false, isError: false };
}

function renderPage(propertyId = PROPERTY_ID) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(I18nextProvider, { i18n },
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: [`/properties/${propertyId}/pricing`] },
          createElement(Routes, null,
            createElement(Route, { path: '/properties/:id/pricing', element: createElement(PricingDashboardPage) })
          )
        )
      )
    )
  );
}

function setupAllMocks(overrides: Partial<{
  config: Partial<ConfigResult>;
  suggestions: Partial<SuggestionsResult>;
  disableMutate: ReturnType<typeof vi.fn>;
  saveMutate: ReturnType<typeof vi.fn>;
  recalculateMutate: ReturnType<typeof vi.fn>;
}> = {}) {
  const {
    config = { data: mockConfig, isLoading: false, isError: false },
    suggestions = { data: mockSuggestions, isLoading: false, isError: false },
    disableMutate = vi.fn(),
    saveMutate = vi.fn(),
    recalculateMutate = vi.fn(),
  } = overrides;

  vi.mocked(pricingQueries.usePricingAdapterConfig).mockReturnValue({ refetch: vi.fn(), ...config } as unknown as ConfigResult);
  vi.mocked(pricingQueries.useSeasonalSuggestions).mockReturnValue({ refetch: vi.fn(), ...suggestions } as unknown as SuggestionsResult);
  vi.mocked(pricingQueries.useSavePricingAdapterConfig).mockReturnValue({ ...noopMutation(), mutate: saveMutate } as unknown as SaveResult);
  vi.mocked(pricingQueries.useDisablePricingAdapter).mockReturnValue({ ...noopMutation(), mutate: disableMutate } as unknown as DisableResult);
  vi.mocked(pricingQueries.useRecalculateSuggestions).mockReturnValue({ ...noopMutation(), mutate: recalculateMutate } as unknown as RecalculateResult);
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
});

describe('PricingDashboardPage', () => {
  it('PricingDashboardPage_ConfigLoading_ShowsLoadingScreen', () => {
    setupAllMocks({ config: { data: undefined, isLoading: true, isError: false } });

    renderPage();

    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('PricingDashboardPage_Rendered_UsesSeasonalSuggestionsNamesWithoutAiOrConfidence', () => {
    setupAllMocks();

    const { container } = renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Suggerimenti stagionali' })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\bAI\b/);
    expect(container.textContent).not.toMatch(/confidenz|confidence/i);
  });

  it('PricingDashboardPage_Enabled_ShowsRealBasePriceAndRuleAppliedPerDate', () => {
    setupAllMocks();

    renderPage();

    expect(screen.getByTestId('current-base-price')).toHaveTextContent('180,00');
    const table = screen.getByTestId('suggestions-table');
    const rows = within(table).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('234,00');
    expect(rows[1]).toHaveTextContent('Alta stagione ×1,30');
    expect(rows[2]).toHaveTextContent('Festività: Ferragosto ×1,50');
    expect(rows[3]).toHaveTextContent('Nessuna regola (prezzo base)');
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('PricingDashboardPage_Enabled_StatesThatSuggestionsAreReadOnly', () => {
    setupAllMocks();

    renderPage();

    expect(screen.getByTestId('read-only-notice')).toHaveTextContent(/non vengono applicati a preventivi e prenotazioni/);
  });

  it('PricingDashboardPage_NightlyRateChangedAfterComputation_WarnsToRecalculate', () => {
    setupAllMocks({ suggestions: { data: { ...mockSuggestions, currentBasePrice: 200 }, isLoading: false, isError: false } });

    renderPage();

    expect(screen.getByTestId('base-changed-warning')).toHaveTextContent(/180,00.*200,00/);
  });

  it('PricingDashboardPage_Disabled_ShowsDisabledStateWithoutSuggestions', () => {
    setupAllMocks({ config: { data: { ...mockConfig, isEnabled: false }, isLoading: false, isError: false } });

    renderPage();

    expect(screen.getByText('Suggerimenti stagionali disattivati')).toBeInTheDocument();
    expect(screen.queryByTestId('suggestions-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recalculate-btn')).not.toBeInTheDocument();
  });

  it('PricingDashboardPage_SuggestionsRequestFails_ShowsErrorNotEmptyList', () => {
    setupAllMocks({ suggestions: { data: undefined, isLoading: false, isError: true, error: new Error('boom') } });

    renderPage();

    expect(screen.getByTestId('suggestions-error')).toHaveTextContent('Impossibile caricare i suggerimenti stagionali.');
    expect(screen.queryByText('Nessun suggerimento calcolato')).not.toBeInTheDocument();
  });

  it('PricingDashboardPage_ConfigRequestFails_ShowsError', () => {
    setupAllMocks({ config: { data: undefined, isLoading: false, isError: true, error: new Error('boom') } });

    renderPage();

    expect(screen.getByTestId('config-error')).toBeInTheDocument();
    expect(screen.queryByTestId('pricing-toggle')).not.toBeInTheDocument();
  });

  it('PricingDashboardPage_SuggestionsLoading_ShowsSkeleton', () => {
    setupAllMocks({ suggestions: { data: undefined, isLoading: true, isError: false } });

    renderPage();

    expect(screen.getByTestId('suggestions-loading')).toBeInTheDocument();
  });

  it('PricingDashboardPage_NoNightlyRate_AsksToSetIt', () => {
    setupAllMocks({ suggestions: { data: { ...mockSuggestions, currentBasePrice: 0, items: [] }, isLoading: false, isError: false } });

    renderPage();

    expect(screen.getByText('Manca il prezzo per notte')).toBeInTheDocument();
  });

  it('PricingDashboardPage_NotComputedYet_OffersRecalculation', () => {
    const recalculateMutate = vi.fn();
    setupAllMocks({
      recalculateMutate,
      suggestions: { data: { ...mockSuggestions, items: [], computedAt: null }, isLoading: false, isError: false },
    });

    renderPage();

    expect(screen.getByText('Nessun suggerimento calcolato')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Ricalcola ora' })[1]);
    expect(recalculateMutate).toHaveBeenCalled();
  });

  it('PricingDashboardPage_ToggleOff_DisablesSuggestions', async () => {
    const disableMutate = vi.fn();
    setupAllMocks({ disableMutate });

    renderPage();
    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(disableMutate).toHaveBeenCalled());
  });

  it('PricingDashboardPage_ToggleOn_SavesEnabledConfigWithCurrentRules', async () => {
    const saveMutate = vi.fn();
    setupAllMocks({ saveMutate, config: { data: { ...mockConfig, isEnabled: false }, isLoading: false, isError: false } });

    renderPage();
    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({ isEnabled: true, adaptationFrequency: 'weekly', highSeasonMonths: [6, 7, 8], holidayMultiplier: 1.5 })
    ));
  });

  it('PricingDashboardPage_EditRules_SavesExplicitMonthsAndMultipliers', async () => {
    const saveMutate = vi.fn();
    setupAllMocks({ saveMutate });

    renderPage();
    // September moves to the high season, August leaves it; +40% in high season.
    fireEvent.click(screen.getByTestId('high-month-9'));
    fireEvent.click(screen.getByTestId('high-month-8'));
    fireEvent.change(screen.getByTestId('high-season-multiplier'), { target: { value: '1.4' } });
    fireEvent.click(screen.getByTestId('save-config-btn'));

    await waitFor(() => expect(saveMutate).toHaveBeenCalledWith({
      isEnabled: true,
      adaptationFrequency: 'weekly',
      includeSeasonality: true,
      highSeasonMonths: [6, 7, 9],
      highSeasonMultiplier: 1.4,
      lowSeasonMonths: [1, 2, 11, 12],
      lowSeasonMultiplier: 0.8,
      includePublicHolidays: true,
      holidayMultiplier: 1.5,
    }));
  });

  it('PricingDashboardPage_MonthPickedForLowSeason_LeavesHighSeason', async () => {
    const saveMutate = vi.fn();
    setupAllMocks({ saveMutate });

    renderPage();
    fireEvent.click(screen.getByTestId('low-month-8'));
    fireEvent.click(screen.getByTestId('save-config-btn'));

    await waitFor(() => expect(saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({ highSeasonMonths: [6, 7], lowSeasonMonths: [1, 2, 8, 11, 12] })
    ));
  });

  it('PricingDashboardPage_MultiplierOutOfRange_BlocksSaveWithMessage', () => {
    const saveMutate = vi.fn();
    setupAllMocks({ saveMutate });

    renderPage();
    fireEvent.change(screen.getByTestId('holiday-multiplier'), { target: { value: '9' } });

    expect(screen.getByText('Inserisci un moltiplicatore tra 0,1 e 5.')).toBeInTheDocument();
    expect(screen.getByTestId('save-config-btn')).toBeDisabled();
  });

  it('PricingDashboardPage_RecalculateClicked_RunsRecalculation', () => {
    const recalculateMutate = vi.fn();
    setupAllMocks({ recalculateMutate });

    renderPage();
    fireEvent.click(screen.getByTestId('recalculate-btn'));

    expect(recalculateMutate).toHaveBeenCalled();
  });

  it('PricingDashboardPage_Enabled_ShowsNextUpdateDate', () => {
    setupAllMocks();

    renderPage();

    expect(screen.getByTestId('next-run')).toHaveTextContent('08/07/2026');
  });

  it('PricingDashboardPage_EnglishLocale_TranslatesRuleAndHoliday', async () => {
    await i18n.changeLanguage('en');
    setupAllMocks();

    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Seasonal suggestions' })).toBeInTheDocument();
    expect(screen.getByText('Holiday: Assumption Day (Ferragosto) ×1.50')).toBeInTheDocument();
  });
});
