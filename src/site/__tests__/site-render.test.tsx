import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SEO_FEATURED_GUIDES, SEO_FEATURED_TAX_PAGES } from '@/features/public-seo/seo-paths';
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
      expect(html, lng).toMatch(/<form[^>]*action="\/search"[^>]*method="get"|<form[^>]*method="get"[^>]*action="\/search"/);
      for (const name of ['where', 'checkin', 'checkout', 'guests']) expect(html, `${lng} ${name}`).toContain(`name="${name}"`);
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

  it('render_home_linksTheGuidesAndTheTaxPageOfTheComuniPeopleSearchFor', () => {
    for (const [lng, guide, tax] of [
      ['it', 'Affitti brevi a Como', 'Tassa di soggiorno a Como'],
      ['en', 'Short-term rentals in Como', 'Tourist tax in Como'],
    ] as const) {
      const html = render('home', LEGAL, lng);
      expect(html, lng).toContain(`<a href="/p/affitti-brevi/lombardia/como"`);
      expect(html, lng).toContain(guide);
      expect(html, lng).toContain('AI Agents');
      expect(html, lng).toContain(`<a href="/p/tassa-soggiorno/como"`);
      expect(html, lng).toContain(tax);
      for (const page of SEO_FEATURED_GUIDES) expect(html, `${lng} ${page.path}`).toContain(`href="${page.path}"`);
    }
  });

  it('seoFeaturedPages_arePathsOfTheHubOfTheGuidesAndOfTheTaxPages', () => {
    for (const page of SEO_FEATURED_GUIDES) expect(page.path).toMatch(/^\/p\/affitti-brevi\/[a-z-]+\/[a-z-]+$/);
    for (const page of SEO_FEATURED_TAX_PAGES) expect(page.path).toMatch(/^\/p\/tassa-soggiorno\/[a-z-]+$/);
    const paths = [...SEO_FEATURED_GUIDES, ...SEO_FEATURED_TAX_PAGES].map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it.each(SITE_PAGES.map((page) => page.id))('render_%s_onTheProductionSiteHasNoWayInToTheApp', (page) => {
    for (const lng of ['it', 'en'] as const) {
      const html = render(page, LEGAL, lng, false);
      expect(html, `${page} ${lng}`).not.toContain('href="/login"');
    }
    expect(render('home', LEGAL, 'it', false)).toContain('href="mailto:info@example.com');
  });

  it.each(SITE_PAGES.map((page) => page.id))('render_%s_hasNoSignupNoRegistrationAndNoPrices', (page) => {
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

  it('opens independent, read-only rental examples from the normal public build', () => {
    const home = render('home');
    expect(home).toContain('href="/affitti-brevi#demo"');
    expect(home).toContain('href="/affitti-lunghi#demo"');
    for (const [page, detail, expectedFigures] of [
      ['shortRent', 'Piet Jansen', ['2', '2']],
      ['longRent', 'Casa dei Tigli', ['850 EUR', '0']],
    ] as const) {
      const doc = new DOMParser().parseFromString(render(page), 'text/html');
      const sample = doc.querySelector('#demo details');
      const figures = Array.from(doc.querySelectorAll('#demo > div dl dd'), value => value.textContent?.replace(/\s+/g, ' '));
      expect(figures).toEqual(expectedFigures);
      expect(sample?.querySelectorAll('time[datetime]')).toHaveLength(2);
      expect(sample?.querySelector('summary')?.textContent).toContain(detail);
      expect(sample?.querySelector('a')?.getAttribute('href')).toMatch(/^mailto:info@example.com/);
      expect(sample?.querySelector('a[href^="/app/"]')).toBeNull();
    }
  });

  it('offers a referral draft and an existing invitation without collecting or forwarding an invitation in a query', () => {
    const doc = new DOMParser().parseFromString(render('shortRent', { ...LEGAL, email: null }), 'text/html');
    const sample = doc.querySelector('#demo details');
    expect(sample?.querySelector('a')?.getAttribute('href')).toMatch(/^mailto:\?subject=/);
    const input = sample?.querySelector('input[type=url]');
    expect(input).toBeTruthy();
    expect(input?.hasAttribute('name')).toBe(false);
  });

  it('render_suppliers_offersAnInvitationNotARegistration', () => {
    const html = render('suppliers');
    expect(html).toContain('Richiedi un invito');
    expect(html).not.toContain('Registrati come fornitore');
  });

  it.each(SITE_PAGES.map((page) => page.id))('hydrate_%s_matchesTheStaticHtml', async (page) => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = document.createElement('div');
    container.innerHTML = render(page);
    document.body.appendChild(container);

    const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    const recoverable = vi.fn();
    try {
      await act(async () => {
        hydrateRoot(container, <SiteApp page={page} i18n={createSiteI18n('it')} legal={LEGAL} year={2026} />, {
          onRecoverableError: recoverable,
        });
      });
    } finally {
      actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    }

    expect(recoverable).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });
});
