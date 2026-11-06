import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AxiosError, type AxiosResponse } from 'axios';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import { settleDrawer } from '@/test/drawer';
import type { MarketplaceCatalogEntry, MarketplaceEntryDetail } from '@/types';
import { MarketplaceEntryCard } from '../components/marketplace-entry-card';
import { MarketplaceEntryDrawer } from '../components/marketplace-entry-drawer';

// The drawer reads the entry through its hook and the property through the page's hook: the test gives their answers.
const hooks = vi.hoisted(() => ({ entry: vi.fn() }));
vi.mock('@/queries/use-marketplace', () => ({
  useMarketplaceEntry: (kind?: string, code?: string, propertyId?: string) => hooks.entry(kind, code, propertyId),
}));
vi.mock('../lib/marketplace-property', () => ({ useMarketplaceProperty: () => ({ property: { id: 'prop-1' } }) }));

const ROUTE = '/app/short-rent/marketplace?propertyId=prop-1&entry=Channel:PORTAL1';

const DETAIL: MarketplaceEntryDetail = {
  kind: 'Channel',
  code: 'PORTAL1',
  name: 'TEST Portal',
  logoUrl: null,
  status: 'NotActive',
  whatItDoes: 'Publishes your listings on the test portal.',
  audience: 'Hosts who have a listing to sell.',
  activation: {
    type: 'api',
    requirements: [
      { code: 'hotelId', text: 'The id of your listing on the portal.' },
      { code: 'panelAccess', text: 'Access to the panel of the portal.' },
    ],
    needsOctoratePanel: true,
  },
  cost: { text: null, invoicedBy: 'Unknown' },
  dataShared: ['The dates and the prices of your listing.', 'The bookings that come from the portal.'],
  deactivation: { text: 'Remove the connection from the settings of the property.', guided: true },
  faq: [{ q: 'Does it cost anything?', a: 'Ask the portal for its price list.' }],
  actions: { canActivate: true, reason: null },
};

const CARD: MarketplaceCatalogEntry = {
  kind: 'Channel',
  code: 'PORTAL1',
  name: 'TEST Portal',
  logoUrl: null,
  benefit: 'Sell on the test portal.',
  cost: { text: null, invoicedBy: 'Unknown' },
  status: 'NotActive',
  statusScope: 'Property',
  canActivate: true,
  reason: null,
};

/** What `useMarketplaceEntry` answers. */
function entryAnswer(data: MarketplaceEntryDetail | undefined, extra: Record<string, unknown> = {}) {
  return { data, isLoading: false, isError: false, error: null, refetch: vi.fn(), ...extra };
}

function Where() {
  return <output data-testid="where">{useLocation().search}</output>;
}

function renderDrawer(route = ROUTE, page: React.ReactNode = null) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[route]}>
        {page}
        <MarketplaceEntryDrawer />
        <Where />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

const notFound = () =>
  new AxiosError('missing', AxiosError.ERR_BAD_REQUEST, undefined, undefined, { status: 404, data: {}, statusText: '', headers: {}, config: {} } as unknown as AxiosResponse);

beforeEach(async () => {
  vi.clearAllMocks();
  hooks.entry.mockReturnValue(entryAnswer(DETAIL));
  await i18n.changeLanguage('it');
});

afterEach(async () => {
  cleanup();
  await settleDrawer();
});

