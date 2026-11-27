import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import QRCode from 'qrcode';
import i18n from '@/i18n/config';
import { resolveBookingSite } from '@/lib/booking-link';
import { freezeClock } from '@/test/clock';
import type { OrgBookingSite } from '../../domain/use-org-domain';
import { BookingLinkDialog } from '../booking-link-dialog';

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,QRCODE')) } }));

/**
 * The link generator of the Vetrina (E27/F01/US02, NF-123): the agency picks what it wants in the link of a home and copies it. What the dialog holds is that the link
 * is on the address of the site the org really has, says where the guest comes from, and carries nothing of a person, whatever was typed.
 */
const APP = 'https://app.example.test';
const home = { id: '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b', name: 'Casa Mare', slug: 'casa-mare', maxGuests: 4 };
const OWN_HOST = resolveBookingSite({
  orgSlug: 'villa-rossi',
  publicUrls: { pathUrl: `${APP}/book/villa-rossi`, subdomainUrl: null, customDomainUrl: 'https://www.agenzia.it' },
  appOrigin: APP,
});
const PLATFORM = resolveBookingSite({ orgSlug: 'villa-rossi', publicUrls: null, appOrigin: APP });

function renderDialog({ status = 'ready', site = OWN_HOST, publishable = true, retry = vi.fn() }: { status?: OrgBookingSite['status']; site?: OrgBookingSite['site']; publishable?: boolean; retry?: () => void } = {}) {
  return render(<BookingLinkDialog open onOpenChange={vi.fn()} property={home} publishable={publishable} bookingSite={{ site, status, retry }} />);
}

const link = () => (screen.getByTestId('booking-link-url') as HTMLInputElement).value;
const query = () => new URL(link()).searchParams;

