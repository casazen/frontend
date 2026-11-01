import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import type { ShowcaseTextSuggestion } from '@/types/supplier-showcase';
import { problem, renderRouted } from '../../services/__tests__/service-test-kit';
import { AiTextsBlock } from '../panels/ai-texts-block';

const api = vi.hoisted(() => ({ suggestTexts: vi.fn() }));
vi.mock('@/api/supplier-showcase.api', () => ({ supplierShowcaseApi: api }));

const sonner = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock('sonner', () => sonner);

const suggestion: ShowcaseTextSuggestion = {
  tagline: 'Pulizie e giardinaggio per case vacanza',
  intro: 'Pulizie e cura del giardino a Seveso.',
  bio: 'Ci occupiamo di pulizie e di giardinaggio a Seveso, a Cesano Maderno e a Desio.',
  prep: ['Lascia le chiavi alla portineria.'],
  basis: { categories: ['cleaning', 'gardening'], zones: ['Seveso', 'Cesano Maderno', 'Desio', 'Meda'], services: ['Pulizia di fine soggiorno', 'Taglio del prato'], answers: ['about', 'years'] },
  rejected: [],
  aiUsed: true,
};

function renderBlock(props: Partial<Parameters<typeof AiTextsBlock>[0]> = {}) {
  const change = vi.fn();
  const onApplied = vi.fn();
  const onTakenBack = vi.fn();
  renderRouted({
    at: '/x',
    routes: [{ path: '/x', element: <AiTextsBlock doc={{}} change={change} onApplied={onApplied} onTakenBack={onTakenBack} {...props} /> }],
  });
  return { change, onApplied, onTakenBack };
}

