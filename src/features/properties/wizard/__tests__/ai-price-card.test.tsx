import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import i18n from '@/i18n/config';
import { priceSuggestionApi } from '@/api/price-suggestion.api';
import type { PriceSuggestion } from '@/types';
import { NEW_PROPERTY_DEFAULTS, type PropertyWizardValues } from '../property-wizard-model';
import { AiPriceCard } from '../steps/ai-price-card';

vi.mock('@/api/price-suggestion.api');

const PROPERTY_ID = 'prop-1';

const BASIS = {
  comune: 'Como',
  province: 'CO',
  region: 'Lombardia',
  similarListings: 5,
  amenities: 2,
  usedFields: ['type', 'guests', 'bedrooms', 'area', 'amenities'],
} satisfies PriceSuggestion['basedOn'];

const AI_ANSWER: PriceSuggestion = {
  aiUsed: true,
  reason: null,
  nightlyRate: 140,
  rangeMin: 120,
  rangeMax: 165,
  cleaningFee: 60,
  weekendSurchargePercent: 15,
  minNights: 2,
  rationale: 'Zona centrale e terrazza.',
  basedOn: BASIS,
};

const NO_AI = (reason: NonNullable<PriceSuggestion['reason']>, rate: number | null): PriceSuggestion => ({
  aiUsed: false,
  reason,
  nightlyRate: rate,
  rangeMin: rate === null ? null : 110,
  rangeMax: rate === null ? null : 150,
  cleaningFee: null,
  weekendSurchargePercent: null,
  minNights: null,
  rationale: null,
  basedOn: { ...BASIS, similarListings: rate === null ? 0 : 4 },
});

/** The form of the card under test, for a test that changes a field the way the host typing would. */
const formHandle: { current: UseFormReturn<PropertyWizardValues> | null } = { current: null };

function Harness({ values }: { values?: Partial<PropertyWizardValues> }) {
  const form = useForm<PropertyWizardValues>({
    defaultValues: {
      ...NEW_PROPERTY_DEFAULTS,
      maxGuests: 3,
      bedrooms: 1,
      areaSqm: '75',
      amenities: ['WiFi', 'Terrace'],
      nightlyRate: '100',
      ...values,
    },
  });
  useEffect(() => {
    formHandle.current = form;
  }, [form]);
  const [rate, cleaning, weekend, minNights] = useWatch({
    control: form.control,
    name: ['nightlyRate', 'cleaningFee', 'weekendSurcharge', 'minNights'],
  });
  // Reading the dirty fields in the render subscribes to them, as the wizard (which saves on «Continua») does.
  const dirty = Object.keys(form.formState.dirtyFields);
  return (
    <>
      <AiPriceCard form={form} propertyId={PROPERTY_ID} />
      <output data-testid="values">{JSON.stringify({ rate, cleaning, weekend, minNights })}</output>
      <output data-testid="dirty">{JSON.stringify(dirty)}</output>
    </>
  );
}