describe('BookingLinkDialog', () => {
  beforeEach(async () => {
    vi.mocked(QRCode.toDataURL).mockClear();
    freezeClock('2026-10-05T10:00:00Z');
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('BookingLinkDialog_JustOpened_IsTheHomeOnTheOwnDomainOfTheSiteSayingItComesFromTheAgency', () => {
    renderDialog();

    expect(link()).toBe('https://www.agenzia.it/property/casa-mare?guests=2&lang=it&utm_source=agency-site&utm_medium=link');
    expect(screen.getByTestId('booking-link-copy')).toBeEnabled();
    expect(screen.queryByTestId('booking-link-site-failed')).toBeNull();
  });

  it('BookingLinkDialog_SiteOnThePlatform_StartsFromTheBookPathAndNotFromTheDomainOfTheAgency', () => {
    renderDialog({ site: PLATFORM });

    expect(link()).toBe(`${APP}/book/villa-rossi/property/casa-mare?guests=2&lang=it&utm_source=agency-site&utm_medium=link`);
  });

  it('BookingLinkDialog_DatesGuestsLanguageAndCampaign_AreInTheLink', () => {
    renderDialog();

    fireEvent.change(screen.getByTestId('booking-link-check-in'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByTestId('booking-link-check-out'), { target: { value: '2026-12-05' } });
    fireEvent.click(within(screen.getByTestId('booking-link-guests')).getAllByRole('button')[1]);
    fireEvent.click(screen.getByTestId('booking-link-language-en'));
    fireEvent.change(screen.getByTestId('booking-link-campaign'), { target: { value: 'Estate 2026' } });

    expect(link()).toBe(
      'https://www.agenzia.it/property/casa-mare?checkin=2026-12-01&checkout=2026-12-05&guests=3&lang=en&utm_source=agency-site&utm_medium=link&utm_campaign=estate-2026',
    );
    // What the campaign will be called in the link is said before it is copied.
    expect(screen.getByText('Nel link sarà scritto: estate-2026')).toBeInTheDocument();
  });

  it('BookingLinkDialog_DatesThatAreNotAStay_GoNowhereAndSayWhy', () => {
    renderDialog();

    fireEvent.change(screen.getByTestId('booking-link-check-in'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByTestId('booking-link-check-out'), { target: { value: '2026-12-05' } });
    expect(screen.getByText("L'arrivo non può essere nel passato.")).toBeInTheDocument();
    expect(query().has('checkin')).toBe(false);
    expect(query().has('checkout')).toBe(false);

    fireEvent.change(screen.getByTestId('booking-link-check-in'), { target: { value: '2026-12-10' } });
    expect(screen.getByText('La partenza deve essere dopo l\'arrivo.')).toBeInTheDocument();
    expect(query().has('checkin')).toBe(false);
  });

  it('BookingLinkDialog_CampaignThatIsAPersonalDatum_IsRefusedAndNeverInTheLink', () => {
    renderDialog();

    for (const typed of ['mario.rossi@example.com', '333 123 4567', 'RSSMRA80A01H501U']) {
      fireEvent.change(screen.getByTestId('booking-link-campaign'), { target: { value: typed } });

      expect(screen.getByText(/Questo nome non si può usare nel link/)).toBeInTheDocument();
      expect(query().has('utm_campaign'), typed).toBe(false);
      expect(link().toLowerCase()).not.toMatch(/mario|example|333|rssmra/);
    }
  });

  it('BookingLinkDialog_Guests_StayWithinWhatTheHomeTakes', () => {
    renderDialog();
    const plus = within(screen.getByTestId('booking-link-guests')).getAllByRole('button')[1];

    for (let press = 0; press < 6; press += 1) fireEvent.click(plus);

    expect(query().get('guests')).toBe('4');
  });

  it('BookingLinkDialog_CopyLink_WritesTheLinkOnTheClipboardAndSaysSo', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderDialog();

    fireEvent.click(screen.getByTestId('booking-link-copy'));

    await waitFor(() => expect(screen.getByTestId('booking-link-copy')).toHaveTextContent('Link copiato'));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(link());
  });

  it('BookingLinkDialog_ClipboardThatRefuses_DoesNotSayItWasCopied', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderDialog();

    fireEvent.click(screen.getByTestId('booking-link-copy'));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('booking-link-copy')).toHaveTextContent('Copia link');
  });

  it('BookingLinkDialog_Qr_IsTheCodeOfTheLinkAndFollowsIt', async () => {
    renderDialog();

    expect(await screen.findByTestId('booking-link-qr')).toHaveAttribute('src', 'data:image/png;base64,QRCODE');
    expect(QRCode.toDataURL).toHaveBeenCalledWith(link(), expect.anything());

    fireEvent.change(screen.getByTestId('booking-link-campaign'), { target: { value: 'volantino' } });
    await waitFor(() => expect(QRCode.toDataURL).toHaveBeenLastCalledWith(expect.stringContaining('utm_campaign=volantino'), expect.anything()));
  });

  it('BookingLinkDialog_SettingsOfTheDomainNotRead_SaysTheLinkIsOnTheAddressOfCasaZenAndOffersToTryAgain', () => {
    const retry = vi.fn();
    renderDialog({ status: 'failed', site: PLATFORM, retry });

    expect(screen.getByTestId('booking-link-site-failed')).toHaveTextContent("il link usa l'indirizzo di CasaZen");
    fireEvent.click(within(screen.getByTestId('booking-link-site-failed')).getByRole('button', { name: 'Riprova' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('BookingLinkDialog_CallerWhoMayNotReadTheDomain_IsToldTheLinkIsOnTheAddressOfCasaZen', () => {
    renderDialog({ status: 'restricted', site: PLATFORM });

    expect(screen.getByTestId('booking-link-site-restricted')).toHaveTextContent("l'indirizzo del tuo sito lo vede solo chi amministra l'account");
    expect(screen.getByTestId('booking-link-copy')).toBeEnabled();
  });

  it('BookingLinkDialog_SettingsStillOnTheirWay_DoNotLetTheAgencyCopyAnAddressThatMayChange', () => {
    renderDialog({ status: 'loading', site: PLATFORM });

    expect(screen.getByTestId('booking-link-site-loading')).toBeInTheDocument();
    expect(screen.getByTestId('booking-link-copy')).toBeDisabled();
    expect(screen.getByTestId('booking-link-print')).toBeDisabled();
  });

  it('BookingLinkDialog_HomeNotOnTheSite_SaysTheLinkWorksOnceItIs', () => {
    renderDialog({ publishable: false });

    expect(screen.getByTestId('booking-link-not-published')).toBeInTheDocument();
  });

  it('BookingLinkDialog_English_IsWrittenInEnglish', async () => {
    await i18n.changeLanguage('en');
    renderDialog();

    expect(screen.getByRole('dialog', { name: "Link for your agency's website" })).toBeInTheDocument();
    expect(screen.getByTestId('booking-link-copy')).toHaveTextContent('Copy link');
    // The language of the link is the one of the screen to begin with.
    expect(query().get('lang')).toBe('en');
  });
});