describe('MarketplaceEntryDrawer · the detail card (MKT-02)', () => {
  it('MarketplaceEntryDrawer_AddressWithAnEntry_OpensOnLoadNamedByTheEntryAndAsksForTheProperty', async () => {
    renderDrawer();

    const dialog = await screen.findByRole('dialog', { name: 'TEST Portal' });
    expect(dialog).toBeInTheDocument();
    expect(hooks.entry).toHaveBeenCalledWith('Channel', 'PORTAL1', 'prop-1');
  });

  it('MarketplaceEntryDrawer_Open_ShowsEverySectionInOrder', async () => {
    renderDrawer();

    const dialog = await screen.findByRole('dialog', { name: 'TEST Portal' });
    const headings = within(dialog).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual([
      'Cosa fa',
      'Per chi è',
      'Cosa serve per attivarla',
      'Costo e chi fattura',
      'Quali dati si condividono',
      'Come si disattiva',
      'Domande frequenti',
    ]);
    expect(within(dialog).getByTestId('marketplace-detail-what')).toHaveTextContent('Publishes your listings on the test portal.');
    expect(within(dialog).getByTestId('marketplace-detail-audience')).toHaveTextContent('Hosts who have a listing to sell.');
    const requirements = within(within(dialog).getByTestId('marketplace-detail-requirements')).getAllByRole('listitem');
    expect(requirements.map((item) => item.textContent)).toEqual(['The id of your listing on the portal.', 'Access to the panel of the portal.']);
    expect(within(dialog).getByTestId('marketplace-detail-data')).toHaveTextContent('The bookings that come from the portal.');
    expect(within(dialog).getByTestId('marketplace-detail-deactivation')).toHaveTextContent('Remove the connection from the settings of the property.');
    // The status is said at the top, with its word.
    expect(within(dialog).getByTestId('marketplace-entry-detail-status')).toHaveTextContent('Non attivo');
  });

  it('MarketplaceEntryDrawer_UnknownCost_SaysNotSpecifiedAndShowsNoPrice', async () => {
    renderDrawer();

    const cost = within(await screen.findByRole('dialog')).getByTestId('marketplace-detail-cost');
    expect(cost).toHaveTextContent('Costo non specificato');
    expect(cost.textContent).not.toMatch(/\d/);
    // Nobody said who invoices: nothing is claimed.
    expect(cost).not.toHaveTextContent(/fatturato/i);
  });

  it('MarketplaceEntryDrawer_KnownCost_ShowsWhatTheServerSaidAndWhoInvoices', async () => {
    hooks.entry.mockReturnValue(entryAnswer({ ...DETAIL, cost: { text: '10 EUR al mese', invoicedBy: 'Partner' } }));
    renderDrawer();

    const cost = within(await screen.findByRole('dialog')).getByTestId('marketplace-detail-cost');
    expect(cost).toHaveTextContent('10 EUR al mese');
    expect(cost).toHaveTextContent('Fatturato dal partner');
  });

  it('MarketplaceEntryDrawer_LastStepOnThePanel_SaysSoWithoutAnyBrandName', async () => {
    renderDrawer();

    const dialog = await screen.findByRole('dialog');
    const step = within(dialog).getByTestId('marketplace-detail-panel-step');
    expect(step).toHaveTextContent("L'ultimo passaggio si fa sul pannello del tuo channel manager");
    expect(step).toHaveTextContent('ti riporta qui');
    expect(dialog.textContent).not.toMatch(/octorate/i);
  });

  it('MarketplaceEntryDrawer_NoPanelStep_SaysNothingAboutIt', async () => {
    hooks.entry.mockReturnValue(entryAnswer({ ...DETAIL, activation: { ...DETAIL.activation, needsOctoratePanel: false } }));
    renderDrawer();

    await screen.findByRole('dialog');
    expect(screen.queryByTestId('marketplace-detail-panel-step')).not.toBeInTheDocument();
  });

  it('MarketplaceEntryDrawer_ProviderSiteDeactivation_SaysItIsDoneThere', async () => {
    renderDrawer();

    expect(within(await screen.findByRole('dialog')).getByTestId('marketplace-detail-deactivation')).toHaveTextContent('La disattivazione si fa sul sito del fornitore.');
  });

  it('MarketplaceEntryDrawer_FrequentQuestions_AreAnAccordionOfNativeDetails', async () => {
    renderDrawer();

    const faq = within(await screen.findByRole('dialog')).getByTestId('marketplace-detail-faq');
    const question = within(faq).getByText('Does it cost anything?');
    expect(question.closest('summary')).not.toBeNull();
    expect(question.closest('details')).not.toHaveAttribute('open');
    expect(within(faq).getByText('Ask the portal for its price list.')).toBeInTheDocument();
  });

  it('MarketplaceEntryDrawer_NothingToSayForASection_SaysNotSpecifiedNeverInventsIt', async () => {
    hooks.entry.mockReturnValue(
      entryAnswer({
        ...DETAIL,
        whatItDoes: '',
        audience: '',
        activation: { type: 'api', requirements: [], needsOctoratePanel: false },
        dataShared: [],
        deactivation: { text: '', guided: false },
        faq: [],
      }),
    );
    renderDrawer();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('marketplace-detail-what')).toHaveTextContent('Non specificato');
    expect(within(dialog).getByTestId('marketplace-detail-audience')).toHaveTextContent('Non specificato');
    expect(within(dialog).getByTestId('marketplace-detail-requirements')).toHaveTextContent('Non sono indicati requisiti particolari.');
    // What data is shared is a privacy statement: when nobody wrote it, the card does not say that none is.
    expect(within(dialog).getByTestId('marketplace-detail-data')).toHaveTextContent('Non specificato');
    expect(within(dialog).getByTestId('marketplace-detail-deactivation')).toHaveTextContent('Non specificato');
    expect(within(dialog).queryByTestId('marketplace-detail-faq')).not.toBeInTheDocument();
  });

  it.each([
    ['api', 'Channel', 'PORTAL1', 'NotActive', 'Attiva', '/app/short-rent/marketplace/activate/channel/PORTAL1'],
    ['api', 'Tool', 'TOOL1', 'ToFix', 'Correggi', '/app/short-rent/marketplace/activate/tool/TOOL1'],
    ['licenseRequest', 'LicensedFunction', 'rms', 'NotActive', 'Attiva', '/app/short-rent/marketplace/request/rms'],
    ['partnerSite', 'Partner', 'test-cleaners', 'NotActive', 'Attiva', '/app/short-rent/marketplace/partners/test-cleaners/activate'],
    ['api', 'Channel', 'PORTAL1', 'Active', 'Gestisci', '/app/short-rent/marketplace/mine'],
    ['partnerSite', 'Partner', 'test-cleaners', 'Pending', 'Gestisci', '/app/short-rent/marketplace/mine'],
  ] as const)('MarketplaceEntryDrawer_Footer_%s_%s_%s_%s_Says_%s', async (type, kind, code, status, label, path) => {
    hooks.entry.mockReturnValue(entryAnswer({ ...DETAIL, kind, code, status, activation: { ...DETAIL.activation, type } }));
    renderDrawer(`/app/short-rent/marketplace?propertyId=prop-1&entry=${kind}:${code}`);

    const action = within(await screen.findByRole('dialog')).getByTestId('marketplace-entry-action');
    expect(action).toHaveTextContent(label);
    const url = new URL(action.getAttribute('href') ?? '', 'http://localhost');
    expect(url.pathname).toBe(path);
    expect(url.searchParams.get('propertyId')).toBe('prop-1');
  });

  it('MarketplaceEntryDrawer_WizardLink_BringsThePersonBackToThePageWithoutTheCard', async () => {
    renderDrawer();

    const action = within(await screen.findByRole('dialog')).getByTestId('marketplace-entry-action');
    const url = new URL(action.getAttribute('href') ?? '', 'http://localhost');
    expect(url.searchParams.get('returnTo')).toBe('/app/short-rent/marketplace?propertyId=prop-1');
  });

  it.each([
    ['octorate_not_connected', 'Per attivarla devi prima collegare il tuo channel manager.'],
    ['something_new', 'Al momento non si può attivare da qui.'],
    [null, 'Al momento non si può attivare da qui.'],
  ])('MarketplaceEntryDrawer_CannotBeActivated_%s_ShowsTheReasonInsteadOfTheButton', async (reason, text) => {
    hooks.entry.mockReturnValue(entryAnswer({ ...DETAIL, actions: { canActivate: false, reason } }));
    renderDrawer();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('marketplace-entry-reason')).toHaveTextContent(text);
    expect(within(dialog).queryByTestId('marketplace-entry-action')).not.toBeInTheDocument();
  });

  it('MarketplaceEntryDrawer_Loading_ShowsAPlaceholderUnderAGenericName', async () => {
    hooks.entry.mockReturnValue(entryAnswer(undefined, { isLoading: true }));
    renderDrawer();

    const dialog = await screen.findByRole('dialog', { name: 'Dettagli' });
    expect(within(dialog).getByText('Carico i dettagli…')).toBeInTheDocument();
    expect(within(dialog).queryByTestId('marketplace-entry-detail')).not.toBeInTheDocument();
  });

  it('MarketplaceEntryDrawer_Failed_SaysSoWithARetry', async () => {
    const refetch = vi.fn();
    hooks.entry.mockReturnValue(entryAnswer(undefined, { isError: true, error: new Error('boom'), refetch }));
    renderDrawer();

    const error = within(await screen.findByRole('dialog')).getByTestId('marketplace-entry-error');
    expect(error).toHaveTextContent('Non riesco a caricare i dettagli.');
    fireEvent.click(within(error).getByRole('button', { name: 'Riprova' }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('MarketplaceEntryDrawer_NotFound_SaysTheCardIsNotAvailableForYou', async () => {
    hooks.entry.mockReturnValue(entryAnswer(undefined, { isError: true, error: notFound() }));
    renderDrawer();

    const missing = within(await screen.findByRole('dialog')).getByTestId('marketplace-entry-not-found');
    expect(missing).toHaveTextContent('Scheda non disponibile');
    expect(missing).toHaveTextContent('Questa scheda non è disponibile per te.');
    expect(screen.queryByTestId('marketplace-entry-error')).not.toBeInTheDocument();
  });

  it('MarketplaceEntryDrawer_CloseButton_TakesTheParameterAwayAndKeepsTheOthers', async () => {
    renderDrawer('/app/short-rent/marketplace?propertyId=prop-1&q=abc&entry=Channel:PORTAL1');

    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Chiudi' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const params = new URLSearchParams(screen.getByTestId('where').textContent ?? '');
    expect(params.has('entry')).toBe(false);
    expect(params.get('propertyId')).toBe('prop-1');
    expect(params.get('q')).toBe('abc');
  });

  it('MarketplaceEntryDrawer_Escape_Closes', async () => {
    renderDrawer();

    fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(new URLSearchParams(screen.getByTestId('where').textContent ?? '').has('entry')).toBe(false);
  });

  it('MarketplaceEntryDrawer_NoEntryInTheAddress_DrawsNothingAndAsksForNothing', () => {
    renderDrawer('/app/short-rent/marketplace?propertyId=prop-1');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(hooks.entry).not.toHaveBeenCalled();
  });

  // The address is typed and shared, and its kind and code end up in the path of a request: nothing that could carry a path opens.
  it.each(['Channel:../../admin', 'Channel:a/b', 'Channel:', ':PORTAL1', 'Channel', 'Chan nel:PORTAL1', 'Channel:PORTAL1?x=1', 'Channel1:PORTAL1'])(
    'MarketplaceEntryDrawer_%j_IsNotAValidEntryAndOpensNothing',
    (value) => {
      renderDrawer(`/app/short-rent/marketplace?propertyId=prop-1&entry=${encodeURIComponent(value)}`);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(hooks.entry).not.toHaveBeenCalled();
    },
  );

  it('MarketplaceEntryDrawer_OpenedFromTheCard_TakesTheFocusAndGivesItBackToTheCardOnClose', async () => {
    renderDrawer(
      '/app/short-rent/marketplace?propertyId=prop-1',
      <ul>
        <MarketplaceEntryCard entry={CARD} propertyId="prop-1" />
      </ul>,
    );
    const details = screen.getByRole('button', { name: 'Dettagli di TEST Portal' });

    fireEvent.click(details);

    const dialog = await screen.findByRole('dialog', { name: 'TEST Portal' });
    expect(new URLSearchParams(screen.getByTestId('where').textContent ?? '').get('entry')).toBe('Channel:PORTAL1');
    // The focus is inside the drawer: a keyboard user starts reading it.
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(details));
  });

  it('MarketplaceEntryDrawer_Open_HasNoAccessibilityViolationsAxeCanFind', async () => {
    renderDrawer();

    await expectNoAxeViolations(await screen.findByRole('dialog'));
  });
});
