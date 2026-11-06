import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import type { ListingTextSuggestion } from '@/api/listing-text.api';
import { NEW_PROPERTY_DEFAULTS, type PropertyWizardValues } from '../property-wizard-model';
import { describeBasis } from '../listing-text-basis';
import { ListingTextCard } from '../steps/listing-text-card';

const { suggestApi, reducePhotos } = vi.hoisted(() => ({ suggestApi: vi.fn(), reducePhotos: vi.fn() }));

vi.mock('@/api/listing-text.api', () => ({ listingTextApi: { suggest: suggestApi } }));
vi.mock('../photos/reduce-photo', () => ({ reducePhotosForAi: reducePhotos }));
// The card names the amenities in the fallback text with the labels of the catalog: here the name itself, the catalog is not under test.
vi.mock('@/queries/use-amenity-catalog', () => ({ useAmenityLabels: () => (name: string) => name }));

const basis = { photos: 2, comune: 'Como', province: 'CO', region: 'Lombardia', similarListings: 3, amenities: 0 };

const aiText = (title: string, description: string): ListingTextSuggestion => ({
  aiUsed: true,
  reason: null,
  title,
  description,
  basedOn: basis,
});

function Harness({ photos }: { photos: string[] }) {
  const form = useForm<PropertyWizardValues>({
    defaultValues: { ...NEW_PROPERTY_DEFAULTS, name: 'Casa Como', city: 'Como', description: 'Il mio testo' },
  });
  return <ListingTextCard form={form} propertyId="p1" photos={photos} />;
}

const description = () => screen.getByRole('textbox', { name: /Descrizione/ }) as HTMLTextAreaElement;
const headline = () => screen.getByRole('textbox', { name: /Titolo/ }) as HTMLInputElement;
const status = () => screen.getByTestId('property-wizard-suggest-status');

function tooManyRequests() {
  return new AxiosError('Too many requests', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 429,
    statusText: 'Too Many Requests',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

describe('ListingTextCard', () => {
  beforeEach(() => {
    suggestApi.mockReset();
    reducePhotos.mockReset();
    reducePhotos.mockResolvedValue(['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB']);
  });

  it('suggest_TheAiAnswers_FillsTheFieldsAndSaysWhatItWasBasedOn', async () => {
    suggestApi.mockResolvedValue(aiText('Bilocale luminoso a Como', 'Primo paragrafo.\n\nSecondo paragrafo.'));
    render(<Harness photos={['https://cdn/a.jpg', 'https://cdn/b.jpg']} />);

    fireEvent.click(screen.getByTestId('property-wizard-suggest'));

    await waitFor(() => expect(headline().value).toBe('Bilocale luminoso a Como'));
    expect(description().value).toBe('Primo paragrafo.\n\nSecondo paragrafo.');
    expect(reducePhotos).toHaveBeenCalledWith(['https://cdn/a.jpg', 'https://cdn/b.jpg']);
    expect(suggestApi).toHaveBeenCalledWith('p1', { photos: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'], regenerate: false });
    expect(status()).toHaveTextContent(
      "Testo scritto dall'AI in base a 2 foto, il comune di Como (CO), 3 annunci simili della zona e i dati dell'immobile",
    );
    expect(screen.getByTestId('property-wizard-suggest')).toHaveTextContent('Rigenera');
  });

  it('regenerate_AsksForANewTextAndUndoBringsBackTheTextOfBefore', async () => {
    suggestApi
      .mockResolvedValueOnce(aiText('Primo titolo', 'Primo testo.'))
      .mockResolvedValueOnce(aiText('Secondo titolo', 'Secondo testo.'));
    render(<Harness photos={['https://cdn/a.jpg']} />);

    fireEvent.click(screen.getByTestId('property-wizard-suggest'));
    await waitFor(() => expect(headline().value).toBe('Primo titolo'));
    fireEvent.click(screen.getByTestId('property-wizard-suggest'));
    await waitFor(() => expect(headline().value).toBe('Secondo titolo'));

    expect(suggestApi.mock.calls[1]![1]).toMatchObject({ regenerate: true });
    fireEvent.click(screen.getByTestId('property-wizard-suggest-undo'));
    expect(description().value).toBe('Il mio testo');
    expect(headline().value).toBe('');
  });

  it('suggest_NoAiConfigured_ComposesTheTextFromTheData', async () => {
    suggestApi.mockResolvedValue({ aiUsed: false, reason: 'ai_not_configured', title: null, description: null, basedOn: basis });
    render(<Harness photos={[]} />);

    fireEvent.click(screen.getByTestId('property-wizard-suggest'));

    await waitFor(() => expect(status()).toHaveTextContent('Testo composto con i dati che hai inserito'));
    expect(headline().value).toContain('Como');
    expect(description().value).toContain('Como');
  });

  it('suggest_TheCallFails_ComposesTheTextAndSaysTheAiIsNotAvailable', async () => {
    suggestApi.mockRejectedValue(new Error('network down'));
    render(<Harness photos={['https://cdn/a.jpg']} />);

    fireEvent.click(screen.getByTestId('property-wizard-suggest'));

    await waitFor(() => expect(status()).toHaveTextContent("L'AI ora non è disponibile"));
    expect(description().value).toContain('Como');
  });

  it('suggest_TooManyRequests_KeepsTheTextAndSaysToWait', async () => {
    suggestApi.mockRejectedValue(tooManyRequests());
    render(<Harness photos={['https://cdn/a.jpg']} />);

    fireEvent.click(screen.getByTestId('property-wizard-suggest'));

    await waitFor(() => expect(status()).toHaveTextContent('Hai chiesto molti testi in poco tempo'));
    expect(description().value).toBe('Il mio testo');
    expect(screen.queryByTestId('property-wizard-suggest-undo')).not.toBeInTheDocument();
  });

  it('suggest_PhotosSentButNotRead_SaysTheTextIsBasedOnTheData', async () => {
    suggestApi.mockResolvedValue({ ...aiText('Titolo', 'Testo.'), basedOn: { ...basis, photos: 0 } });
    render(<Harness photos={['https://cdn/a.jpg']} />);

    fireEvent.click(screen.getByTestId('property-wizard-suggest'));

    await waitFor(() => expect(status()).toHaveTextContent('non legge le foto'));
  });

  it('tips_NoPhotosOrFewOfThem_SayWhatMakesTheTextBetter', () => {
    const { rerender } = render(<Harness photos={[]} />);
    expect(screen.getByTestId('property-wizard-suggest-tip')).toHaveTextContent('Carica prima le foto');

    rerender(<Harness photos={['https://cdn/a.jpg']} />);
    expect(screen.getByTestId('property-wizard-suggest-tip')).toHaveTextContent('Con almeno 3 foto');

    rerender(<Harness photos={['https://cdn/a.jpg', 'https://cdn/b.jpg', 'https://cdn/c.jpg']} />);
    expect(screen.queryByTestId('property-wizard-suggest-tip')).not.toBeInTheDocument();
  });

  it('describeBasis_OnlyWhatThereIs_JoinsItInWords', () => {
    const t = i18n.getFixedT('it');

    expect(describeBasis({ ...basis, photos: 1, similarListings: 0 }, t)).toBe("1 foto, il comune di Como (CO) e i dati dell'immobile");
    expect(describeBasis({ ...basis, photos: 0, comune: null, similarListings: 1 }, t)).toBe(
      "1 annuncio simile della zona e i dati dell'immobile",
    );
  });
});
