import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { resolveBookingSite } from '@/lib/booking-link';
import type { Property } from '@/types';
import type { OrgBookingSite } from '../../domain/use-org-domain';
import { VetrinaPropertyRow } from '../vetrina-property-row';
import { VetrinaUrlCopy } from '../vetrina-url-copy';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

/**
 * The copy of an address of the booking site in the Vetrina (E27/F01/US02, NF-123): the icon of a home and the box of the address of the org. The address is the one of the site
 * only when the settings that tell it were read; while they are read nothing is copied, and when they were not (a failed read, or a caller who may not read them) what goes to the
 * clipboard is the address of CasaZen and the host is told so, never «URL copiato» alone.
 */
const APP = 'https://app.example.test';
const home = { id: '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b', name: 'Casa Mare', city: 'Roma', slug: 'casa-mare', maxGuests: 4, isActive: true, isPaused: false, complianceStatus: 'Active' } as unknown as Property;
const OWN_HOST = resolveBookingSite({
  orgSlug: 'villa-rossi',
  publicUrls: { pathUrl: `${APP}/book/villa-rossi`, subdomainUrl: null, customDomainUrl: 'https://www.agenzia.it' },
  appOrigin: APP,
});
const PLATFORM = resolveBookingSite({ orgSlug: 'villa-rossi', publicUrls: null, appOrigin: APP });

const bookingSite = (status: OrgBookingSite['status'], site: OrgBookingSite['site']): OrgBookingSite => ({ site, status, retry: vi.fn() });

describe('the copy of the address of the site', () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it.each([
    ['ready', OWN_HOST, 'https://www.agenzia.it/property/casa-mare', 'success', 'URL copiato negli appunti'],
    ['failed', PLATFORM, `${APP}/book/villa-rossi/property/casa-mare`, 'warning', "URL copiato, ma è l'indirizzo di CasaZen: non riusciamo a leggere quello del tuo sito."],
    ['restricted', PLATFORM, `${APP}/book/villa-rossi/property/casa-mare`, 'warning', "URL copiato, ma è l'indirizzo di CasaZen: quello del tuo sito lo vede solo chi amministra l'account."],
  ] as const)('VetrinaPropertyRow_CopyIconWithTheSettings_%s_SaysWhatWasCopied', async (status, site, copied, toastKind, text) => {
    const onSelect = vi.fn();
    render(<VetrinaPropertyRow property={home} bookingSite={bookingSite(status, site)} isSelected={false} onSelect={onSelect} />);

    const row = screen.getByTestId('vetrina-property-row');
    const button = screen.getByTestId('vetrina-property-copy-url');
    expect(row).not.toContainElement(button);
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    await waitFor(() => expect(toast[toastKind]).toHaveBeenCalledWith(text));
    expect(writeText).toHaveBeenCalledWith(copied);
    expect(onSelect).not.toHaveBeenCalled();
    // «URL copiato» alone is said only for the address of the site: one message, the one of the state.
    expect(toast.success).toHaveBeenCalledTimes(toastKind === 'success' ? 1 : 0);
    expect(toast.warning).toHaveBeenCalledTimes(toastKind === 'warning' ? 1 : 0);
  });

  it('VetrinaPropertyRow_CopyIconWhileTheSettingsAreRead_CopiesNothing', () => {
    render(<VetrinaPropertyRow property={home} bookingSite={bookingSite('loading', PLATFORM)} isSelected={false} onSelect={vi.fn()} />);

    const button = screen.getByTestId('vetrina-property-copy-url');
    expect(button).toBeDisabled();
    fireEvent.click(button);

    expect(writeText).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it.each([
    ['loading', "Leggiamo l'indirizzo del tuo sito…"],
    ['failed', "Non riusciamo a leggere l'indirizzo del tuo sito: questo è l'indirizzo di CasaZen."],
    ['restricted', "Questo è l'indirizzo di CasaZen: quello del tuo sito lo vede solo chi amministra l'account."],
  ] as const)('VetrinaUrlCopy_AddressOfTheOrgWithTheSettings_%s_SaysWhichAddressItIs', (status, note) => {
    render(<VetrinaUrlCopy url={`${APP}/book/villa-rossi`} status={status} variant="inline" />);

    expect(screen.getByTestId('vetrina-url-status')).toHaveTextContent(note);
    expect(screen.getByTestId('vetrina-public-url')).toHaveValue(`${APP}/book/villa-rossi`);
    if (status === 'loading') expect(screen.getByTestId('vetrina-url-copy-button')).toBeDisabled();
    else expect(screen.getByTestId('vetrina-url-copy-button')).toBeEnabled();
  });

  it('VetrinaUrlCopy_AddressOfTheSite_HasNoNoteAndIsCopiedAsTheAddressOfTheSite', async () => {
    render(<VetrinaUrlCopy url="https://www.agenzia.it/" status="ready" variant="inline" />);

    expect(screen.queryByTestId('vetrina-url-status')).toBeNull();
    fireEvent.click(screen.getByTestId('vetrina-url-copy-button'));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('URL copiato negli appunti'));
    expect(writeText).toHaveBeenCalledWith('https://www.agenzia.it/');
  });

  it('VetrinaUrlCopy_AddressOfCasaZen_IsToldInEnglishToo', async () => {
    await i18n.changeLanguage('en');
    render(<VetrinaUrlCopy url={`${APP}/book/villa-rossi`} status="failed" variant="inline" />);

    expect(screen.getByTestId('vetrina-url-status')).toHaveTextContent("We can't read the address of your site: this is the CasaZen address.");
    fireEvent.click(screen.getByTestId('vetrina-url-copy-button'));

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith("URL copied, but it's the CasaZen address: we can't read the address of your site."));
  });
});
