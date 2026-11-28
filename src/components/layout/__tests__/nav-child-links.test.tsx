import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { ROUTE_MANIFEST } from '@/config/route-manifest';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { NavChildLinks } from '../nav-child-links';

function renderLinks(parentPath: string, hasPermission: WorkspaceContextValue['hasPermission'] = () => true) {
  const workspace: WorkspaceContextValue = {
    contexts: [],
    activeContext: null,
    isReady: true,
    setActiveContext: vi.fn(),
    hasPermission,
    getDefaultRoute: () => '/app',
  };
  return render(
    <WorkspaceContext.Provider value={workspace}>
      <MemoryRouter>
        <NavChildLinks parentPath={parentPath} />
      </MemoryRouter>
    </WorkspaceContext.Provider>,
  );
}

describe('NavChildLinks (UI-04a)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('NavChildLinks_PageWithChildren_LinksToEachOfThemByItsMenuName', () => {
    renderLinks('/app/short-rent/compliance');

    const group = screen.getByRole('group', { name: 'Pagine collegate' });
    const links = within(group).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Alloggiati', '/app/short-rent/alloggiati'],
      ['Report Alloggiati', '/app/short-rent/alloggiati/reports'],
      ['CIN', '/app/short-rent/compliance/cin'],
      ['Identificazione', '/app/short-rent/compliance/identification'],
    ]);
  });

  it('NavChildLinks_EnglishUi_UsesTheEnglishNames', async () => {
    await i18n.changeLanguage('en');
    renderLinks('/app/admin/cin');

    expect(screen.getByRole('group', { name: 'Related pages' })).toBeInTheDocument();
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Tourist Tax', 'LTR reference data', 'ISTAT regions']);
  });

  it('NavChildLinks_UserWhoMayOpenOnlySomeChildren_ListsOnlyThose', () => {
    renderLinks('/app/short-rent/compliance', (_ctx, permission) => permission !== 'booking.read');

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['CIN', 'Identificazione']);
  });

  it('NavChildLinks_UserWhoMayOpenNone_ShowsNothing', () => {
    const { container } = renderLinks('/app/short-rent/approval-queue', (_ctx, permission) => permission !== 'verification.decision');

    expect(container).toBeEmptyDOMElement();
  });

  it('NavChildLinks_PageWithoutChildren_ShowsNothing', () => {
    const { container } = renderLinks('/app/short-rent/marketplace');

    expect(container).toBeEmptyDOMElement();
  });

  it('NavChildLinks_NoWorkspace_ListsEveryChildOfThePage', () => {
    render(
      <MemoryRouter>
        <NavChildLinks parentPath="/app/short-rent/compliance" />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Alloggiati',
      'Report Alloggiati',
      'CIN',
      'Identificazione',
    ]);
  });

  it('NavChildLinks_NoRouter_ShowsNothingAndDoesNotFail', () => {
    const { container } = render(<NavChildLinks parentPath="/app/short-rent/compliance" />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('pages that hang from a menu entry link to their children', () => {
  const sources = import.meta.glob<string>(['/src/**/*.tsx', '!/src/**/*.test.tsx', '!/src/**/__tests__/**'], {
    query: '?raw',
    import: 'default',
    eager: true,
  });
  const parents = [
    ...new Set(
      ROUTE_MANIFEST.filter((entry) => entry.navParent && entry.context === 'supplier').map((entry) => entry.navParent as string),
    ),
  ];

  it('has at least one parent', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100);
    expect(parents.length).toBeGreaterThanOrEqual(2);
  });

  it.each(parents)('%s renders NavChildLinks', (parent) => {
    const files = Object.entries(sources)
      .filter(([, source]) => source.includes(`<NavChildLinks parentPath="${parent}"`))
      .map(([file]) => file);
    expect(files.length, `no page renders <NavChildLinks parentPath="${parent}" />`).toBeGreaterThanOrEqual(1);
  });
});
