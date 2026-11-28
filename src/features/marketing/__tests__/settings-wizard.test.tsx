import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '@/api/client';
import i18n from '@/i18n/config';
import { SettingsWizard } from '../settings-wizard';

vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

const initial = {
  voice: '',
  propertyNotes: {},
  propertyUrls: {},
  monthlyEmailLimit: 2,
  loyalStays: 3,
  lostMonths: 24,
  newsletter: { segmentId: null, propertyId: null, cadenceDays: 30, instructions: '', enabled: false },
};

const loyalGroup = {
  id: 'group-1',
  name: 'Ospiti fedeli',
  createdAt: '2026-11-27T10:00:00Z',
  condition: { version: '1.0', groups: [{ operator: 'AND', rules: [{ fieldId: 'stage', operator: 'in', value: ['loyal'] }] }] },
};

let current: Record<string, unknown>;
let segments: Array<Record<string, unknown>>;

function view(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  vi.resetAllMocks();
  current = initial;
  segments = [loyalGroup];
  await i18n.changeLanguage('it');
  vi.mocked(ApiClient.get).mockImplementation(async (path: string) => {
    if (path === '/campaigns/studio/settings') return current;
    if (path === '/properties') return [{ id: 'house', name: 'Villa Sofia', photoUrls: [] }];
    if (path === '/campaigns/segments') return segments;
    if (path.endsWith('/preview')) return { count: 12 };
    throw new Error(path);
  });
  vi.mocked(ApiClient.post).mockImplementation(async (path: string) => {
    if (path === '/campaigns/studio/suggest-voice') return { voice: 'Tono caldo e diretto, do del tu.' };
    if (path === '/campaigns/segments/preview') return { count: 12 };
    throw new Error(path);
  });
  vi.mocked(ApiClient.put).mockResolvedValue(undefined);
});

const next = () => screen.getByTestId('settings-wizard-next');

async function goOn() {
  await waitFor(() => expect(next()).toBeEnabled());
  fireEvent.click(next());
}

const voiceText = () => (screen.getByTestId('voice-text') as HTMLTextAreaElement).value;

