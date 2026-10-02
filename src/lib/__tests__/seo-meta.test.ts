import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applySeoMeta, truncateDescription, useSeoMeta } from '../seo-meta';

function meta(selector: string): string | null {
  return document.head.querySelector(selector)?.getAttribute('content') ?? null;
}

function canonical(): string | null {
  return document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.title = 'CasaZen';
});

afterEach(() => {
  document.head.innerHTML = '';
});

describe('applySeoMeta (BK-15, A8-09)', () => {
  it('applySeoMeta_FullInput_WritesTitleDescriptionCanonicalOpenGraphAndTwitterTags', () => {
    applySeoMeta({
      title: 'Villa Rossi · Como — Rossi',
      description: 'Una villa sul lago.',
      canonicalUrl: 'https://public.example.test/book/rossi/property/villa',
      imageUrl: 'https://cdn.example.test/villa.jpg',
    });

    expect(document.title).toBe('Villa Rossi · Como — Rossi');
    expect(meta('meta[name="description"]')).toBe('Una villa sul lago.');
    expect(meta('meta[property="og:title"]')).toBe('Villa Rossi · Como — Rossi');
    expect(meta('meta[property="og:description"]')).toBe('Una villa sul lago.');
    expect(meta('meta[property="og:type"]')).toBe('website');
    expect(meta('meta[property="og:url"]')).toBe('https://public.example.test/book/rossi/property/villa');
    expect(meta('meta[property="og:image"]')).toBe('https://cdn.example.test/villa.jpg');
    expect(meta('meta[name="twitter:card"]')).toBe('summary_large_image');
    expect(meta('meta[name="twitter:title"]')).toBe('Villa Rossi · Como — Rossi');
    expect(canonical()).toBe('https://public.example.test/book/rossi/property/villa');
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('applySeoMeta_WithoutImage_UsesTheSmallTwitterCard', () => {
    applySeoMeta({ title: 'Guida' });

    expect(meta('meta[name="twitter:card"]')).toBe('summary');
    expect(document.head.querySelector('meta[property="og:image"]')).toBeNull();
  });

  it('applySeoMeta_Noindex_WritesRobotsNoindex', () => {
    applySeoMeta({ title: 'Pagina non trovata', noindex: true });

    expect(meta('meta[name="robots"]')).toBe('noindex,nofollow');
  });

  it('applySeoMeta_Restore_PutsBackTitleAndRemovesWhatItCreated', () => {
    const restore = applySeoMeta({ title: 'Guida', description: 'Testo', canonicalUrl: 'https://public.example.test/p', noindex: true });

    restore();

    expect(document.title).toBe('CasaZen');
    expect(document.head.querySelectorAll('meta, link')).toHaveLength(0);
  });

  it('applySeoMeta_Restore_PutsBackThePreviousValueOfExistingTags', () => {
    document.head.innerHTML =
      '<meta name="description" content="Predefinita"><link rel="canonical" href="https://public.example.test/old">';

    const restore = applySeoMeta({ title: 'Guida', description: 'Nuova', canonicalUrl: 'https://public.example.test/new' });
    expect(meta('meta[name="description"]')).toBe('Nuova');
    expect(canonical()).toBe('https://public.example.test/new');

    restore();

    expect(meta('meta[name="description"]')).toBe('Predefinita');
    expect(canonical()).toBe('https://public.example.test/old');
  });
});

describe('useSeoMeta', () => {
  it('useSeoMeta_Unmount_LeavesNoCanonicalOrNoindexOnTheNextPage', () => {
    const { unmount } = renderHook(() =>
      useSeoMeta({ title: 'Guida', canonicalUrl: 'https://public.example.test/p/guida', noindex: true }),
    );
    expect(canonical()).toBe('https://public.example.test/p/guida');

    unmount();

    expect(canonical()).toBeNull();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
    expect(document.title).toBe('CasaZen');
  });

  it('useSeoMeta_NullMeta_ChangesNothing', () => {
    renderHook(() => useSeoMeta(null));

    expect(document.title).toBe('CasaZen');
    expect(document.head.querySelectorAll('meta, link')).toHaveLength(0);
  });

  it('useSeoMeta_ChangedTitle_ReplacesThePreviousTagsWithoutDuplicates', () => {
    const { rerender } = renderHook(({ title }) => useSeoMeta({ title, description: `d ${title}` }), {
      initialProps: { title: 'Uno' },
    });
    rerender({ title: 'Due' });

    expect(document.title).toBe('Due');
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(meta('meta[name="description"]')).toBe('d Due');
  });
});

describe('truncateDescription (BK-15, spec AC13: the first 155 characters)', () => {
  it('truncateDescription_ShortText_IsReturnedOnOneLine', () => {
    expect(truncateDescription('  Una casa\n  sul lago. ')).toBe('Una casa sul lago.');
  });

  it('truncateDescription_LongText_IsCutAtAWordWithinTheLimitAndEndsWithAnEllipsis', () => {
    const text = Array.from({ length: 60 }, () => 'parola').join(' ');

    const truncated = truncateDescription(text);

    expect(truncated.length).toBeLessThanOrEqual(155);
    expect(truncated.endsWith('parola…')).toBe(true);
  });

  it.each([[null], [undefined], ['   ']])('truncateDescription_%s_IsEmpty', (value) => {
    expect(truncateDescription(value)).toBe('');
  });
});
