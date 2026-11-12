import { fireEvent, render, screen } from '@testing-library/react';
import { useForm, useWatch } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import type { AmenityCatalog } from '@/types';
import { NEW_PROPERTY_DEFAULTS, type PropertyWizardValues } from '../property-wizard-model';
import { AmenitiesStep } from '../steps/amenities-step';

const CATALOG: AmenityCatalog = {
  groups: [
    { id: 'comfort', label: { it: 'Comfort', en: 'Comfort' } },
    { id: 'kitchen', label: { it: 'Cucina', en: 'Kitchen' } },
    { id: 'outdoor', label: { it: 'Esterni e posizione', en: 'Outdoors and location' } },
  ],
  amenities: [
    { name: 'WiFi', icon: 'wifi', group: 'comfort', label: { it: 'Wi-Fi', en: 'Wi-Fi' } },
    { name: 'Washer', icon: 'shirt', group: 'comfort', label: { it: 'Lavatrice', en: 'Washing machine' } },
    { name: 'Dishwasher', icon: 'sparkles', group: 'kitchen', label: { it: 'Lavastoviglie', en: 'Dishwasher' } },
    { name: 'Pool', icon: 'waves', group: 'outdoor', label: { it: 'Piscina', en: 'Pool' } },
    // Decided by the house rules, not asked in this step.
    { name: 'PetFriendly', icon: 'paw', group: 'outdoor', label: { it: 'Animali ammessi', en: 'Pets allowed' } },
  ],
};

const catalog = vi.hoisted(() => ({
  state: { data: undefined as unknown, isLoading: false, isError: false, error: null as unknown, refetch: vi.fn() },
}));

vi.mock('@/queries/use-amenity-catalog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-amenity-catalog')>()),
  useAmenityCatalog: () => catalog.state,
}));
vi.mock('../steps/safety-card', () => ({ SafetyCard: () => null }));

function Harness({ amenities = [] as string[] }) {
  const form = useForm<PropertyWizardValues>({ defaultValues: { ...NEW_PROPERTY_DEFAULTS, amenities } });
  return (
    <>
      <AmenitiesStep form={form} propertyId="p1" />
      <output data-testid="chosen">{JSON.stringify(useWatch({ control: form.control, name: 'amenities' }))}</output>
    </>
  );
}

const search = () => screen.getByTestId('property-wizard-amenity-search') as HTMLInputElement;
const chosen = () => JSON.parse(screen.getByTestId('chosen').textContent ?? '[]') as string[];

describe('AmenitiesStep (NF-33)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    catalog.state = { data: CATALOG, isLoading: false, isError: false, error: null, refetch: vi.fn() };
  });

  it('catalog_GroupsAndLabels_AreTheOnesOfTheCatalog_WithoutTheAmenitiesTheRulesDecide', () => {
    render(<Harness />);

    expect(screen.getByRole('group', { name: 'Comfort' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Cucina' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Esterni e posizione' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Lavatrice' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Animali ammessi' })).not.toBeInTheDocument();
  });

  it('catalog_InEnglish_TheLabelsAreTheEnglishOnes', async () => {
    await i18n.changeLanguage('en');
    render(<Harness />);

    expect(screen.getByRole('checkbox', { name: 'Washing machine' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Kitchen' })).toBeInTheDocument();
  });

  it('search_Lavatrice_FindsTheWashingMachine_AndTheGroupsWithoutAMatchGoAway', () => {
    render(<Harness />);

    fireEvent.change(search(), { target: { value: 'lavatrice' } });

    expect(screen.getByRole('checkbox', { name: 'Lavatrice' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Piscina' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Cucina' })).not.toBeInTheDocument();
    expect(screen.getByTestId('property-wizard-amenities-found')).toHaveTextContent('1 dotazione trovata');
  });

  it('search_AnEnglishWordOnAnItalianPage_FindsTheSameThing', () => {
    render(<Harness />);

    fireEvent.change(search(), { target: { value: 'washing' } });

    expect(screen.getByRole('checkbox', { name: 'Lavatrice' })).toBeInTheDocument();
  });

  it('search_NothingFound_SaysSoAndKeepsTheWordInTheMessage', () => {
    render(<Harness />);

    fireEvent.change(search(), { target: { value: 'ascensore' } });

    expect(screen.getByTestId('property-wizard-amenities-found')).toHaveTextContent('Nessuna dotazione per «ascensore»');
  });

  it('search_ChoosingWhileFiltered_NeverTakesAwayWhatIsHidden', () => {
    render(<Harness amenities={['Pool']} />);

    fireEvent.change(search(), { target: { value: 'lavatrice' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Lavatrice' }));

    // «Piscina» is not on screen any more, and still chosen.
    expect(chosen()).toEqual(['Pool', 'Washer']);

    fireEvent.change(search(), { target: { value: '' } });
    expect(screen.getByRole('checkbox', { name: 'Piscina' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Lavatrice' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Piscina' }));
    expect(chosen()).toEqual(['Washer']);
  });

  it('search_PressingEnter_DoesNotSubmitTheWizard', () => {
    render(<Harness />);

    // The default of the event is prevented: the form around the step would otherwise go on to the next step.
    expect(fireEvent.keyDown(search(), { key: 'Enter' })).toBe(false);
  });

  it('catalog_Loading_ShowsAPlaceholderAndNoCards', () => {
    catalog.state = { data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() };
    render(<Harness />);

    expect(screen.getByRole('status', { name: 'Carico le dotazioni…' })).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('catalog_CannotBeRead_SaysSoAndOffersToTryAgain', () => {
    const refetch = vi.fn();
    catalog.state = { data: undefined, isLoading: false, isError: true, error: new Error('down'), refetch };
    render(<Harness />);

    expect(screen.getByTestId('property-wizard-amenities-error')).toHaveTextContent("Non riesco a leggere l'elenco delle dotazioni");
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(refetch).toHaveBeenCalled();
  });
});
