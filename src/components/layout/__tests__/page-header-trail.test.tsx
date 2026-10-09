import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FilePlus2, Pencil, Trash2 } from 'lucide-react';
import i18n from '@/i18n/config';
import type { AppContextKey } from '@/config/route-manifest';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { rememberList } from '@/lib/list-return';
import { useUiStore } from '@/store/ui-store';
import { Button } from '@/components/ui/button';
import { AppShellContext } from '../app-shell-context';
import { PageHeader } from '../page-header';

/**
 * The head every page has before UI-05 (the one of the UI-04a CI fix, which makes it fit a phone), copied as it was: what the
 * 64 pages must keep rendering, to the last class.
 */
function HeadBeforeUi05({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 grow basis-56">
        <h1 className="break-words text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-2 break-words">{description}</p>
        )}
      </div>
      {action && <div className="min-w-0 max-w-full">{action}</div>}
    </div>
  );
}

function inShell(contextKey: AppContextKey, children: React.ReactNode, path = '/app/short-rent') {
  return (
    <MemoryRouter initialEntries={[path]}>
      <AppShellContext.Provider value={{ contextKey }}>{children}</AppShellContext.Provider>
    </MemoryRouter>
  );
}

const html = (ui: React.ReactElement) => render(ui).container.innerHTML;

describe('PageHeader without the props of UI-05 (the 64 pages that use it)', () => {
  beforeEach(async () => {
    document.title = 'CasaZen';
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    document.title = 'CasaZen';
  });

  // The shapes the pages use: a title alone, with its description, with an action that is one button, a row of buttons or a link.
  const SAMPLE: Array<[string, { title: string; description?: string; action?: () => React.ReactNode }]> = [
    ['title only', { title: 'Cruscotto' }],
    ['title and description', { title: 'Prenotazioni', description: 'Gestisci tutte le prenotazioni dei tuoi immobili' }],
    ['empty description', { title: 'Immobili', description: '' }],
    ['one button', { title: 'Contratti', description: 'I contratti di locazione', action: () => <Button>Nuovo contratto</Button> }],
    [
      'a row of buttons',
      {
        title: 'Prenotazione 1a2b3c4d',
        description: 'Mario Rossi',
        action: () => (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">Annulla</Button>
            <Button data-testid="edit-booking">Modifica</Button>
          </div>
        ),
      },
    ],
    ['a long title', { title: 'Un titolo molto lungo '.repeat(8), description: 'E una descrizione '.repeat(10) }],
  ];

  it.each(SAMPLE)('PageHeader_%s_RendersExactlyTheMarkupItAlwaysHad', (_name, props) => {
    const withAction = props.action ? { action: props.action() } : {};
    const before = html(<HeadBeforeUi05 title={props.title} description={props.description} {...withAction} />);
    cleanup();

    const now = html(<PageHeader title={props.title} description={props.description} {...withAction} />);

    expect(now).toBe(before);
  });

  it('PageHeader_WithoutTheNewProps_NeedsNoRouterAndDrawsNoTrail', () => {
    // Pages are rendered on their own in many tests: the head of a page that does not use the new props asks nothing of its surroundings.
    render(<PageHeader title="Prenotazioni" description="Tutte" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Prenotazioni' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByTestId('back-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('page-header-more')).not.toBeInTheDocument();
    expect(screen.queryByTestId('page-header-primary')).not.toBeInTheDocument();
  });

  it('PageHeader_EmptySecondaryList_IsStillTheHeadItAlwaysWas', () => {
    const before = html(<HeadBeforeUi05 title="Immobili" description="Elenco" />);
    cleanup();

    const now = html(<PageHeader title="Immobili" description="Elenco" secondary={[]} />);

    expect(now).toBe(before);
  });

  it('PageHeader_PageInAShell_SetsTheTitleOfTheTabAndGivesItBackWhenItLeaves', () => {
    const { unmount } = render(inShell('short-rent', <PageHeader title="Prenotazioni" />));
    expect(document.title).toBe('Prenotazioni · Affitti brevi · CasaZen');

    unmount();

    expect(document.title).toBe('CasaZen');
  });
});