function renderCard(values?: Partial<PropertyWizardValues>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <Harness values={values} />
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

const values = () => JSON.parse(screen.getByTestId('values').textContent ?? '{}') as Record<string, unknown>;

async function calculate() {
  fireEvent.click(await screen.findByTestId('property-wizard-ai-price-yes'));
  await screen.findByTestId('property-wizard-ai-price-result');
}

describe('AiPriceCard', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    await i18n.changeLanguage('en');
    vi.mocked(priceSuggestionApi.getAvailability).mockResolvedValue({ available: true });
    vi.mocked(priceSuggestionApi.suggest).mockResolvedValue(AI_ANSWER);
  });

  // ─── Offered only where it can work ────────────────────────────────────────────

  it('AiPriceCard_NoAiOnThePlatform_IsNotThere', async () => {
    vi.mocked(priceSuggestionApi.getAvailability).mockResolvedValue({ available: false });

    renderCard();

    await waitFor(() => expect(priceSuggestionApi.getAvailability).toHaveBeenCalledWith(PROPERTY_ID));
    expect(screen.queryByTestId('property-wizard-ai-price')).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-wizard-ai-price-declined')).not.toBeInTheDocument();
  });

  it('AiPriceCard_TheAvailabilityCannotBeRead_IsNotThere', async () => {
    vi.mocked(priceSuggestionApi.getAvailability).mockRejectedValue(new Error('network'));

    renderCard();

    await waitFor(() => expect(priceSuggestionApi.getAvailability).toHaveBeenCalled());
    expect(screen.queryByTestId('property-wizard-ai-price')).not.toBeInTheDocument();
  });

  // ─── It asks first ─────────────────────────────────────────────────────────────

  it('AiPriceCard_AiAvailable_AsksFirstAndCallsNothing', async () => {
    renderCard();

    expect(await screen.findByRole('heading', { name: /Want me to work out the price with AI\?/ })).toBeInTheDocument();
    expect(screen.getByTestId('property-wizard-ai-price-yes')).toBeInTheDocument();
    expect(screen.getByTestId('property-wizard-ai-price-no')).toBeInTheDocument();
    expect(priceSuggestionApi.suggest).not.toHaveBeenCalled();
    expect(values()).toEqual({ rate: '100', cleaning: '', weekend: '', minNights: 1 });
  });

  it('AiPriceCard_TheDefaultPositioningIsInLineWithTheArea_AndTheChosenOneIsSent', async () => {
    renderCard();

    fireEvent.click(await screen.findByTestId('property-wizard-ai-price-yes'));
    await screen.findByTestId('property-wizard-ai-price-result');
    expect(priceSuggestionApi.suggest).toHaveBeenLastCalledWith(PROPERTY_ID, 'Market');

    fireEvent.click(screen.getByTestId('property-wizard-ai-price-again'));
    fireEvent.click(await screen.findByTestId('property-wizard-ai-price-positioning-Higher'));
    fireEvent.click(screen.getByTestId('property-wizard-ai-price-yes'));
    await waitFor(() => expect(priceSuggestionApi.suggest).toHaveBeenLastCalledWith(PROPERTY_ID, 'Higher'));
  });

  it('AiPriceCard_NoIsAnAnswer_TheCardStepsAsideAndCanBeAskedAgain', async () => {
    renderCard();

    fireEvent.click(await screen.findByTestId('property-wizard-ai-price-no'));

    expect(screen.getByTestId('property-wizard-ai-price-declined')).toHaveTextContent('Want some help with the price?');
    expect(priceSuggestionApi.suggest).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Work it out with AI' }));
    expect(await screen.findByTestId('property-wizard-ai-price-yes')).toBeInTheDocument();
  });

  it('AiPriceCard_TheHelpTip_SaysWhatThePriceIsBasedOn', async () => {
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: 'What the AI price is based on' }));

    expect(await screen.findByText(/never the address, never other hosts' data/)).toBeInTheDocument();
  });

  it.each([
    [{ areaSqm: '' }, /enter the square metres first/],
    [{ areaSqm: '75', amenities: [] }, /choose the amenities first/],
  ])('AiPriceCard_ThinData_TellsWhatToAddFirst', async (data, tip) => {
    renderCard(data);

    expect(await screen.findByTestId('property-wizard-ai-price-tip')).toHaveTextContent(tip);
  });

  it('AiPriceCard_CompleteData_HasNoTip', async () => {
    renderCard();

    await screen.findByTestId('property-wizard-ai-price-yes');
    expect(screen.queryByTestId('property-wizard-ai-price-tip')).not.toBeInTheDocument();
  });

  // ─── The answer ────────────────────────────────────────────────────────────────

  it('AiPriceCard_TheAiAnswers_ShowsThePriceTheRangeTheExtrasWhyAndWhatItWasBasedOn', async () => {
    renderCard();

    await calculate();

    expect(screen.getByTestId('property-wizard-ai-price-rate')).toHaveTextContent('€140 a night');
    expect(screen.getByTestId('property-wizard-ai-price-range')).toHaveTextContent('between €120 and €165');
    expect(screen.getByTestId('property-wizard-ai-price-extras')).toHaveTextContent('Also: cleaning €60, weekend +15%, minimum 2 nights.');
    expect(screen.getByTestId('property-wizard-ai-price-why')).toHaveTextContent('Why this price: Zona centrale e terrazza.');
    expect(screen.getByTestId('property-wizard-ai-price-based-on')).toHaveTextContent(
      'Based on: Como · 3 guests · 1 bedroom · 75 m² · 2 amenities · 5 similar homes on CasaZen',
    );
    expect(screen.getByTestId('ai-content-notice')).toHaveTextContent('AI-generated content');
    expect(screen.queryByTestId('property-wizard-ai-price-figures-only')).not.toBeInTheDocument();
  });

  it('AiPriceCard_NothingIsFilledInUntilTheHostSaysYes', async () => {
    renderCard();

    await calculate();

    expect(values()).toEqual({ rate: '100', cleaning: '', weekend: '', minNights: 1 });
  });

  it('AiPriceCard_UseTheseValues_FillsInOnlyWhatWasSuggested', async () => {
    renderCard({ cleaningFee: '40' });
    vi.mocked(priceSuggestionApi.suggest).mockResolvedValue({ ...AI_ANSWER, cleaningFee: null, minNights: null });

    await calculate();
    fireEvent.click(screen.getByTestId('property-wizard-ai-price-apply'));

    expect(values()).toEqual({ rate: '140', cleaning: '40', weekend: '15', minNights: 1 });
    expect(screen.getByTestId('property-wizard-ai-price-applied')).toHaveTextContent('I\'ve filled in the values below');
    expect(JSON.parse(screen.getByTestId('dirty').textContent ?? '[]')).toEqual(expect.arrayContaining(['nightlyRate', 'weekendSurcharge']));
  });

  it('AiPriceCard_Undo_GivesBackWhatWasThere', async () => {
    renderCard({ cleaningFee: '40' });

    await calculate();
    fireEvent.click(screen.getByTestId('property-wizard-ai-price-apply'));
    expect(values()).toEqual({ rate: '140', cleaning: '60', weekend: '15', minNights: 2 });

    fireEvent.click(screen.getByTestId('property-wizard-ai-price-undo'));

    expect(values()).toEqual({ rate: '100', cleaning: '40', weekend: '', minNights: 1 });
    expect(screen.getByTestId('property-wizard-ai-price-apply')).toBeInTheDocument();
  });

  it('AiPriceCard_Undo_LeavesAloneWhatTheHostChangedSince', async () => {
    renderCard();

    await calculate();
    fireEvent.click(screen.getByTestId('property-wizard-ai-price-apply'));
    act(() => formHandle.current?.setValue('nightlyRate', '155', { shouldDirty: true }));
    fireEvent.click(screen.getByTestId('property-wizard-ai-price-undo'));

    expect(values()).toEqual({ rate: '155', cleaning: '', weekend: '', minNights: 1 });
  });

  it('AiPriceCard_KeepMine_StepsAsideWithoutTouchingTheFields', async () => {
    renderCard();

    await calculate();
    fireEvent.click(screen.getByTestId('property-wizard-ai-price-keep'));

    expect(screen.getByTestId('property-wizard-ai-price-declined')).toBeInTheDocument();
    expect(values()).toEqual({ rate: '100', cleaning: '', weekend: '', minNights: 1 });
  });

  // ─── When the AI is not behind the answer ──────────────────────────────────────

  it('AiPriceCard_TheAiDidNotAnswerButThereAreSimilarHomes_ShowsTheirPriceAndSaysSo', async () => {
    vi.mocked(priceSuggestionApi.suggest).mockResolvedValue(NO_AI('ai_unavailable', 130));
    renderCard();

    await calculate();

    expect(screen.getByTestId('property-wizard-ai-price-rate')).toHaveTextContent('€130 a night');
    expect(screen.getByTestId('property-wizard-ai-price-figures-only')).toHaveTextContent(
      "The AI didn't answer, so I worked the price out from the 4 similar homes published in Como.",
    );
    expect(screen.queryByTestId('ai-content-notice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-wizard-ai-price-why')).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-wizard-ai-price-extras')).not.toBeInTheDocument();
    expect(screen.getByTestId('property-wizard-ai-price-based-on')).toHaveTextContent('4 similar homes on CasaZen');
  });

  it.each([
    ['ai_budget_exhausted', /paused until next month/, false],
    ['ai_not_configured', /isn't active right now/, false],
    ['ai_unavailable', /can't reach the AI/, true],
    ['ai_invalid_answer', /couldn't come up with a reliable price/, true],
  ] as const)('AiPriceCard_NoPrice_%s_SaysWhy', async (reason, message, canRetry) => {
    vi.mocked(priceSuggestionApi.suggest).mockResolvedValue(NO_AI(reason, null));
    renderCard();

    fireEvent.click(await screen.findByTestId('property-wizard-ai-price-yes'));
    const none = await screen.findByTestId('property-wizard-ai-price-none');

    expect(none).toHaveTextContent(message);
    expect(none).toHaveAttribute('data-reason', reason);
    expect(screen.queryByRole('button', { name: 'Try again' }) !== null).toBe(canRetry);
    expect(values()).toEqual({ rate: '100', cleaning: '', weekend: '', minNights: 1 });
  });

  it('AiPriceCard_NoPrice_TryAgain_AsksAgain', async () => {
    vi.mocked(priceSuggestionApi.suggest).mockResolvedValueOnce(NO_AI('ai_unavailable', null)).mockResolvedValueOnce(AI_ANSWER);
    renderCard();

    fireEvent.click(await screen.findByTestId('property-wizard-ai-price-yes'));
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByTestId('property-wizard-ai-price-rate')).toHaveTextContent('€140 a night');
    expect(priceSuggestionApi.suggest).toHaveBeenCalledTimes(2);
  });

  it('AiPriceCard_TheRequestFails_ShowsAMessageInTheCard_AndTheHostCanRetry', async () => {
    vi.mocked(priceSuggestionApi.suggest).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(AI_ANSWER);
    renderCard();

    fireEvent.click(await screen.findByTestId('property-wizard-ai-price-yes'));

    expect(await screen.findByTestId('property-wizard-ai-price-error')).toHaveTextContent("I couldn't work out the price. Try again in a moment.");
    expect(values()).toEqual({ rate: '100', cleaning: '', weekend: '', minNights: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('property-wizard-ai-price-rate')).toHaveTextContent('€140 a night');
  });
});
