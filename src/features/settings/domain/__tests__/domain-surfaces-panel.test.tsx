import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { DomainApi } from '@/api/domain.api';
import en from '@/i18n/locales/en.json';
import it_ from '@/i18n/locales/it.json';
import type { DomainSurfaces, OrgDomainConfig } from '@/types/domain.types';
import { DomainSurfacesPanel } from '../domain-surfaces-panel';
import { useOrgDomain } from '../use-org-domain';

vi.mock('@/api/domain.api', () => ({
  DomainApi: { getDomain: vi.fn(), setSurfaces: vi.fn(), requestOwnerLogin: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const OFF = { guestArea: false, ownerPortal: false, ownerLoginReady: false, linksOnOwnDomain: false };
const ON = { guestArea: true, ownerPortal: true, ownerLoginReady: true, linksOnOwnDomain: true };

const SURFACES: DomainSurfaces = {
  guestAreaOnOwnDomain: false,
  ownerPortalOnOwnDomain: false,
  useOwnDomainForLinks: false,
  ownerLoginHostState: 'NotRequested',
  ownerLoginAutomatic: true,
  effective: OFF,
};

function config(surfaces: Partial<DomainSurfaces> | null = {}, overrides: Partial<OrgDomainConfig> = {}): OrgDomainConfig {
  return {
    orgId: 'org-1',
    publicHostMode: 'CustomDomain',
    subdomain: null,
    customDomain: 'prenota.tuavilla.it',
    domainVerificationStatus: 'Verified',
    canUseCustomDomain: true,
    dnsInstructions: null,
    publicUrls: { pathUrl: 'https://sito.test/book/villa-mare', subdomainUrl: null, customDomainUrl: 'https://prenota.tuavilla.it' },
    surfaces: surfaces === null ? null : { ...SURFACES, ...surfaces },
    ...overrides,
  };
}

/** The panel as the page holds it: the configuration comes from the cache of the domain settings, which the two mutations of the block write into. */
function Harness() {
  const { data } = useOrgDomain('org-1');
  return data
    ? createElement('div', { 'data-testid': 'config-loaded' }, createElement(DomainSurfacesPanel, { orgId: 'org-1', config: data }))
    : null;
}

function renderPanel(first: OrgDomainConfig) {
  vi.mocked(DomainApi.getDomain).mockResolvedValue(first);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(createElement(I18nextProvider, { i18n }, createElement(QueryClientProvider, { client }, createElement(Harness))));
}

const guestSwitch = () => screen.findByRole('switch', { name: i18n.t('domain.surfaces.guestArea.label') });
const ownerSwitch = () => screen.findByRole('switch', { name: i18n.t('domain.surfaces.ownerPortal.label') });
const linksSwitch = () => screen.findByRole('switch', { name: i18n.t('domain.surfaces.links.label') });

describe('DomainSurfacesPanel (E40/F02/US02, NF-140..NF-142)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  describe('when it is there', () => {
    it('panel_SurfacesNull_ShowsNothing', async () => {
      renderPanel(config(null));
      await screen.findByTestId('config-loaded');
      expect(screen.queryByTestId('domain-surfaces-panel')).not.toBeInTheDocument();
    });

    it.each(['Pending', 'Failed'] as const)('panel_Domain%s_ShowsNothing', async (status) => {
      renderPanel(config({ effective: ON }, { domainVerificationStatus: status }));
      await screen.findByTestId('config-loaded');
      expect(screen.queryByTestId('domain-surfaces-panel')).not.toBeInTheDocument();
    });
  });

  describe('the line of the owner sign-in', () => {
    it.each([
      ['NotRequested', true, 'notRequested', 'non ancora richiesto'],
      ['Pending', true, 'pendingAutomatic', 'registrazione in corso'],
      ['Pending', false, 'pendingManual', 'in attesa di abilitazione da parte di CasaZen'],
      ['Ready', true, 'ready', 'attivo'],
      ['Failed', true, 'failed', 'registrazione non riuscita'],
    ] as const)('ownerLogin_%s_Automatic%s_SaysIt', async (state, automatic, key, italian) => {
      renderPanel(config({ ownerLoginHostState: state, ownerLoginAutomatic: automatic }));

      const line = await screen.findByTestId('domain-owner-login');
      expect(line).toHaveAttribute('data-state', key);
      // The words of the brief, and the key of the locale file says the same.
      expect(screen.getByTestId('domain-owner-login-state').textContent).toBe(italian);
      expect(italian).toBe(i18n.t(`domain.surfaces.ownerLogin.state.${key}`));
      // «Riprova» only when it failed; the hand-made enabling says that there is nothing to do.
      expect(screen.queryByTestId('domain-owner-login-retry') !== null).toBe(state === 'Failed');
      expect(screen.queryByText(i18n.t('domain.surfaces.ownerLogin.manualHint')) !== null).toBe(key === 'pendingManual');
    });

    it('ownerLogin_Failed_RetryCallsTheEndpointOnceAndDisablesTheControlsWhileInFlight', async () => {
      let answer!: (config: OrgDomainConfig) => void;
      vi.mocked(DomainApi.requestOwnerLogin).mockReturnValue(
        new Promise<OrgDomainConfig>((resolve) => {
          answer = resolve;
        }),
      );
      renderPanel(config({ ownerLoginHostState: 'Failed' }));

      const retry = await screen.findByRole('button', { name: i18n.t('domain.surfaces.ownerLogin.retry') });
      expect(retry).toBeEnabled();
      fireEvent.click(retry);

      // While the request is on its way nothing of the block can be pressed: no second request, no choice that would overwrite another.
      await waitFor(() => expect(retry).toBeDisabled());
      for (const control of screen.getAllByRole('switch')) expect(control).toBeDisabled();
      fireEvent.click(retry);
      expect(DomainApi.requestOwnerLogin).toHaveBeenCalledTimes(1);
      expect(DomainApi.requestOwnerLogin).toHaveBeenCalledWith('org-1');
      expect(DomainApi.setSurfaces).not.toHaveBeenCalled();

      // The answer is the whole configuration: the line says what the server says now, the retry is gone and the switches are back.
      answer(config({ ownerLoginHostState: 'Pending', ownerLoginAutomatic: true }));
      await waitFor(() => expect(screen.getByTestId('domain-owner-login')).toHaveAttribute('data-state', 'pendingAutomatic'));
      expect(screen.queryByTestId('domain-owner-login-retry')).not.toBeInTheDocument();
      for (const control of screen.getAllByRole('switch')) expect(control).toBeEnabled();
      expect(toast.success).toHaveBeenCalledWith(i18n.t('domain.surfaces.ownerLogin.retryRequested'));
    });

    it('ownerLogin_FailedAgain_IsAWarningAndKeepsTheRetry', async () => {
      vi.mocked(DomainApi.requestOwnerLogin).mockResolvedValue(config({ ownerLoginHostState: 'Failed' }));
      renderPanel(config({ ownerLoginHostState: 'Failed' }));

      fireEvent.click(await screen.findByRole('button', { name: i18n.t('domain.surfaces.ownerLogin.retry') }));

      await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(i18n.t('domain.surfaces.ownerLogin.retryStillFailed')));
      expect(toast.success).not.toHaveBeenCalled();
      expect(await screen.findByTestId('domain-owner-login-retry')).toBeEnabled();
    });

    it('ownerLogin_RetryRefused_ToastsTheErrorAndKeepsTheRetry', async () => {
      vi.mocked(DomainApi.requestOwnerLogin).mockRejectedValue(new Error('boom'));
      renderPanel(config({ ownerLoginHostState: 'Failed' }));

      fireEvent.click(await screen.findByRole('button', { name: i18n.t('domain.surfaces.ownerLogin.retry') }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('domain.surfaces.ownerLogin.retryFailed')));
      await waitFor(() => expect(screen.getByTestId('domain-owner-login-retry')).toBeEnabled());
      expect(screen.getByTestId('domain-owner-login')).toHaveAttribute('data-state', 'failed');
    });
  });

  describe('the three switches', () => {
    it('switches_ShowTheStoredValues_AndAToggleSavesAllThreeBooleansAndShowsTheSavedState', async () => {
      vi.mocked(DomainApi.setSurfaces).mockResolvedValue(config({ guestAreaOnOwnDomain: true, ownerPortalOnOwnDomain: true, effective: { ...OFF, guestArea: true } }));
      renderPanel(config({ ownerPortalOnOwnDomain: true }));

      const guest = await guestSwitch();
      expect(guest).not.toBeChecked();
      expect(await ownerSwitch()).toBeChecked();
      expect(await linksSwitch()).not.toBeChecked();

      fireEvent.click(guest);

      await waitFor(() => expect(DomainApi.setSurfaces).toHaveBeenCalledTimes(1));
      // All three, every time: the one that moved over the two the server holds.
      expect(DomainApi.setSurfaces).toHaveBeenCalledWith('org-1', {
        guestAreaOnOwnDomain: true,
        ownerPortalOnOwnDomain: true,
        useOwnDomainForLinks: false,
      });
      await waitFor(() => expect(guest).toBeEnabled());
      expect(guest).toBeChecked();
      expect(toast.success).toHaveBeenCalledWith(i18n.t('domain.settings.saved'));
    });

    it('switches_ASaveInFlight_ShowsTheChoiceAndDisablesEveryControl_AndARefusedSaveGoesBackToTheStoredValue', async () => {
      let refuse!: (reason: unknown) => void;
      vi.mocked(DomainApi.setSurfaces).mockReturnValue(
        new Promise<OrgDomainConfig>((_resolve, reject) => {
          refuse = reject;
        }),
      );
      renderPanel(config({ ownerLoginHostState: 'Failed' }));

      const guest = await guestSwitch();
      fireEvent.click(guest);

      await waitFor(() => expect(guest).toBeDisabled());
      expect(guest).toBeChecked();
      expect(await ownerSwitch()).toBeDisabled();
      expect(await linksSwitch()).toBeDisabled();
      expect(screen.getByTestId('domain-owner-login-retry')).toBeDisabled();
      expect(DomainApi.setSurfaces).toHaveBeenCalledTimes(1);

      refuse(new Error('boom'));

      await waitFor(() => expect(guest).toBeEnabled());
      expect(guest).not.toBeChecked();
      expect(toast.error).toHaveBeenCalledWith(i18n.t('domain.settings.saveFailed'));
      expect(screen.getByTestId('domain-owner-login-retry')).toBeEnabled();
    });
  });

  describe('what is not on yet', () => {
    it('notes_AChoiceThatIsMadeButNotOn_SaysSoInWords', async () => {
      renderPanel(
        config({
          guestAreaOnOwnDomain: true,
          ownerPortalOnOwnDomain: true,
          useOwnDomainForLinks: true,
          // The portal is served, but the sign-in of the owners is not ready: their links do not move yet.
          effective: { ...OFF, ownerPortal: true },
          ownerLoginHostState: 'Pending',
        }),
      );

      expect(await screen.findByTestId('domain-surface-guest-area-note')).toHaveTextContent(i18n.t('domain.surfaces.guestArea.notActive'));
      expect(screen.getByTestId('domain-surface-owner-portal-note')).toHaveTextContent(i18n.t('domain.surfaces.ownerPortal.notActive'));
      expect(screen.getByTestId('domain-surface-links-note')).toHaveTextContent(i18n.t('domain.surfaces.links.notActive'));
      // The switches still show what was chosen, and no address is shown for links that are not on the domain.
      expect(await guestSwitch()).toBeChecked();
      expect(screen.queryByText('https://prenota.tuavilla.it', { exact: false })).not.toBeInTheDocument();
    });

    it('notes_EverythingOn_ShowsNoNoteAndTheAddressTheLinksUse', async () => {
      renderPanel(
        config({
          guestAreaOnOwnDomain: true,
          ownerPortalOnOwnDomain: true,
          useOwnDomainForLinks: true,
          effective: ON,
          ownerLoginHostState: 'Ready',
        }),
      );

      const note = await screen.findByTestId('domain-surface-links-note');
      expect(note).toHaveTextContent(i18n.t('domain.surfaces.links.address', { url: 'https://prenota.tuavilla.it' }));
      expect(note).toHaveTextContent('https://prenota.tuavilla.it');
      expect(screen.queryByTestId('domain-surface-guest-area-note')).not.toBeInTheDocument();
      expect(screen.queryByTestId('domain-surface-owner-portal-note')).not.toBeInTheDocument();
    });

    it('notes_AChoiceThatIsOff_SaysNothing', async () => {
      renderPanel(config({ effective: OFF }));

      await guestSwitch();
      for (const id of ['guest-area', 'owner-portal', 'links']) expect(screen.queryByTestId(`domain-surface-${id}-note`)).not.toBeInTheDocument();
    });

    it('notes_LinksOnTheDomainWithoutAnAddress_ShowsNoAddressAndNoNote', async () => {
      renderPanel(
        config(
          { useOwnDomainForLinks: true, effective: { ...OFF, linksOnOwnDomain: true } },
          { publicUrls: { pathUrl: 'https://sito.test/book/villa-mare', customDomainUrl: null } },
        ),
      );

      await linksSwitch();
      expect(screen.queryByTestId('domain-surface-links-note')).not.toBeInTheDocument();
    });
  });
});

