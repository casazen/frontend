import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n/config';
import { NEW_PROPERTY_DEFAULTS, type PropertyWizardValues } from '../property-wizard-model';
import { ListingTextCard } from '../steps/listing-text-card';

const { suggestApi, reducePhotos } = vi.hoisted(() => ({ suggestApi: vi.fn(), reducePhotos: vi.fn() }));
vi.mock('@/api/listing-text.api', () => ({ listingTextApi: { suggestFields: suggestApi } }));
vi.mock('../photos/reduce-photo', () => ({ reducePhotosForAi: reducePhotos }));
const fields = { title: 'Bilocale a Como', description: 'Un appartamento luminoso.', spaces: 'Due camere', access: '', neighborhood: 'Como', transport: '', rules: 'Non fumare' };
const answer = { aiUsed: true, fields };
function Harness({ photos = [] }: { photos?: string[] }) {
  const form = useForm<PropertyWizardValues>({ defaultValues: { ...NEW_PROPERTY_DEFAULTS, description: 'Il mio testo', texts: { en: { title: 'My title', description: 'My text', transport: 'My bus' } } } });
  return <><ListingTextCard form={form} propertyId="p1" photos={photos} /><output data-testid="drafts">{JSON.stringify(form.watch('texts'))}</output><output data-testid="rules">{form.watch('houseRules')}</output></>;
}
const start = () => { fireEvent.click(screen.getByTestId('property-wizard-suggest')); fireEvent.click(screen.getByTestId('listing-ai-generate')); };
beforeEach(() => { suggestApi.mockReset(); reducePhotos.mockResolvedValue([]); });
describe('multilingual listing suggestions', () => {
  it('asks for languages first, previews all fields, and changes drafts only after apply', async () => {
    suggestApi.mockResolvedValue(answer);
    render(<Harness />);
    fireEvent.click(screen.getByTestId('property-wizard-suggest'));
    expect(screen.getAllByRole('checkbox')).toHaveLength(14);
    expect(screen.getByRole('checkbox', { name: 'Italiano', exact: true })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Inglese', exact: true })).toBeChecked();
    expect(suggestApi).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('listing-ai-generate'));
    await waitFor(() => expect(screen.getByTestId('listing-ai-apply')).toBeEnabled());
    expect(screen.getByDisplayValue('Il mio testo')).toHaveValue('Il mio testo');
    expect(suggestApi.mock.calls.map((call) => call[1].language)).toEqual(['it', 'en']);
    fireEvent.click(screen.getByTestId('listing-ai-apply'));
    expect(screen.getByRole('textbox', { name: /Descrizione/ })).toHaveValue(fields.description);
    expect(screen.getByTestId('drafts')).toHaveTextContent('Due camere');
    expect(screen.getByTestId('drafts')).toHaveTextContent('My bus');
    expect(screen.getByTestId('rules')).toHaveTextContent('Non fumare');
    fireEvent.click(screen.getByTestId('property-wizard-suggest-undo'));
    expect(screen.getByRole('textbox', { name: /Descrizione/ })).toHaveValue('Il mio testo');
    expect(screen.getByTestId('drafts')).toHaveTextContent('My title');
  });
  it('allows all fourteen languages and keeps unsupported facts empty', async () => {
    suggestApi.mockResolvedValue(answer);
    render(<Harness />);
    fireEvent.click(screen.getByTestId('property-wizard-suggest'));
    fireEvent.click(screen.getByRole('button', { name: 'Tutte le lingue' }));
    fireEvent.click(screen.getByTestId('listing-ai-generate'));
    await waitFor(() => expect(suggestApi).toHaveBeenCalledTimes(14));
    await waitFor(() => expect(screen.getByTestId('listing-ai-apply')).toBeEnabled());
    expect(screen.getAllByText('Da completare: informazioni non disponibili').length).toBeGreaterThan(0);
  });
  it('preserves drafts on partial failure and retries only the failed language', async () => {
    suggestApi.mockResolvedValueOnce(answer).mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(answer);
    render(<Harness />); start();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Riprova le lingue mancanti' })).toBeEnabled());
    expect(screen.getByDisplayValue('Il mio testo')).toHaveValue('Il mio testo');
    fireEvent.click(screen.getByRole('button', { name: 'Riprova le lingue mancanti' }));
    await waitFor(() => expect(suggestApi).toHaveBeenCalledTimes(3));
    expect(suggestApi.mock.calls[2][1]).toMatchObject({ language: 'en', regenerate: true });
  });
  it('canceling preview leaves the user text unchanged', async () => {
    suggestApi.mockResolvedValue(answer); render(<Harness />); start();
    await waitFor(() => expect(screen.getByTestId('listing-ai-apply')).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Annulla', exact: true }));
    expect(screen.getByRole('textbox', { name: /Descrizione/ })).toHaveValue('Il mio testo');
  });
  it('stops queued requests when canceled while a language is being generated', async () => {
    let resolve!: (value: typeof answer) => void;
    suggestApi.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(<Harness />); start();
    await waitFor(() => expect(suggestApi).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Annulla', exact: true }));
    expect(suggestApi.mock.calls[0][2].aborted).toBe(true);
    resolve(answer);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(suggestApi).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox', { name: /Descrizione/ })).toHaveValue('Il mio testo');
  });
  it('stops further requests when the platform budget is exhausted', async () => {
    suggestApi.mockResolvedValue({ aiUsed: false, reason: 'ai_budget_exhausted' });
    render(<Harness />); start();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Riprova le lingue mancanti' })).toBeEnabled());
    expect(suggestApi).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('listing-ai-apply')).toBeDisabled();
  });

});
