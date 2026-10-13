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

function render(page: SitePageId, legal: SiteLegal = LEGAL, lng: 'it' | 'en' = 'it'): string {
  return renderToString(<SiteApp page={page} i18n={createSiteI18n(lng)} legal={legal} year={2026} />);
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

  it('render_home_linksSignupWithUtmTheGuidesAndTheLogin', () => {
    const html = render('home');
    expect(html).toContain('href="/signup?utm_source=casazen-site&amp;utm_medium=cta&amp;utm_content=home-hero"');
    expect(html).toContain('href="/p/affitti-brevi"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/per-i-fornitori"');
  });

  it('render_suppliers_linksTheSupplierRegistration', () => {
    expect(render('suppliers')).toContain('href="/register"');
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
