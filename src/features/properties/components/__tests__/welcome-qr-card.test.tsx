import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { welcomeApi } from '@/api/welcome.api';
import { httpError } from '@/features/leases/__tests__/lease-test-utils';
import type { WelcomeLink } from '@/types/welcome.types';
import { WelcomeQrCard } from '../welcome-qr-card';

vi.mock('@/api/welcome.api', () => ({
  welcomeApi: { getLink: vi.fn(), createLink: vi.fn(), rotateLink: vi.fn(), getPage: vi.fn(), submitConsent: vi.fn() },
}));
// The image of the code is drawn on a canvas, which jsdom does not have: the card only has to show what it is given.
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,QRCODE')) } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * The QR the host prints for a house (CRM-03). Replacing it makes the printed one useless at once, so it never happens without the host
 * being told so first; and the sign carries the same line in both languages, whatever the language of the host's screen.
 */
const PROPERTY_ID = '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b';
const OLD_URL = 'https://casazen.example/benvenuto/token-vecchio';
const NEW_URL = 'https://casazen.example/benvenuto/token-nuovo';
const active = (url: string): WelcomeLink => ({ active: true, url, createdAt: '2026-11-10T09:00:00Z' });
const NO_LINK: WelcomeLink = { active: false, url: null, createdAt: null };

const getLink = vi.mocked(welcomeApi.getLink);
const createLink = vi.mocked(welcomeApi.createLink);
const rotateLink = vi.mocked(welcomeApi.rotateLink);

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WelcomeQrCard propertyId={PROPERTY_ID} propertyName="Villa Lago" />
    </QueryClientProvider>,
  );
}

describe('WelcomeQrCard (CRM-03)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('WelcomeQrCard_ActiveLink_ShowsTheQrAndTheLinkAndCopiesIt', async () => {
    getLink.mockResolvedValue(active(OLD_URL));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderCard();

    expect(await screen.findByTestId('welcome-qr-image')).toHaveAttribute('src', 'data:image/png;base64,QRCODE');
    expect(screen.getByTestId('welcome-qr-image')).toHaveAttribute('alt', 'QR della pagina di benvenuto di Villa Lago');
    expect(screen.getByTestId('welcome-qr-link')).toHaveValue(OLD_URL);
    fireEvent.click(screen.getByTestId('welcome-qr-copy'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(OLD_URL));
    expect(await screen.findByRole('button', { name: 'Copiato' })).toBeInTheDocument();
  });

  it('WelcomeQrCard_PrintTheSign_OpensASheetWithTheCodeAndALineInItalianAndInEnglish', async () => {
    getLink.mockResolvedValue(active(OLD_URL));
    const sheet = { document: document.implementation.createHTMLDocument(''), print: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(sheet as unknown as Window);
    // The host reads the app in English: the sign is for the guests, so it has both languages all the same.
    await i18n.changeLanguage('en');
    renderCard();

    await screen.findByTestId('welcome-qr-image');
    await waitFor(() => expect(screen.getByTestId('welcome-qr-print')).toBeEnabled());
    fireEvent.click(screen.getByTestId('welcome-qr-print'));

    expect(sheet.document.querySelector('h1')?.textContent).toBe('Benvenuto! · Welcome!');
    const lines = [...sheet.document.querySelectorAll('p')].map((line) => line.textContent);
    expect(lines).toEqual([
      'Inquadra il codice per lasciarci un contatto e ricevere novità e offerte. È facoltativo.',
      'Scan the code to leave us a contact and receive news and offers. It is optional.',
    ]);
    expect(sheet.document.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,QRCODE');
  });

  it('WelcomeQrCard_NewQr_AsksFirstThatThePrintedOneWillStopWorkingAndChangesNothingUntilConfirmed', async () => {
    getLink.mockResolvedValue(active(OLD_URL));
    rotateLink.mockResolvedValue(active(NEW_URL));
    renderCard();

    fireEvent.click(await screen.findByTestId('welcome-qr-renew'));
    const dialog = await screen.findByRole('dialog', { name: 'Creare un nuovo QR?' });
    expect(dialog).toHaveTextContent('smetterà di funzionare subito');
    expect(rotateLink).not.toHaveBeenCalled();

    // Backing out leaves the printed code as it is.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(rotateLink).not.toHaveBeenCalled();
    expect(screen.getByTestId('welcome-qr-link')).toHaveValue(OLD_URL);

    fireEvent.click(screen.getByTestId('welcome-qr-renew'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sì, crea un nuovo QR' }));

    await waitFor(() => expect(rotateLink).toHaveBeenCalledTimes(1));
    expect(rotateLink).toHaveBeenCalledWith(PROPERTY_ID);
    await waitFor(() => expect(screen.getByTestId('welcome-qr-link')).toHaveValue(NEW_URL));
  });

  it('WelcomeQrCard_NewQrRefused_KeepsTheDialogOpenWithTheReasonAndTheOldCode', async () => {
    getLink.mockResolvedValue(active(OLD_URL));
    rotateLink.mockRejectedValue(httpError(403));
    renderCard();

    fireEvent.click(await screen.findByTestId('welcome-qr-renew'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sì, crea un nuovo QR' }));

    expect(await screen.findByTestId('welcome-qr-renew-error')).toHaveTextContent('Non hai i permessi');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('welcome-qr-link')).toHaveValue(OLD_URL);
  });

  it('WelcomeQrCard_NoLinkYet_OffersToMakeOneWithoutAConfirmation', async () => {
    getLink.mockResolvedValue(NO_LINK);
    createLink.mockResolvedValue(active(NEW_URL));
    renderCard();

    expect(await screen.findByTestId('welcome-qr-none')).toHaveTextContent('non c\'è ancora un QR');
    expect(screen.queryByTestId('welcome-qr-image')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('welcome-qr-create'));

    await waitFor(() => expect(createLink).toHaveBeenCalledWith(PROPERTY_ID));
    expect(await screen.findByTestId('welcome-qr-image')).toBeInTheDocument();
    expect(screen.getByTestId('welcome-qr-link')).toHaveValue(NEW_URL);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('WelcomeQrCard_ReadFails_SaysSoAndOffersToTryAgain', async () => {
    getLink.mockRejectedValueOnce(httpError(500)).mockResolvedValue(active(OLD_URL));
    renderCard();

    const error = await screen.findByTestId('welcome-qr-error');
    fireEvent.click(within(error).getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByTestId('welcome-qr-link')).toHaveValue(OLD_URL);
  });
});
