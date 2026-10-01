import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';
import i18n from '@/i18n/config';
import type { PublicOrgDto, PublicPropertyDetailDto } from '@/types';
import { classifyOrgSitePage, useOrgSeoMeta, usePropertySeoMeta } from '../use-org-seo-meta';

/** BK-15 (A3-20): title, description, canonical and noindex of the booking-site pages, for tabs and shared links. */
const ORG: PublicOrgDto = {
  slug: 'villa-rossi',
  displayName: 'Villa Rossi',
  logoUrl: 'https://cdn.example.test/logo.png',
  themeColor: null,
  contactEmail: null,
  tagline: 'Il tuo rifugio sul lago',
  canonicalUrl: 'https://public.example.test/book/villa-rossi',
};

const PROPERTY = {
  id: '0f6c1b2a-1111-2222-3333-444455556666',
  slug: 'casa-mare',
  name: 'Casa Mare',
  description: 'Una casa con vista sul mare, a due passi dalla spiaggia.',
  city: 'Rimini',
  photoUrls: ['/uploads/legacy.jpg', 'https://cdn.example.test/casa-1.jpg'],
  canonicalUrl: 'https://public.example.test/book/villa-rossi/property/casa-mare',
} as unknown as PublicPropertyDetailDto;

function wrapper({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

function meta(selector: string): string | null {
  return document.head.querySelector(selector)?.getAttribute('content') ?? null;
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  document.title = 'CasaZen';
  document.head.innerHTML = '';
});

afterEach(() => {
  document.head.innerHTML = '';
});

describe('classifyOrgSitePage', () => {
  it.each([
    ['/book/villa-rossi', 'landing'],
    ['/book/villa-rossi/', 'landing'],
    ['/book/villa-rossi/property/casa-mare', 'property'],
    ['/book/villa-rossi/property/casa-mare/checkout', 'other'],
    ['/book/villa-rossi/my-bookings', 'other'],
    ['/book/villa-rossi/booking/0f6c1b2a', 'other'],
    ['/book/villa-rossi/requests/0f6c1b2a/confirm', 'other'],
    ['/book/villa-rossi/casa-mare', 'other'],
  ])('classifyOrgSitePage_%s_is%s', (pathname, expected) => {
    expect(classifyOrgSitePage(pathname)).toBe(expected);
  });
});

describe('useOrgSeoMeta', () => {
  it('useOrgSeoMeta_LandingPage_WritesTitleDescriptionCanonicalAndLogoImage', () => {
    renderHook(() => useOrgSeoMeta(ORG, '/book/villa-rossi'), { wrapper });

    expect(document.title).toBe('Villa Rossi — Prenota direttamente');
    expect(meta('meta[name="description"]')).toBe('Il tuo rifugio sul lago');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://public.example.test/book/villa-rossi',
    );
    expect(meta('meta[property="og:image"]')).toBe('https://cdn.example.test/logo.png');
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('useOrgSeoMeta_EnglishLanguage_UsesTheEnglishTitle', async () => {
    await i18n.changeLanguage('en');

    renderHook(() => useOrgSeoMeta({ ...ORG, tagline: null }, '/book/villa-rossi'), { wrapper });

    expect(document.title).toBe('Villa Rossi — Book direct');
    expect(meta('meta[name="description"]')).toBe('Book direct with Villa Rossi.');
  });

  it.each(['/book/villa-rossi/my-bookings', '/book/villa-rossi/property/casa-mare/checkout', '/book/villa-rossi/booking/1'])(
    'useOrgSeoMeta_%s_IsNoindexAndHasNoCanonical',
    (pathname) => {
      renderHook(() => useOrgSeoMeta(ORG, pathname), { wrapper });

      expect(meta('meta[name="robots"]')).toBe('noindex,nofollow');
      expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    },
  );

  it('useOrgSeoMeta_PropertyPage_LeavesTheTagsToThePropertyPage', () => {
    renderHook(() => useOrgSeoMeta(ORG, '/book/villa-rossi/property/casa-mare'), { wrapper });

    expect(document.title).toBe('CasaZen');
    expect(document.head.children).toHaveLength(0);
  });

  it('useOrgSeoMeta_OrgStillLoading_ChangesNothing', () => {
    renderHook(() => useOrgSeoMeta(undefined, '/book/villa-rossi'), { wrapper });

    expect(document.title).toBe('CasaZen');
  });

  it('useOrgSeoMeta_ImageThatIsNotHttps_IsLeftOut', () => {
    renderHook(() => useOrgSeoMeta({ ...ORG, logoUrl: '/uploads/logo.png', heroImageUrl: 'http://cdn.example.test/hero.jpg' }, '/book/villa-rossi'), {
      wrapper,
    });

    expect(document.head.querySelector('meta[property="og:image"]')).toBeNull();
  });
});

describe('usePropertySeoMeta', () => {
  it('usePropertySeoMeta_LoadedProperty_WritesTheTitleOfSpecAc13AndTheCanonical', () => {
    renderHook(() => usePropertySeoMeta(ORG, PROPERTY), { wrapper });

    expect(document.title).toBe('Casa Mare · Rimini — Villa Rossi');
    expect(meta('meta[name="description"]')).toBe('Una casa con vista sul mare, a due passi dalla spiaggia.');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://public.example.test/book/villa-rossi/property/casa-mare',
    );
    // The first photo that is a usable https URL; the legacy relative path is skipped.
    expect(meta('meta[property="og:image"]')).toBe('https://cdn.example.test/casa-1.jpg');
  });

  it('usePropertySeoMeta_Unmount_RestoresThePreviousTitleAndRemovesTheCanonical', () => {
    const { unmount } = renderHook(() => usePropertySeoMeta(ORG, PROPERTY), { wrapper });

    unmount();

    expect(document.title).toBe('CasaZen');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it('usePropertySeoMeta_PropertyNotLoaded_ChangesNothing', () => {
    renderHook(() => usePropertySeoMeta(ORG, undefined), { wrapper });

    expect(document.title).toBe('CasaZen');
  });
});
