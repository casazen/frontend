import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The sticky header has one height for the whole app (UI-05): `--header-height` in `globals.css`. It was "4rem" written in the
 * header, in the shell (the scroll padding), in the full-height page of the booking site editor and as `top-20` of a sticky
 * preview; whoever changes the header now changes one line, and these places follow.
 */
const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

// Every source of the app (tests excluded), to look for a height that is written out again.
const SOURCES = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}', '!/src/**/__tests__/**', '!/src/test/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('the height of the header', () => {
  it('HeaderHeight_GlobalsCss_SaysItOnce', () => {
    const css = read('src/styles/globals.css');

    expect(css.match(/--header-height\s*:/g)).toHaveLength(1);
    expect(css).toMatch(/--header-height:\s*4rem;/);
  });

  it('HeaderHeight_Header_TakesItFromTheVariable', () => {
    const source = read('src/components/layout/header.tsx');

    expect(source).toContain('h-[var(--header-height)]');
    expect(source).not.toMatch(/\bh-16\b/);
  });

  it('HeaderHeight_Shell_KeepsAnchorsAndFocusClearOfTheHeaderWithTheVariable', () => {
    const source = read('src/components/layout/app-shell-layout.tsx');

    expect(source).toContain("HEADER_HEIGHT = 'var(--header-height)'");
    expect(source).not.toContain("'4rem'");
  });

  it('HeaderHeight_FullHeightPageOfTheBookingSiteEditor_SubtractsTheVariable', () => {
    const source = read('src/features/settings/vetrina-page.tsx');

    expect(source).toContain('100svh-var(--header-height)');
    expect(source).toContain('100svh-var(--header-height)-var(--bottom-nav-height)');
    expect(source).not.toContain('4rem');
  });

  it('HeaderHeight_StickyPreviewOfTheSiteAppearance_SticksBelowTheHeaderWithTheVariable', () => {
    const source = read('src/features/settings/site-appearance/site-appearance-page.tsx');

    expect(source).toContain('lg:top-[calc(var(--header-height)+1rem)]');
    expect(source).not.toContain('lg:top-20');
  });

  it('HeaderHeight_AnySource_DoesNotSubtractAHeaderOfFourRemFromTheScreen', () => {
    const offenders = Object.entries(SOURCES)
      .filter(([, source]) => /(?:100d?[sl]?vh|100%)\s*-\s*4rem/.test(source))
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  });
});