/** Every text of a locale subtree with the path of its key, and the keys of every object of it in the order they are written. */
function scan(node: unknown, path: string, texts: Array<[string, string]> = [], orders: Array<[string, string[]]> = []) {
  if (typeof node === 'string') texts.push([path, node]);
  else if (node !== null && typeof node === 'object') {
    orders.push([path, Object.keys(node)]);
    for (const [key, value] of Object.entries(node)) scan(value, `${path}.${key}`, texts, orders);
  }
  return { texts, orders };
}

describe('the texts of the block (E40/F02/US02)', () => {
  // No other system is named: not the one that signs the owners in, nor the ones that host the site, take the payments or manage the channels.
  const SYSTEM = /auth0|vercel|railway|supabase|stripe|octorate|kross|krossbooking|concordato\s*facile|wordpress/i;
  const NEW_SENTENCES = ['domainVerified', 'ownerLoginFailed', 'ownerLoginReady'];
  // The run of the bell texts that is written in alphabetical order, and where each of the three new sentences has its place (not after the run).
  const BELL_RUN = [...NEW_SENTENCES, 'otaReviewActionFailed', 'otaReviewReceived', 'scheduledMessageIssue'];

  it.each([
    ['it', it_],
    ['en', en],
  ] as const)('texts_%s_NameNoSystemAndTheNewKeysAreInAlphabeticalOrder', (_language, locale) => {
    const { texts, orders } = scan(locale.domain.surfaces, 'domain.surfaces');
    // The scan really reaches the texts of the block.
    expect(texts.length).toBeGreaterThanOrEqual(24);
    for (const key of NEW_SENTENCES) texts.push([`notifications.types.${key}`, String((locale.notifications.types as Record<string, string>)[key])]);
    expect(NEW_SENTENCES.every((key) => key in locale.notifications.types)).toBe(true);

    expect(texts.filter(([, text]) => SYSTEM.test(text)).map(([key, text]) => `${key}: ${text}`)).toEqual([]);
    expect(texts.filter(([, text]) => text.trim() === '').map(([key]) => key)).toEqual([]);
    for (const [path, keys] of orders) expect(keys, path).toEqual([...keys].sort());
    // The order the keys really have in the file (object keys that are not numbers keep it): the three new sentences each sit in their place of the run of the bell.
    expect(Object.keys(locale.notifications.types).filter((key) => BELL_RUN.includes(key))).toEqual([...BELL_RUN].sort());
  });

  it('texts_TheCodeOfTheBlock_NeverUsesADefaultValue', () => {
    const sources = import.meta.glob<string>(['/src/features/settings/domain/domain-surfaces-panel.tsx', '/src/features/settings/domain/use-org-domain.ts'], {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    expect(Object.keys(sources)).toHaveLength(2);
    expect(Object.values(sources).some((source) => /\bdefaultValue\b/.test(source))).toBe(false);
  });
});