describe('PageHeader with the trail (UI-05)', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    document.title = 'CasaZen';
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    document.title = 'CasaZen';
  });

  it('PageHeader_ExplicitCrumbs_ShowTheAreaFirstAndThePageLastAsTheCurrentOne', () => {
    render(
      inShell(
        'short-rent',
        <PageHeader
          title="Prenotazione 1a2b3c4d"
          crumbs={[{ label: 'Prenotazioni', to: '/app/short-rent/bookings' }, { label: '1a2b3c4d' }]}
        />,
      ),
    );

    const trail = screen.getByRole('navigation', { name: 'Percorso di navigazione' });
    expect(within(trail).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Affitti brevi', 'Prenotazioni', '1a2b3c4d']);
    expect(within(trail).getByRole('link', { name: 'Affitti brevi' })).toHaveAttribute('href', '/app/short-rent');
    expect(within(trail).getByRole('link', { name: 'Prenotazioni' })).toHaveAttribute('href', '/app/short-rent/bookings');
    // The page itself is not a link, and says it is the one that is open.
    expect(within(trail).queryByRole('link', { name: '1a2b3c4d' })).not.toBeInTheDocument();
    expect(within(trail).getByText('1a2b3c4d')).toHaveAttribute('aria-current', 'page');
    expect(trail).toHaveClass('hidden', 'md:block');
  });

  it('PageHeader_ExplicitCrumbs_GiveThePhoneALinkBackToThePageAbove', () => {
    render(
      inShell(
        'short-rent',
        <PageHeader title="Nuova prenotazione" crumbs={[{ label: 'Prenotazioni', to: '/app/short-rent/bookings' }, { label: 'Nuova' }]} />,
      ),
    );

    const back = screen.getByRole('link', { name: 'Torna a Prenotazioni' });
    expect(back).toHaveAttribute('href', '/app/short-rent/bookings');
    expect(back).toHaveClass('md:hidden');
  });

  it('PageHeader_OnlyTheAreaAbove_TheBackLinkLeadsToTheAreaHome', () => {
    render(inShell('long-rent', <PageHeader title="Profilo" crumbs={[{ label: 'Profilo' }]} />));

    expect(screen.getByRole('link', { name: 'Torna a Affitti lunghi' })).toHaveAttribute('href', '/app/long-rent/leases');
  });

  it('PageHeader_EmptyCrumbs_DrawNoTrailAndNoBackLink', () => {
    render(inShell('short-rent', <PageHeader title="Cruscotto" crumbs={[]} />));

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByTestId('back-link')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Cruscotto' })).toBeInTheDocument();
  });

  it('PageHeader_PageOutsideAShell_ShowsTheTrailWithoutAnArea', () => {
    render(
      <MemoryRouter>
        <PageHeader title="Dettaglio" crumbs={[{ label: 'Elenco', to: '/elenco' }, { label: 'Dettaglio' }]} />
      </MemoryRouter>,
    );

    const trail = screen.getByRole('navigation', { name: 'Percorso di navigazione' });
    expect(within(trail).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Elenco', 'Dettaglio']);
  });

  it('PageHeader_AutoCrumbs_ReadTheTrailFromTheManifest', () => {
    render(inShell('long-rent', <PageHeader title="Bilocale Monza" crumbs="auto" />, '/app/long-rent/properties/prop-1'));

    const trail = screen.getByRole('navigation', { name: 'Percorso di navigazione' });
    expect(within(trail).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Affitti lunghi', 'Immobili', 'Bilocale Monza']);
    expect(within(trail).getByRole('link', { name: 'Immobili' })).toHaveAttribute('href', '/app/long-rent/properties');
    expect(screen.getByRole('link', { name: 'Torna a Immobili' })).toBeInTheDocument();
  });

  it('PageHeader_AutoCrumbsOnAPageWithNothingAboveIt_DrawNothing', () => {
    render(inShell('short-rent', <PageHeader title="Prenotazioni" crumbs="auto" />, '/app/short-rent/bookings'));

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('PageHeader_AutoCrumbs_LeaveOutAPageTheUserMayNotOpen', () => {
    const workspace: WorkspaceContextValue = {
      contexts: [],
      activeContext: 'long-rent',
      isReady: true,
      setActiveContext: vi.fn(),
      hasPermission: (_context, permission) => permission !== 'property.read',
      getDefaultRoute: () => '/app/long-rent/leases',
    };
    render(
      <WorkspaceContext.Provider value={workspace}>
        {inShell('long-rent', <PageHeader title="Bilocale Monza" crumbs="auto" />, '/app/long-rent/properties/prop-1')}
      </WorkspaceContext.Provider>,
    );

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('PageHeader_ListLeftWithFilters_TheCrumbAndTheBackLinkLeadBackToItAsItWasLeft', () => {
    rememberList('/app/short-rent/bookings', '?status=Confirmed&q=rossi');
    render(
      inShell(
        'short-rent',
        <PageHeader title="Prenotazione" crumbs={[{ label: 'Prenotazioni', to: '/app/short-rent/bookings' }, { label: 'Prenotazione' }]} />,
      ),
    );

    const trail = screen.getByRole('navigation', { name: 'Percorso di navigazione' });
    expect(within(trail).getByRole('link', { name: 'Prenotazioni' })).toHaveAttribute('href', '/app/short-rent/bookings?status=Confirmed&q=rossi');
    expect(screen.getByRole('link', { name: 'Torna a Prenotazioni' })).toHaveAttribute('href', '/app/short-rent/bookings?status=Confirmed&q=rossi');
  });

  it('PageHeader_Title_IsTheOnlyH1AndSetsTheTitleOfTheTab', () => {
    render(inShell('short-rent', <PageHeader title="Prenotazione" crumbs={[{ label: 'Prenotazioni', to: '/x' }, { label: 'Prenotazione' }]} />));

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.title).toBe('Prenotazione · Affitti brevi · CasaZen');
  });
});

describe('PageHeader primary action (UI-05)', () => {
  beforeEach(async () => {
    useUiStore.setState({ bottomBarVisible: false, mobilePrimaryVisible: false });
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    useUiStore.setState({ bottomBarVisible: false, mobilePrimaryVisible: false });
  });

  it('PageHeader_PrimaryLink_IsALinkWithItsIconAndLabel', () => {
    render(
      inShell(
        'long-rent',
        <PageHeader title="Bilocale" primary={{ label: 'Nuovo contratto', icon: FilePlus2, to: '/app/long-rent/leases/new?propertyId=p-1', testId: 'new-lease' }} />,
      ),
    );

    const link = screen.getByRole('link', { name: 'Nuovo contratto' });
    expect(link).toHaveAttribute('href', '/app/long-rent/leases/new?propertyId=p-1');
    expect(link).toHaveAttribute('data-testid', 'new-lease');
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('PageHeader_PrimaryButton_DoesWhatItIsGivenAndCanBeDisabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(inShell('short-rent', <PageHeader title="Pagamento" primary={{ label: 'Salva', onClick }} />));

    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(inShell('short-rent', <PageHeader title="Pagamento" primary={{ label: 'Salva', onClick, disabled: true }} />));
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
  });

  it('PageHeader_PrimaryAction_IsASingleElementThatTheCssMovesToTheBottomOfThePhone', () => {
    render(inShell('short-rent', <PageHeader title="Pagamento" primary={{ label: 'Salva', onClick: vi.fn() }} />));

    // One copy only: keyboards, screen readers and tests see a single button, wherever the stylesheet puts it.
    expect(screen.getAllByRole('button', { name: 'Salva' })).toHaveLength(1);
    const wrapper = screen.getByTestId('page-header-primary');
    expect(wrapper).toHaveAttribute('data-mobile-primary', 'bar');
    expect(wrapper).toHaveClass('max-md:fixed', 'max-md:inset-x-0', 'max-md:bottom-(--primary-bottom)');
    // Fixed under the bottom bar's z-index and over the page, with the page showing through the strip around the button.
    expect(wrapper).toHaveClass('max-md:z-40', 'max-md:pointer-events-none');
    expect(screen.getByRole('button', { name: 'Salva' })).toHaveClass('max-md:pointer-events-auto', 'max-md:h-12', 'max-md:w-full');
  });

  it('PageHeader_PrimaryWithTheBottomBar_SitsAboveTheBar', () => {
    useUiStore.setState({ bottomBarVisible: true });
    render(inShell('short-rent', <PageHeader title="Pagamento" primary={{ label: 'Salva', onClick: vi.fn() }} />));

    expect(screen.getByTestId('page-header-primary').style.getPropertyValue('--primary-bottom')).toBe(
      'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px))',
    );
  });

  it('PageHeader_PrimaryWithoutTheBottomBar_SitsAtTheEdgeOfTheScreen', () => {
    render(inShell('short-rent', <PageHeader title="Pagamento" primary={{ label: 'Salva', onClick: vi.fn() }} />));

    expect(screen.getByTestId('page-header-primary').style.getPropertyValue('--primary-bottom')).toBe('env(safe-area-inset-bottom, 0px)');
  });

  it('PageHeader_MobilePrimaryFab_IsARoundButtonOnTheRight', () => {
    render(inShell('short-rent', <PageHeader title="Immobili" primary={{ label: 'Nuovo immobile', onClick: vi.fn() }} mobilePrimary="fab" />));

    const wrapper = screen.getByTestId('page-header-primary');
    expect(wrapper).toHaveAttribute('data-mobile-primary', 'fab');
    expect(wrapper).toHaveClass('max-md:fixed', 'max-md:right-4');
    expect(wrapper).not.toHaveClass('max-md:inset-x-0');
    expect(screen.getByRole('button', { name: 'Nuovo immobile' })).toHaveClass('max-md:rounded-full', 'max-md:h-14');
  });

  it('PageHeader_MobilePrimaryNone_LeavesTheActionNextToTheTitleOnAPhone', () => {
    render(inShell('short-rent', <PageHeader title="Immobili" primary={{ label: 'Nuovo immobile', onClick: vi.fn() }} mobilePrimary="none" />));

    const wrapper = screen.getByTestId('page-header-primary');
    expect(wrapper).toHaveAttribute('data-mobile-primary', 'none');
    expect(wrapper).not.toHaveClass('max-md:fixed');
    expect(wrapper.style.getPropertyValue('--primary-bottom')).toBe('');
    // Still a finger-sized button.
    expect(screen.getByRole('button', { name: 'Nuovo immobile' })).toHaveClass('max-md:min-h-11');
  });

  it('PageHeader_FixedPrimary_TellsTheShellAndTheToastsWhileItIsOnThePage', () => {
    const { unmount } = render(inShell('short-rent', <PageHeader title="Pagamento" primary={{ label: 'Salva', onClick: vi.fn() }} />));
    expect(useUiStore.getState().mobilePrimaryVisible).toBe(true);

    unmount();

    expect(useUiStore.getState().mobilePrimaryVisible).toBe(false);
  });

  it.each(['none'] as const)('PageHeader_PrimaryWithMobilePrimary_%s_DoesNotAskForRoomAtTheBottom', (mode) => {
    render(inShell('short-rent', <PageHeader title="Immobili" primary={{ label: 'Nuovo immobile', onClick: vi.fn() }} mobilePrimary={mode} />));

    expect(useUiStore.getState().mobilePrimaryVisible).toBe(false);
  });

  it('PageHeader_NoPrimary_AsksForNothing', () => {
    render(inShell('short-rent', <PageHeader title="Immobili" crumbs={[{ label: 'Immobili' }]} />));

    expect(useUiStore.getState().mobilePrimaryVisible).toBe(false);
    expect(screen.queryByTestId('page-header-primary')).not.toBeInTheDocument();
  });

  it('PageHeader_PrimaryAndTheOldAction_ShowBothInTheRowOfActions', () => {
    render(
      inShell('short-rent', <PageHeader title="Immobili" action={<span>azione libera</span>} primary={{ label: 'Nuovo', onClick: vi.fn() }} />),
    );

    expect(screen.getByText('azione libera')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuovo' })).toBeInTheDocument();
  });
});

describe('PageHeader secondary actions (UI-05)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  const openMenu = async () => {
    fireEvent.keyDown(screen.getByRole('button', { name: 'Altre azioni' }), { key: 'Enter' });
    return screen.findByRole('menu');
  };

  it('PageHeader_Secondary_AreInTheMenuOfTheThreeDotsAndNotOnThePage', async () => {
    render(
      inShell(
        'short-rent',
        <PageHeader
          title="Pagamento"
          secondary={[
            { label: 'Modifica', icon: Pencil, to: '/app/short-rent/payments/p-1/edit' },
            { separator: true },
            { label: 'Elimina', icon: Trash2, onClick: vi.fn(), danger: true },
          ]}
        />,
      ),
    );

    const trigger = screen.getByRole('button', { name: 'Altre azioni' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();

    const menu = await openMenu();

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Modifica', 'Elimina']);
    expect(within(menu).getByRole('separator')).toBeInTheDocument();
  });

  it('PageHeader_SecondaryLink_IsALinkThatCanBeOpenedInANewTab', async () => {
    render(inShell('short-rent', <PageHeader title="Pagamento" secondary={[{ label: 'Modifica', to: '/app/short-rent/payments/p-1/edit', testId: 'edit' }]} />));

    const menu = await openMenu();

    const item = within(menu).getByRole('menuitem', { name: 'Modifica' });
    expect(item.tagName).toBe('A');
    expect(item).toHaveAttribute('href', '/app/short-rent/payments/p-1/edit');
    expect(item).toHaveAttribute('data-testid', 'edit');
  });

  it('PageHeader_SecondaryButton_RunsItsActionAndClosesTheMenu', async () => {
    const onClick = vi.fn();
    render(inShell('short-rent', <PageHeader title="Pagamento" secondary={[{ label: 'Elimina', onClick, danger: true }]} />));
    const menu = await openMenu();

    const item = within(menu).getByRole('menuitem', { name: 'Elimina' });
    expect(item).toHaveClass('text-destructive');
    fireEvent.click(item);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('PageHeader_SecondaryDisabled_CannotBeTaken', async () => {
    const onClick = vi.fn();
    render(inShell('short-rent', <PageHeader title="Pagamento" secondary={[{ label: 'Elimina', onClick, disabled: true }]} />));
    const menu = await openMenu();

    const item = within(menu).getByRole('menuitem', { name: 'Elimina' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(item);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('PageHeader_MenuOpenedFromTheKeyboard_ArrowsMoveAndEscapeClosesItWithTheFocusBack', async () => {
    render(
      inShell(
        'short-rent',
        <PageHeader
          title="Pagamento"
          secondary={[
            { label: 'Modifica', onClick: vi.fn() },
            { label: 'Duplica', onClick: vi.fn() },
          ]}
        />,
      ),
    );
    const trigger = screen.getByRole('button', { name: 'Altre azioni' });
    act(() => trigger.focus());
    const menu = await openMenu();

    // Radix puts the focus on the menu, the arrow moves it to an item, Escape closes it and the focus returns to the button.
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    await waitFor(() => expect(within(menu).getByRole('menuitem', { name: 'Modifica' })).toHaveFocus());
    fireEvent.keyDown(within(menu).getByRole('menuitem', { name: 'Modifica' }), { key: 'ArrowDown' });
    await waitFor(() => expect(within(menu).getByRole('menuitem', { name: 'Duplica' })).toHaveFocus());
    fireEvent.keyDown(within(menu).getByRole('menuitem', { name: 'Duplica' }), { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    // Radix gives the focus back one tick after the menu is gone.
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('PageHeader_MenuButton_IsAtLeast44PixelsOnAPhone', () => {
    render(inShell('short-rent', <PageHeader title="Pagamento" secondary={[{ label: 'Modifica', onClick: vi.fn() }]} />));

    const trigger = screen.getByRole('button', { name: 'Altre azioni' });
    expect(trigger).toHaveClass('max-md:h-11', 'max-md:w-11');
    expect(trigger.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('PageHeader_EnglishUi_NamesTheMenuInEnglish', async () => {
    await i18n.changeLanguage('en');
    render(inShell('short-rent', <PageHeader title="Payment" secondary={[{ label: 'Edit', onClick: vi.fn() }]} />));

    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument();
  });
});
