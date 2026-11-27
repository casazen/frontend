import { useEffect } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import type { SiteProfile } from '@/types';
import { NEW_PROPERTY_DEFAULTS, descriptionsStepSchema, type PropertyWizardValues } from '../property-wizard-model';
import { DescriptionsStep } from '../steps/descriptions-step';

const PROFILE = {
  translations: { en: { title: 'Trullo with pool', description: 'A quiet trullo.' }, fr: { title: 'Trullo avec piscine' } },
  origins: { 'en.title': 'AutoTranslated', 'en.description': 'UserWritten', 'fr.title': 'AutoTranslated' },
} as unknown as SiteProfile;

vi.mock('@/queries/use-property-photos', () => ({ usePropertyPhotos: () => ({ data: { photoUrls: [] } }) }));
vi.mock('@/queries/use-site-profile', () => ({ useSiteProfile: () => ({ data: PROFILE }) }));
vi.mock('@/queries/use-amenity-catalog', () => ({ useAmenityLabels: () => (name: string) => name }));

const FILLED: PropertyWizardValues = {
  ...NEW_PROPERTY_DEFAULTS,
  listingTitle: 'Trullo con piscina',
  description: 'Un trullo tranquillo.',
  texts: {
    ...NEW_PROPERTY_DEFAULTS.texts,
    en: { title: 'Trullo with pool', description: 'A quiet trullo.' },
    fr: { title: 'Trullo avec piscine', description: '' },
  },
};

let form: UseFormReturn<PropertyWizardValues> | null = null;
const check = () => form!.trigger();

function Harness({ values = FILLED }: { values?: PropertyWizardValues }) {
  const own = useForm<PropertyWizardValues>({ defaultValues: values, resolver: zodResolver(descriptionsStepSchema) as never });
  // The test asks the form to validate, as «Continua» does.
  useEffect(() => {
    form = own;
  }, [own]);
  return <DescriptionsStep form={own} propertyId="p1" />;
}

const tab = (language: 'it' | 'en') => screen.getByTestId(`property-wizard-descriptions-tab-${language}`);

describe('DescriptionsStep (NF-31)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('tabs_ItalianAndEnglish_ItalianIsOpenAndHasTheCardWithTheAiSuggestion', () => {
    render(<Harness />);

    expect(tab('it')).toHaveAttribute('aria-selected', 'true');
    expect(tab('en')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('textbox', { name: /^Titolo$/ })).toHaveValue('Trullo con piscina');
    expect(screen.getByTestId('property-wizard-suggest')).toBeInTheDocument();
    // The English fields are in the other tab: not on screen until it is opened.
    expect(screen.queryByRole('textbox', { name: /Titolo \(Inglese\)/ })).not.toBeInTheDocument();

    fireEvent.click(tab('en'));

    expect(tab('en')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('textbox', { name: /Titolo \(Inglese\)/ })).toHaveValue('Trullo with pool');
    expect(screen.getByRole('textbox', { name: /Descrizione \(Inglese\)/ })).toHaveValue('A quiet trullo.');
  });

  it('others_TwelveLanguagesInAnAccordion_OptionalAndSaidIfTheyHaveATextOrNot', () => {
    render(<Harness />);

    const others = screen.getByTestId('property-wizard-descriptions-others');
    expect(within(others).getAllByTestId(/^property-wizard-descriptions-language-/)).toHaveLength(12);
    expect(within(screen.getByTestId('property-wizard-descriptions-language-fr')).getByText('Compilata')).toBeInTheDocument();
    expect(within(screen.getByTestId('property-wizard-descriptions-language-de')).getByText('Vuota')).toBeInTheDocument();
    expect(within(others).queryByTestId('property-wizard-descriptions-language-en')).not.toBeInTheDocument();
  });

  it('origin_EachTextSaysWhoWroteIt_AndATranslationTheHostEditsReadsModifiedAtOnce', () => {
    render(<Harness />);
    fireEvent.click(tab('en'));

    expect(screen.getByTestId('property-wizard-origin-en-title')).toHaveTextContent('Tradotto automaticamente');
    expect(screen.getByTestId('property-wizard-origin-en-description')).toHaveTextContent('Scritto da te');

    fireEvent.change(screen.getByRole('textbox', { name: /Titolo \(Inglese\)/ }), { target: { value: 'Trullo with a private pool' } });

    expect(screen.getByTestId('property-wizard-origin-en-title')).toHaveTextContent('Modificato dopo la traduzione');
    expect(screen.getByTestId('property-wizard-origin-en-title')).toHaveAttribute('data-origin', 'ModifiedAfterTranslation');
  });

  it('origin_ItalianIsAlwaysTheHosts', () => {
    render(<Harness />);

    expect(screen.getByTestId('property-wizard-origin-it')).toHaveTextContent('Scritto da te');
  });

  it('required_EnglishMissing_TheEnglishTabOpensByItselfAndNamesWhatIsMissing', async () => {
    render(<Harness values={{ ...FILLED, texts: { ...FILLED.texts, en: { title: '', description: '' } } }} />);
    expect(tab('it')).toHaveAttribute('aria-selected', 'true');

    let valid = true;
    await act(async () => {
      valid = await check();
    });

    expect(valid).toBe(false);
    expect(tab('en')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Scrivi il titolo in inglese.')).toBeInTheDocument();
    expect(screen.getByText('Scrivi la descrizione in inglese.')).toBeInTheDocument();
  });

  it('required_ItalianMissing_TheItalianTabKeepsTheFocusOfTheProblem', async () => {
    render(<Harness values={{ ...FILLED, listingTitle: '', texts: { ...FILLED.texts, en: { title: '', description: '' } } }} />);
    fireEvent.click(tab('en'));

    await act(async () => {
      await check();
    });

    // Both tabs have a problem: the first one, Italian, is the one that opens.
    expect(tab('it')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Scrivi il titolo in italiano.')).toBeInTheDocument();
  });
});