describe('settings wizard', () => {
  it('offers ready-made styles, lets the AI propose one from a text, and gives back the previous words', async () => {
    view(<SettingsWizard open onOpenChange={() => undefined} />);

    fireEvent.click(await screen.findByTestId('voice-style-warm'));
    expect(voiceText()).toContain('Tono caldo e familiare');
    expect(screen.getByTestId('voice-style-warm')).toBeChecked();
    const warm = voiceText();

    expect(screen.getByTestId('voice-propose')).toBeDisabled();
    fireEvent.change(screen.getByTestId('voice-examples'), { target: { value: 'Ciao! Vi aspettiamo con il camino acceso.' } });
    fireEvent.click(screen.getByTestId('voice-propose'));

    expect(await screen.findByText(/Questo stile l'ha proposto l'AI/)).toBeVisible();
    expect(voiceText()).toBe('Tono caldo e diretto, do del tu.');
    expect(ApiClient.post).toHaveBeenCalledWith('/campaigns/studio/suggest-voice', { examples: 'Ciao! Vi aspettiamo con il camino acceso.', website: undefined }, expect.anything());

    fireEvent.click(screen.getByTestId('voice-undo'));
    expect(voiceText()).toBe(warm);
    expect(screen.queryByText(/Questo stile l'ha proposto l'AI/)).toBeNull();
  });

  it('refuses a website that is not https before asking the AI, and says when the AI is not active', async () => {
    vi.mocked(ApiClient.post).mockRejectedValue(Object.assign(new AxiosError('Unavailable'), { response: { status: 503, data: { code: 'marketing_ai_unavailable' } } }));
    view(<SettingsWizard open onOpenChange={() => undefined} />);

    fireEvent.change(await screen.findByTestId('voice-website'), { target: { value: 'http://www.villasofia.it' } });
    expect(screen.getByText('Il link deve iniziare con https://')).toBeVisible();
    expect(screen.getByTestId('voice-propose')).toBeDisabled();

    fireEvent.change(screen.getByTestId('voice-website'), { target: { value: 'https://www.villasofia.it' } });
    expect(screen.getByTestId('voice-propose')).toBeEnabled();
    fireEvent.click(screen.getByTestId('voice-propose'));
    expect(await screen.findByText("L'assistente AI non è ancora attivo per il tuo account: puoi scrivere tu il testo.")).toBeVisible();
  });

  it('takes the host through the five steps and saves exactly what was chosen', async () => {
    const onWriteCampaign = vi.fn();
    view(<SettingsWizard open onOpenChange={() => undefined} onWriteCampaign={onWriteCampaign} />);

    fireEvent.click(await screen.findByTestId('voice-style-direct'));
    const direct = voiceText();
    await goOn();

    const site = await screen.findByTestId('settings-site-house');
    fireEvent.change(site, { target: { value: 'http://www.villasofia.it' } });
    expect(screen.getByText('Usa un indirizzo che inizia con https://')).toBeVisible();
    expect(next()).toBeDisabled();
    fireEvent.change(site, { target: { value: 'https://www.villasofia.it' } });
    fireEvent.change(screen.getByTestId('settings-notes-house'), { target: { value: 'Check-in dalle 15' } });
    await goOn();

    fireEvent.click(await screen.findByTestId('settings-limit-1'));
    fireEvent.click(screen.getByTestId('settings-loyal-4'));
    fireEvent.click(screen.getByTestId('settings-lost-12'));
    await goOn();

    fireEvent.click(await screen.findByTestId('settings-newsletter-on'));
    expect(next()).toBeDisabled();
    fireEvent.click(await screen.findByTestId('newsletter-group-group-1'));
    fireEvent.click(screen.getByTestId('newsletter-cadence-14'));
    fireEvent.click(screen.getByTestId('newsletter-topic-events'));
    await goOn();

    const review = await screen.findByTestId('settings-review');
    expect(review).toHaveTextContent('Al massimo 1 e-mail al mese per ospite');
    expect(review).toHaveTextContent('Fedele dopo 4 soggiorni');
    expect(review).toHaveTextContent('Da riconquistare dopo 12 mesi');
    expect(review).toHaveTextContent('Ogni 2 settimane');
    expect(review).toHaveTextContent('Casa: Villa Sofia · Gruppo: Ospiti fedeli');
    expect(ApiClient.put).not.toHaveBeenCalled();

    fireEvent.click(next());
    expect(await screen.findByTestId('settings-done')).toBeVisible();
    expect(ApiClient.put).toHaveBeenCalledWith('/campaigns/studio/settings', {
      voice: direct,
      propertyNotes: { house: 'Check-in dalle 15' },
      propertyUrls: { house: 'https://www.villasofia.it' },
      monthlyEmailLimit: 1,
      loyalStays: 4,
      lostMonths: 12,
      newsletter: { segmentId: 'group-1', propertyId: 'house', cadenceDays: 14, instructions: 'Segnala gli eventi in programma nella zona.', enabled: true },
    });

    fireEvent.click(screen.getByTestId('settings-wizard-write'));
    expect(onWriteCampaign).toHaveBeenCalledOnce();
  }, 20_000);

  it('warns that campaigns will not go out when the host sets no e-mails at all', async () => {
    view(<SettingsWizard open onOpenChange={() => undefined} />);
    await screen.findByTestId('voice-text');
    await goOn();
    await goOn();

    expect(screen.queryByTestId('settings-limit-paused')).toBeNull();
    fireEvent.click(await screen.findByTestId('settings-limit-0'));
    expect(screen.getByTestId('settings-limit-paused')).toBeVisible();
  });

  it('keeps the words the host wrote when going to another step and back, and lets a step be changed from the summary', async () => {
    view(<SettingsWizard open onOpenChange={() => undefined} />);
    fireEvent.change(await screen.findByTestId('voice-text'), { target: { value: 'Scrivo sempre in modo semplice.' } });
    await goOn();
    fireEvent.click(await screen.findByRole('button', { name: 'Indietro' }));
    expect(await screen.findByTestId('voice-text')).toHaveValue('Scrivo sempre in modo semplice.');

    await goOn();
    await goOn();
    await goOn();
    await goOn();
    expect(await screen.findByTestId('settings-review')).toHaveTextContent('Scrivo sempre in modo semplice.');
    fireEvent.click(screen.getByTestId('settings-change-voice'));
    expect(await screen.findByTestId('voice-text')).toHaveValue('Scrivo sempre in modo semplice.');
  }, 20_000);

  it('tells the host in plain words when the save fails, and keeps the choices', async () => {
    vi.mocked(ApiClient.put).mockRejectedValue(Object.assign(new AxiosError('Invalid'), { response: { status: 400, data: { code: 'marketing_settings_invalid' } } }));
    view(<SettingsWizard open onOpenChange={() => undefined} />);
    await screen.findByTestId('voice-text');
    fireEvent.click(screen.getByTestId('settings-wizard-next'));
    for (let step = 0; step < 3; step += 1) await goOn();

    fireEvent.click(await screen.findByTestId('settings-wizard-next'));
    expect(await screen.findByText(/Alcuni valori non sono validi/)).toBeVisible();
    expect(screen.getByTestId('settings-review')).toBeVisible();
  }, 20_000);

  it('says that another account manages the settings when the host cannot change them', async () => {
    current = { ...initial, canEdit: false };
    view(<SettingsWizard open onOpenChange={() => undefined} />);
    expect(await screen.findByTestId('settings-locked')).toBeVisible();
    expect(screen.queryByTestId('settings-wizard-next')).toBeNull();
  });
});