describe('The AI help of the texts of the showcase', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    api.suggestTexts.mockReset();
    await i18n.changeLanguage('it');
  });
  afterEach(cleanup);

  it('says what it does and what it will not write, in tips next to the title and the answers', async () => {
    renderBlock();

    expect(await screen.findByRole('heading', { name: /Scrivi con l'AI/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Su cosa si basa/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Come avere una bozza migliore/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Due righe su di te/)).toBeInTheDocument();
    // The other questions wait behind a button: the first look is one box and one button.
    expect(screen.queryByLabelText(/Da quanto lavori/)).not.toBeInTheDocument();
  });

  it('sends what the supplier typed in the four answers, and nothing it left empty', async () => {
    api.suggestTexts.mockResolvedValue(suggestion);
    renderBlock();

    fireEvent.change(await screen.findByLabelText(/Due righe su di te/), { target: { value: 'Una piccola squadra.' } });
    fireEvent.click(screen.getByTestId('supplier-showcase-ai-more'));
    fireEvent.change(screen.getByLabelText(/Da quanto lavori/), { target: { value: 'dal 2015' } });
    fireEvent.change(screen.getByLabelText(/In cosa sei specializzato/), { target: { value: 'case al lago' } });
    fireEvent.click(screen.getByTestId('supplier-showcase-ai-write'));

    await waitFor(() =>
      expect(api.suggestTexts).toHaveBeenCalledWith({ answers: { about: 'Una piccola squadra.', years: 'dal 2015', specialties: 'case al lago' }, regenerate: false }),
    );
  });

  it('sends no answers at all when the supplier typed none', async () => {
    api.suggestTexts.mockResolvedValue(suggestion);
    renderBlock();

    fireEvent.click(await screen.findByTestId('supplier-showcase-ai-write'));

    await waitFor(() => expect(api.suggestTexts).toHaveBeenCalledWith({ answers: undefined, regenerate: false }));
  });

  it('shows the draft with a box for each member, ticked where nothing is written, and says what it was based on', async () => {
    api.suggestTexts.mockResolvedValue(suggestion);
    renderBlock({ doc: { intro: 'La mia introduzione' } });

    fireEvent.click(await screen.findByTestId('supplier-showcase-ai-write'));
    const result = await screen.findByTestId('supplier-showcase-ai-result');

    for (const field of ['tagline', 'bio', 'prep']) {
      expect(within(screen.getByTestId(`supplier-showcase-ai-field-${field}`)).getByRole('checkbox')).toBeChecked();
    }
    const intro = screen.getByTestId('supplier-showcase-ai-field-intro');
    expect(within(intro).getByRole('checkbox')).not.toBeChecked();
    expect(within(intro).getByText('Sostituisce il testo che hai già scritto.')).toBeInTheDocument();
    // Only what was really used: the categories, three zones and «altre 1», the number of services, and that the answers were used.
    expect(within(result).getByTestId('supplier-showcase-ai-basis')).toHaveTextContent(
      'Basato su: Pulizie, Giardinaggio · Seveso, Cesano Maderno, Desio e altre 1 · 2 servizi · le tue righe',
    );
  });

  it('puts only the ticked members in the draft, marks them, and takes them back with Annulla', async () => {
    api.suggestTexts.mockResolvedValue(suggestion);
    const { change, onApplied, onTakenBack } = renderBlock({ doc: { intro: 'La mia introduzione' } });

    fireEvent.click(await screen.findByTestId('supplier-showcase-ai-write'));
    await screen.findByTestId('supplier-showcase-ai-result');
    fireEvent.click(within(screen.getByTestId('supplier-showcase-ai-field-bio')).getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('supplier-showcase-ai-use'));

    expect(change).toHaveBeenCalledWith({ tagline: suggestion.tagline, prep: suggestion.prep });
    expect(onApplied).toHaveBeenCalledWith({ tagline: suggestion.tagline, prep: suggestion.prep });
    expect(screen.queryByTestId('supplier-showcase-ai-result')).not.toBeInTheDocument();

    const [message, options] = sonner.toast.success.mock.calls.at(-1) as [string, { action: { label: string; onClick: () => void } }];
    expect(message).toBe('Bozza inserita');
    expect(options.action.label).toBe('Annulla');
    // The undo runs after the click (the toast waits one tick before it calls it): what was there comes back, and the mark goes with it.
    options.action.onClick();
    await waitFor(() => expect(change).toHaveBeenLastCalledWith({ tagline: null, prep: null }));
    expect(onTakenBack).toHaveBeenCalledWith(['tagline', 'prep']);
  });

  it('writes nothing in the draft until the supplier takes the draft, and lets it close without taking', async () => {
    api.suggestTexts.mockResolvedValue(suggestion);
    const { change } = renderBlock();

    fireEvent.click(await screen.findByTestId('supplier-showcase-ai-write'));
    await screen.findByTestId('supplier-showcase-ai-result');
    expect(change).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }));
    expect(screen.queryByTestId('supplier-showcase-ai-result')).not.toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });

  it('asks for a new draft with «regenerate» and keeps the answers', async () => {
    api.suggestTexts.mockResolvedValue(suggestion);
    renderBlock();

    fireEvent.change(await screen.findByLabelText(/Due righe su di te/), { target: { value: 'Una piccola squadra.' } });
    fireEvent.click(screen.getByTestId('supplier-showcase-ai-write'));
    await screen.findByTestId('supplier-showcase-ai-result');
    fireEvent.click(screen.getByTestId('supplier-showcase-ai-again'));

    await waitFor(() => expect(api.suggestTexts).toHaveBeenCalledTimes(2));
    expect(api.suggestTexts).toHaveBeenLastCalledWith({ answers: { about: 'Una piccola squadra.' }, regenerate: true });
  });

  it('says which members the server dropped, so the supplier asks again or writes them', async () => {
    api.suggestTexts.mockResolvedValue({ ...suggestion, bio: undefined, rejected: ['bio'] });
    renderBlock();

    fireEvent.click(await screen.findByTestId('supplier-showcase-ai-write'));

    expect(await screen.findByTestId('supplier-showcase-ai-dropped')).toHaveTextContent('Non sono riuscito a scrivere: Chi siamo. Riprova o scrivilo tu.');
    expect(screen.queryByTestId('supplier-showcase-ai-field-bio')).not.toBeInTheDocument();
  });

  it('shows the message of the server when it cannot write, and keeps what the supplier typed', async () => {
    api.suggestTexts.mockRejectedValue(
      problem(422, { code: 'showcase_suggestion_not_enough_data', detail: 'Per scrivere un testo che sia vero servono almeno una categoria, una zona o un servizio.' }),
    );
    renderBlock();

    fireEvent.change(await screen.findByLabelText(/Due righe su di te/), { target: { value: 'Una piccola squadra.' } });
    fireEvent.click(screen.getByTestId('supplier-showcase-ai-write'));

    expect(await screen.findByTestId('supplier-showcase-ai-error')).toHaveTextContent('Per scrivere un testo che sia vero servono almeno una categoria, una zona o un servizio.');
    expect(screen.getByLabelText(/Due righe su di te/)).toHaveValue('Una piccola squadra.');
  });

  it('says it in words of its own when the server sends nothing readable', async () => {
    api.suggestTexts.mockRejectedValue(problem(500, {}));
    renderBlock();

    fireEvent.click(await screen.findByTestId('supplier-showcase-ai-write'));

    expect(await screen.findByTestId('supplier-showcase-ai-error')).toHaveTextContent('Non sono riuscito a scrivere la bozza. Riprova tra poco.');
  });

  it('offers the static starter as a way out when there is one', async () => {
    const onUseStarter = vi.fn();
    renderBlock({ onUseStarter });

    fireEvent.click(await screen.findByTestId('supplier-showcase-ai-starter'));

    expect(onUseStarter).toHaveBeenCalledTimes(1);
  });

  it('has no way out to the starter when there is none to offer', async () => {
    renderBlock();

    await screen.findByTestId('supplier-showcase-ai-write');
    expect(screen.queryByTestId('supplier-showcase-ai-starter')).not.toBeInTheDocument();
  });
});
