import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSiteI18n } from '../site-i18n';
import { SiteApp } from '../site-app';
import { SITE_PAGES, type SitePageId } from '../site-pages';
import type { SiteLegal } from '../site-config';

const LEGAL: SiteLegal = {
  name: 'Esempio S.r.l.',
  vatId: 'IT01234567890',
  address: 'Via Esempio 1, 22100 Como',
  email: 'info@example.com',
};

function render(page: SitePageId, legal: SiteLegal = LEGAL, lng: 'it' | 'en' = 'it', showLogin = true): string {
  return renderToString(<SiteApp page={page} i18n={createSiteI18n(lng)} legal={legal} year={2026} showLogin={showLogin} />);
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('public site render (SEO-VETRINA)', () => {
  it.each(SITE_PAGES.map((page) => page.id))('render_%s_hasOneH1AndNoMissingTranslation', (page) => {
    for (const lng of ['it', 'en'] as const) {
      const html = render(page, LEGAL, lng);
      expect(html.match(/<h1[\s>]/g), `${page} ${lng}`).toHaveLength(1);
      // i18next returns the key when a text is missing.
      expect(html, `${page} ${lng}`).not.toMatch(/site\.[a-z]+\.[A-Za-z]/);
    }
  });

  it.each(SITE_PAGES.map((page) => page.id))('render_%s_showsTheCompanyDataInTheFooter', (page) => {
    const html = render(page);
    expect(html).toContain('Esempio S.r.l.');
    expect(html).toContain('P.IVA IT01234567890');
    expect(html).toContain('Via Esempio 1, 22100 Como');
  });

  it('render_withoutCompanyData_leavesItOut', () => {
    const html = render('home', { name: null, vatId: null, address: null, email: null });
    expect(html).not.toContain('P.IVA');
    expect(html).toContain('© 2026 CasaZen');
  });

  it('render_home_offersTheSearchOfHomesAsANativeFormAndLinksItInHeaderAndFooter', () => {
    for (const lng of ['it', 'en'] as const) {
      const html = render('home', LEGAL, lng);
      // A form of the browser, with no script needed: GET /search with the fields the search of the app reads.
      expect(html, lng).toMatch(/<form[^>]*action="\/search"[^>]*method="get"|<form[^>]*method="get"[^>]*action="\/search"/);
      for (const name of ['where', 'checkin', 'checkout', 'guests']) expect(html, `${lng} ${name}`).toContain(`name="${name}"`);
      // The link of the header and the one of the footer (the form goes there with `action`, not `href`).
      expect(html.match(/href="\/search"/g), lng).toHaveLength(2);
    }
  });

  it.each(SITE_PAGES.filter((page) => page.id !== 'home').map((page) => page.id))('render_%s_linksTheSearchOfHomesInHeaderAndFooter', (page) => {
    expect(render(page).match(/href="\/search"/g)).toHaveLength(2);
  });

  it('render_home_linksTheGuidesTheLoginAndAnInvitationRequestByEmail', () => {
    const html = render('home');
    expect(html).toContain('href="/p/affitti-brevi"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/per-i-fornitori"');
    expect(html).toContain('href="mailto:info@example.com?subject=Richiesta%20di%20invito%20a%20CasaZen"');
    expect(html).toContain('Richiedi un invito');
  });

  it.each(SITE_PAGES.map((page) => page.id))('render_%s_onTheProductionSiteHasNoWayInToTheApp', (page) => {
    // Production: the app is reached by its address only (product owner, 2026-10-16); the invitation request stays.
    for (const lng of ['it', 'en'] as const) {
      const html = render(page, LEGAL, lng, false);
      expect(html, `${page} ${lng}`).not.toContain('href="/login"');
    }
    expect(render('home', LEGAL, 'it', false)).toContain('href="mailto:info@example.com');
  });

  it.each(SITE_PAGES.map((page) => page.id))('render_%s_hasNoSignupNoRegistrationAndNoPrices', (page) => {
    // CasaZen is on private invitation, with no prices or plans defined yet (product owner, 2026-10-13).
    for (const lng of ['it', 'en'] as const) {
      const html = render(page, LEGAL, lng);
      expect(html, `${page} ${lng}`).not.toMatch(/href="\/(signup|register)/);
      expect(html, `${page} ${lng}`).not.toMatch(/href="\/prezzi/);
      expect(html, `${page} ${lng}`).not.toMatch(/€|\bStarter\b|\bScale\b/);
    }
  });

  it('render_withoutAContactAddress_saysTheAccessIsByInvitationAndShowsNoMailto', () => {
    const html = render('home', { ...LEGAL, email: null });
    expect(html).not.toContain('mailto:');
    expect(html).toContain("l&#x27;accesso è solo su invito");
  });

  it('render_suppliers_offersAnInvitationNotARegistration', () => {
    const html = render('suppliers');
    expect(html).toContain('Richiedi un invito');
    expect(html).not.toContain('Registrati come fornitore');
  });

  it.each(SITE_PAGES.map((page) => page.id))('hydrate_%s_matchesTheStaticHtml', async (page) => {
    // The browser starts on the prerendered HTML: any difference would be a hydration error.
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = document.createElement('div');
    container.innerHTML = render(page);
    document.body.appendChild(container);

    const recoverable = vi.fn();
    await act(async () => {
      hydrateRoot(container, <SiteApp page={page} i18n={createSiteI18n('it')} legal={LEGAL} year={2026} />, {
        onRecoverableError: recoverable,
      });
    });

    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });
});
