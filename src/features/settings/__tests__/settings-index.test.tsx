import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { buildDemoProfile } from '@/lib/demo-profile';
import { ORG_BILLING_ADMIN_PERMISSION } from '@/lib/org-billing-admin';
import { SettingsIndex } from '../settings-index';

vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));
const workspace = vi.hoisted(() => ({ hasPermission: vi.fn() }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: workspace.hasPermission }) }));

const EMBED_PATH = '/app/short-rent/settings/embed';

const administrator = () => true;
const notAdministrator = (_context: string, permission: string) => permission !== ORG_BILLING_ADMIN_PERMISSION;

function commercialProfile(addons: string[]) {
  return { ...buildDemoProfile('short-stay'), commercialSignup: { profile: 'owner' as const, planTier: 'Pro' as const, rooms: 1, addons }, commercialEnabledAddons: addons };
}

function renderIndex({ siteEmbed, addons }: { siteEmbed: boolean; addons?: string[] }) {
  const client = new QueryClient();
  if (addons) client.setQueryData(['me'], commercialProfile(addons));
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, siteEmbed }, isLoading: false }}>
          <MemoryRouter initialEntries={['/app/short-rent/settings']}>
            <SettingsIndex />
          </MemoryRouter>
        </FeatureFlagsContext.Provider>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

const labelOf = (key: string) => i18n.t(key);
const embedLink = () => screen.queryByRole('link', { name: labelOf('nav.embed') });
const websiteLinks = () => within(screen.getByRole('region', { name: labelOf('nav.settingsGroups.website') })).getAllByRole('link').map((link) => link.textContent);

describe('SettingsIndex: the page «Incorpora nel tuo sito» (E41/F03/US01)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    workspace.hasPermission.mockReset().mockImplementation(administrator);
  });

  afterEach(() => {
    cleanup();
  });

  it('settingsIndex_SiteEmbedOnAndAdministrator_LinksTheEmbedPageRightAfterTheDomain', () => {
    renderIndex({ siteEmbed: true });

    expect(embedLink()).toHaveAttribute('href', EMBED_PATH);
    expect(websiteLinks()).toEqual([labelOf('nav.siteAppearance'), labelOf('nav.domain'), labelOf('nav.embed'), labelOf('nav.siteDocuments')]);
  });

  it('settingsIndex_SiteEmbedOff_HasNoLinkToTheEmbedPage_AndTheOtherPagesStay', () => {
    renderIndex({ siteEmbed: false });

    expect(embedLink()).not.toBeInTheDocument();
    expect(websiteLinks()).toEqual([labelOf('nav.siteAppearance'), labelOf('nav.domain'), labelOf('nav.siteDocuments')]);
  });

  it('settingsIndex_NotTheAdministrator_HasNoLinkToTheEmbedPage', () => {
    workspace.hasPermission.mockImplementation(notAdministrator);
    renderIndex({ siteEmbed: true });

    expect(embedLink()).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: labelOf('nav.domain') })).toBeInTheDocument();
  });

  it('settingsIndex_CommercialAccountWithoutTheBookingSiteModule_HasNoLinkToTheEmbedPage_LikeTheOtherPagesOfTheSite', () => {
    renderIndex({ siteEmbed: true, addons: ['channels'] });

    expect(embedLink()).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: labelOf('nav.domain') })).not.toBeInTheDocument();
  });

  it('settingsIndex_CommercialAccountWithTheBookingSiteModule_LinksTheEmbedPage', () => {
    renderIndex({ siteEmbed: true, addons: ['direct-booking'] });

    expect(embedLink()).toHaveAttribute('href', EMBED_PATH);
    expect(screen.getByRole('link', { name: labelOf('nav.domain') })).toBeInTheDocument();
  });
});
