import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse, type AtRule, type Root, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';
import { AA_TEXT_CONTRAST, contrastRatio } from '@/lib/public-site-colors';

/**
 * Tokens of the redesign (UI-01): `tokens.css` and `fonts.css`, parsed here as the browser reads them. Three things are
 * enforced, the same way `public-tokens.test.ts` does for the public site (that test, and that site, are not touched):
 *  1. Every pair of colors the redesign puts one on the other meets WCAG AA, in every area.
 *  2. Without `html[data-ui='v2']` nothing changes: the app is as it was before the redesign (decision 01-D8).
 *  3. The fonts are served by us, never by a third party (GDPR).
 */
const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');
const tokens = parse(read('src/styles/tokens.css'));
const fonts = parse(read('src/styles/fonts.css'));
const globals = parse(read('src/styles/globals.css'));

const GATE = "html[data-ui='v2']";
/** The one rule that uses the attribute inside `:where()`: it must stay below the specificity of a class. */
const NEUTRALIZER = "html:where([data-ui='v2']) *";

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

type Declarations = Record<string, string>;

function customProperties(node: Rule | AtRule): Declarations {
  const found: Declarations = {};
  for (const child of node.nodes ?? []) {
    if (child.type === 'decl' && child.prop.startsWith('--')) found[child.prop] = normalize(child.value);
  }
  return found;
}

/** Custom properties of the top-level rules whose selector list has `selector`. */
function ruleDeclarations(root: Root, selector: string): Declarations {
  const found: Declarations = {};
  for (const node of root.nodes) {
    if (node.type === 'rule' && node.selectors.map(normalize).includes(selector)) Object.assign(found, customProperties(node));
  }
  return found;
}

/** Custom properties of the top-level `@theme` blocks (`static` or not). */
function themeDeclarations(root: Root, params: 'static' | ''): Declarations {
  const found: Declarations = {};
  for (const node of root.nodes) {
    if (node.type === 'atrule' && node.name === 'theme' && normalize(node.params) === params) Object.assign(found, customProperties(node));
  }
  return found;
}

/** True when `rule` is nested in an at-rule whose text (`@media (pointer: coarse)`, `@layer base`) matches. */
function isInside(rule: Rule, atRule: RegExp): boolean {
  for (let parent: unknown = rule.parent; parent; parent = (parent as { parent?: unknown }).parent) {
    const node = parent as { type?: string; name?: string; params?: string };
    if (node.type === 'atrule' && atRule.test(`@${node.name} ${node.params}`)) return true;
  }
  return false;
}

/**
 * Declarations of the rules of `tokens.css` (anywhere, nested or not) with one selector of the list matching
 * `selector`, optionally only those inside an at-rule. `!important` is kept in the value.
 */
function declarationsOf(selector: string | RegExp, inside?: RegExp): Declarations {
  const found: Declarations = {};
  tokens.walkRules((rule) => {
    const matches = rule.selectors.map(normalize).some((candidate) => (typeof selector === 'string' ? candidate === selector : selector.test(candidate)));
    if (!matches || (inside && !isInside(rule, inside))) return;
    for (const child of rule.nodes ?? []) {
      if (child.type === 'decl') found[child.prop] = `${normalize(child.value)}${child.important ? ' !important' : ''}`;
    }
  });
  return found;
}

const primitives = ruleDeclarations(tokens, ':root');
const base = ruleDeclarations(tokens, GATE);
const additive = themeDeclarations(tokens, 'static');
const legacyTheme = themeDeclarations(globals, '');

/** Where a token is looked up for an area: the area block, the redesign block, the additive tokens, the primitives. */
function scopesOf(area: string | null): Declarations[] {
  return [area ? ruleDeclarations(tokens, `${GATE}[data-area='${area}']`) : {}, base, additive, primitives];
}

/** The hex color of `token` in an area, following the `var(--x)` aliases down to a primitive. */
function color(token: string, area: string | null = null): string {
  const scopes = scopesOf(area);
  const lookup = (name: string) => {
    for (const scope of scopes) if (name in scope) return scope[name];
    throw new Error(`${name} is not defined (area: ${area ?? 'none'})`);
  };
  let value = lookup(token);
  for (let depth = 0; depth < 8; depth += 1) {
    const alias = /^var\((--[\w-]+)\)$/.exec(value);
    if (!alias) break;
    value = lookup(alias[1]);
  }
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${token} does not resolve to a hex color: ${value}`);
  return value.toLowerCase();
}

const AREAS = ['short-rent', 'long-rent', 'supplier', 'admin', 'account'] as const;
/** `null` = no area: the brand ink of the login, the area picker and the onboarding. */
const ALL_ACCENTS: (string | null)[] = [null, ...AREAS];
const areaName = (area: string | null) => area ?? 'no area (ink)';

/** What the redesign shows text and fields on. */
const SURFACES = ['--color-background', '--color-card', '--color-muted', '--color-surface-2'] as const;

describe('tokens.css: accents', () => {
  it('Accent_PrimaryOfEachArea_IsTheDecidedOne', () => {
    // Decision D26 (wave spec) and the task: terracotta, Savoy blue, sage, amethyst; ink where there is no area.
    expect(color('--color-primary')).toBe('#1f3a3d');
    expect(color('--color-primary', 'short-rent')).toBe('#c2410c');
    expect(color('--color-primary', 'long-rent')).toBe('#2852c9');
    expect(color('--color-primary', 'supplier')).toBe('#0b7461');
    expect(color('--color-primary', 'admin')).toBe('#6a3fc7');
  });

  it('Accent_Account_SharesTheAdminBlock', () => {
    const account = ruleDeclarations(tokens, `${GATE}[data-area='account']`);
    expect(Object.keys(account).length).toBeGreaterThan(0);
    expect(account).toEqual(ruleDeclarations(tokens, `${GATE}[data-area='admin']`));
  });

  it('Accent_AreasDefineOnlyTheAccentTokens', () => {
    for (const area of AREAS) {
      expect(Object.keys(ruleDeclarations(tokens, `${GATE}[data-area='${area}']`)).sort(), area).toEqual([
        '--color-primary',
        '--color-primary-soft',
        '--color-primary-text',
      ]);
    }
  });

  it('Accent_FocusRing_IsFixedAndNeverFollowsTheArea', () => {
    for (const area of AREAS) expect(ruleDeclarations(tokens, `${GATE}[data-area='${area}']`)['--color-ring']).toBeUndefined();
    expect(color('--color-ring')).toBe('#2563eb');
  });

  it('Accent_EveryAreaHasItsOwnColor', () => {
    const primaries = ALL_ACCENTS.filter((area) => area !== 'account').map((area) => color('--color-primary', area));
    expect(new Set(primaries).size).toBe(primaries.length);
  });
});

describe('tokens.css: contrast (WCAG 2.1 AA)', () => {
  const text = (label: string, foreground: string, background: string, area: string | null = null) => {
    const ratio = contrastRatio(color(foreground, area), color(background, area));
    expect(ratio, `${label}: ${foreground} ${color(foreground, area)} on ${background} ${color(background, area)}`).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
  };
  /** 1.4.11: borders of fields, focus ring and the parts of a control that tell its state need 3:1. */
  const component = (label: string, foreground: string, background: string, area: string | null = null) => {
    const ratio = contrastRatio(color(foreground, area), color(background, area));
    expect(ratio, `${label}: ${foreground} ${color(foreground, area)} on ${background} ${color(background, area)}`).toBeGreaterThanOrEqual(3);
  };

  it.each(ALL_ACCENTS.map((area) => [areaName(area), area] as const))('Area_%s_TextOnAccentAndAccentText_MeetAA', (_name, area) => {
    text('text on the accent (primary button, active item)', '--color-primary-foreground', '--color-primary', area);
    text('accent text on its soft background (soft button, badge, current item)', '--color-primary-text', '--color-primary-soft', area);
    for (const surface of SURFACES) text('accent text on a surface (links)', '--color-primary-text', surface, area);
    // `text-primary` is used as text 62 times: fine on the page, the cards and the second surface. On `muted` terracotta
    // is 4.4:1: there, and for links, use `text-primary-text` (6:1 and more).
    for (const surface of ['--color-background', '--color-card', '--color-surface-2']) text('primary as text', '--color-primary', surface, area);
  });

  it.each(ALL_ACCENTS.map((area) => [areaName(area), area] as const))('Area_%s_AccentAsAControl_Meets3To1', (_name, area) => {
    for (const surface of ['--color-background', '--color-card']) component('accent fill / border', '--color-primary', surface, area);
  });

  it.each(SURFACES)('Surface_%s_TextAndFieldBorder_MeetAA', (surface) => {
    text('text', '--color-foreground', surface);
    text('muted text (was 4.4:1 on white and 3.9:1 on `muted`)', '--color-muted-foreground', surface);
    text('destructive as text (222 uses of `text-destructive`)', '--color-destructive', surface);
    component('border of fields and off track of switches', '--color-input', surface);
    component('focus ring', '--color-ring', surface);
  });

  it('Pairs_NamedForegrounds_MeetAAOnTheirBackground', () => {
    text('card', '--color-card-foreground', '--color-card');
    text('popover', '--color-popover-foreground', '--color-popover');
    text('secondary', '--color-secondary-foreground', '--color-secondary');
    text('accent (hover grey)', '--color-accent-foreground', '--color-accent');
    text('destructive button', '--color-destructive-foreground', '--color-destructive');
  });

  it.each(['success', 'warning', 'danger', 'info'])('Semantic_%s_TextMeetsAAOnItsSoftBackgroundAndOnTheSurfaces', (kind) => {
    text(`${kind} on its soft background (badge, alert)`, `--color-${kind}-foreground`, `--color-${kind}-soft`);
    for (const surface of SURFACES) text(`${kind} as text`, `--color-${kind}-foreground`, surface);
  });

  it.each(['success', 'danger', 'info'])('Semantic_%s_SolidIsAGraphicWith3To1', (kind) => {
    // The `warning` solid (2.7:1) is for dots and bars next to a label, as in the demo: it is not asserted as a graphic.
    component(`${kind} solid (icon, bar)`, `--color-${kind}`, '--color-background');
  });

  it.each(['success', 'warning'])('Badge_%s_IsDarkTextOnASoftBackground_NotWhiteOnA500Fill', (kind) => {
    // The Badge used white on green-500 / yellow-500 (2.2:1 and 1.9:1); under the redesign it uses these tokens.
    expect(contrastRatio(color(`--color-${kind}-foreground`), color(`--color-${kind}-soft`))).toBeGreaterThanOrEqual(6);
  });
});

describe('tokens.css: shape, motion, layers', () => {
  const px = (value: string) => Number.parseFloat(value.replace('px', ''));

  it('Radius_Scale_IsTheDemosAndKeepsIncreasing', () => {
    const names = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'];
    const values = names.map((name) => base[`--radius-${name}`]);
    expect(values.every((value) => /^\d+px$/.test(value ?? ''))).toBe(true);
    expect(values.slice(0, 6)).toEqual(['4px', '6px', '10px', '14px', '20px', '28px']);
    const numbers = values.map(px);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('Motion_DurationsAreTheDemosAndCollapseWithReducedMotion', () => {
    expect([primitives['--dur-fast'], primitives['--dur-base'], primitives['--dur-slow']]).toEqual(['120ms', '200ms', '320ms']);
    const reduced = tokens.nodes.find(
      (node): node is AtRule => node.type === 'atrule' && node.name === 'media' && /prefers-reduced-motion:\s*reduce/.test(node.params),
    );
    expect(reduced).toBeDefined();
    const collapsed: Declarations = {};
    reduced?.walkRules((rule) => Object.assign(collapsed, customProperties(rule)));
    expect(collapsed).toEqual({ '--dur-fast': '0ms', '--dur-base': '0ms', '--dur-slow': '0ms' });
  });

  it('Motion_TransitionDefaultsAndEasing_FollowTheTokens', () => {
    expect(base['--default-transition-duration']).toBe('var(--dur-fast)');
    expect(base['--default-transition-timing-function']).toBe('var(--ease-standard)');
    expect(additive['--ease-standard']).toBe('cubic-bezier(0.2, 0, 0, 1)');
  });

  it('Layers_ZScale_IsIncreasing', () => {
    const order = ['sticky', 'header', 'sidebar', 'bottom-nav', 'fab', 'drawer', 'modal', 'popover', 'tour', 'toast'];
    const values = order.map((name) => Number(primitives[`--z-${name}`]));
    expect(values.every((value) => Number.isFinite(value))).toBe(true);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(values).size).toBe(values.length);
  });

  it('Focus_Ring_IsAGlobalRuleOfTheRedesignUsingTheFixedRingToken', () => {
    expect(declarationsOf(`${GATE} :focus-visible`, /@layer base/)).toEqual({ outline: '2px solid var(--color-ring)', 'outline-offset': '2px' });
  });

  it('ReducedMotion_StopsAnimationsAndTransitions', () => {
    const declared = declarationsOf(`${GATE} *`, /prefers-reduced-motion/);
    expect(declared['animation-duration']).toBe('0.01ms !important');
    expect(declared['animation-iteration-count']).toBe('1 !important');
    expect(declared['transition-duration']).toBe('0.01ms !important');
    expect(declared['scroll-behavior']).toBe('auto !important');
  });

  it('Touch_CoarsePointer_FieldsGrowAndButtonsGetA44pxHitAreaWithoutMovingTheLayout', () => {
    expect(primitives['--touch-min']).toBe('44px');
    const coarse = /pointer:\s*coarse/;
    // Toggles are buttons too, and a 44 px slop on a 16 px checkbox covers the label and the next control.
    const hit = `${GATE} :is(button, [role='button'], summary):not([role='checkbox'], [role='switch'], [role='radio'])`;
    const hitArea = declarationsOf(`${hit}::after`, coarse);
    expect(hitArea.width).toBe('max(100%, var(--touch-min))');
    expect(hitArea.height).toBe('max(100%, var(--touch-min))');
    // The slop is under every visible control. z-index 0 (not the button's own stacking context) so a neighbor on
    // z-index 1 wins the tap; the gap, where nothing is drawn, still hits the slop.
    expect(hitArea['z-index']).toBe('0');
    expect(declarationsOf(`${hit}::before`, coarse)).toEqual({ content: "''", position: 'absolute', 'z-index': '1', inset: '0' });
    expect(declarationsOf(`${GATE} :is(a, label, input, select, textarea):not([role='button'])`, coarse)).toEqual({
      position: 'relative',
      'z-index': '1',
    });
    // The search glyph is an absolute sibling sitting in the field's padding: the field's layer must not cover it.
    expect(declarationsOf(`${GATE} :has(> :is(input, select, textarea)) > svg`, coarse)).toEqual({ 'z-index': '2' });
    // The hit area is a pseudo-element: no button gets taller, wider or moved, so a dense layout stays as it is.
    // No z-index on the button: that would trap ::after and the overflow would steal the tap again.
    expect(declarationsOf(hit, coarse)).toEqual({ position: 'relative' });
    // Fields do grow: a row of fields can take 4 px.
    expect(declarationsOf(/^html\[data-ui='v2'\] :is\( ?input:not/, coarse)).toEqual({ 'min-height': 'var(--touch-min)' });
  });

  it('Shadows_AreTintedWarm_ThroughTheTailwindShadowColor', () => {
    // Tailwind's shadow utilities read `--tw-shadow-color` and fall back to black: one declaration tints all of them.
    expect(declarationsOf(`${GATE} *`, /@layer base/)['--tw-shadow-color']).toBe('rgb(28 26 23 / 0.1)');
  });
});

/**
 * Decision D8: the app without `html[data-ui='v2']` is the app as it was. `public-tokens.css` and the public site are
 * not touched either: the attribute is never set there (`ui-version-sync.test.tsx`, `not-redesigned-routes.test.tsx`).
 */
describe('tokens.css and fonts.css: nothing changes without the redesign', () => {
  /** The `@theme` of `globals.css` before UI-01: the look of the app today. The redesign overrides these under the attribute. */
  const LEGACY_THEME: Declarations = {
    '--color-background': 'oklch(100% 0 0)',
    '--color-foreground': 'oklch(9% 0.035 285.8)',
    '--color-card': 'oklch(100% 0 0)',
    '--color-card-foreground': 'oklch(9% 0.035 285.8)',
    '--color-popover': 'oklch(100% 0 0)',
    '--color-popover-foreground': 'oklch(9% 0.035 285.8)',
    '--color-primary': 'oklch(52.1% 0.169 268.1)',
    '--color-primary-foreground': 'oklch(98% 0.008 286.2)',
    '--color-secondary': 'oklch(96.1% 0.008 286.2)',
    '--color-secondary-foreground': 'oklch(15.4% 0.028 285.8)',
    '--color-muted': 'oklch(96.1% 0.008 286.2)',
    '--color-muted-foreground': 'oklch(57.5% 0.016 286.1)',
    '--color-accent': 'oklch(96.1% 0.008 286.2)',
    '--color-accent-foreground': 'oklch(15.4% 0.028 285.8)',
    '--color-destructive': 'oklch(58% 0.203 29.2)',
    '--color-destructive-foreground': 'oklch(98% 0.008 286.2)',
    '--color-border': 'oklch(91.5% 0.01 286.1)',
    '--color-input': 'oklch(91.5% 0.01 286.1)',
    '--color-ring': 'oklch(52.1% 0.169 268.1)',
    '--radius': '0.5rem',
  };

  /** Tailwind's own tokens the redesign overrides (shape, motion, font), on top of the ones of `globals.css`. */
  const TAILWIND_TOKENS_OVERRIDDEN = [
    '--radius-xs',
    '--radius-sm',
    '--radius-md',
    '--radius-lg',
    '--radius-xl',
    '--radius-2xl',
    '--radius-3xl',
    '--radius-4xl',
    '--font-sans',
    '--default-transition-duration',
    '--default-transition-timing-function',
  ];
  const EXISTING_TOKENS = [...Object.keys(LEGACY_THEME), ...TAILWIND_TOKENS_OVERRIDDEN];

  it('GlobalsCss_Theme_IsStillTheCurrentLook', () => {
    expect(legacyTheme).toEqual(LEGACY_THEME);
  });

  it('GlobalsCss_BorderColorRule_IsStillThereForTheCurrentLook', () => {
    const rule = globals.nodes.find((node): node is Rule => node.type === 'rule' && normalize(node.selector) === '*');
    expect(rule?.nodes.map((node) => (node.type === 'decl' ? `${node.prop}: ${node.value}` : ''))).toEqual(['border-color: var(--color-border)']);
  });

  it('GlobalsCss_ImportsTheFontsAndTheTokensAfterTailwind', () => {
    const imports = globals.nodes.filter((node): node is AtRule => node.type === 'atrule' && node.name === 'import').map((node) => normalize(node.params));
    expect(imports).toEqual(['"tailwindcss"', '"./fonts.css"', '"./tokens.css"']);
  });

  it('Tokens_RedesignBlock_OverridesTheExistingTokens', () => {
    // The overrides exist (the test below would pass vacuously if the block were empty).
    for (const name of Object.keys(LEGACY_THEME).filter((token) => token !== '--radius')) expect(base[name], name).toBeDefined();
    for (const name of TAILWIND_TOKENS_OVERRIDDEN.filter((token) => token !== '--font-sans')) expect(base[name], name).toBeDefined();
    expect(ruleDeclarations(fonts, GATE)['--font-sans']).toBeDefined();
  });

  it('Tokens_OutsideTheAttribute_OnlyAddNamesNothingReadsYet', () => {
    const declared: string[] = [];
    for (const root of [tokens, fonts]) {
      root.walk((node) => {
        const outsideTheGate =
          (node.type === 'rule' && node.selectors.map(normalize).every((selector) => selector === ':root')) ||
          (node.type === 'atrule' && node.name === 'theme');
        if (outsideTheGate) declared.push(...Object.keys(customProperties(node as Rule | AtRule)));
      });
    }
    expect(declared.length).toBeGreaterThan(50);
    expect(declared.filter((name) => EXISTING_TOKENS.includes(name))).toEqual([]);
  });

  it('Tokens_EveryOtherRule_IsUnderTheAttribute', () => {
    let checked = 0;
    for (const root of [tokens, fonts]) {
      root.walkRules((rule) => {
        for (const selector of rule.selectors.map(normalize)) {
          if (selector === ':root') continue; // the primitives, covered by the previous test
          checked += 1;
          expect(selector.startsWith(GATE) || selector === NEUTRALIZER, `"${selector}" is not under ${GATE}`).toBe(true);
        }
      });
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('Tokens_AtRules_AreOnlyTheOnesThatDoNotStyleOnTheirOwn', () => {
    const names = new Set<string>();
    for (const root of [tokens, fonts]) root.walkAtRules((atRule) => void names.add(atRule.name));
    expect([...names].sort()).toEqual(['custom-variant', 'import', 'layer', 'media', 'theme']);
  });

  it('Variant_V2_IsTheAttribute', () => {
    const variant = tokens.nodes.find((node): node is AtRule => node.type === 'atrule' && node.name === 'custom-variant');
    expect(normalize(variant?.params ?? '')).toBe("v2 (html[data-ui='v2'] &)");
  });

  it('BorderColorNeutralizer_StaysBelowTheSpecificityOfAClass', () => {
    // `html:where([data-ui='v2']) *` is (0,0,1): above the `*` rule it switches off, below any class or attribute rule of a
    // third-party stylesheet (the calendar, the toasts), which keep their borders.
    const rule = tokens.nodes.find((node): node is Rule => node.type === 'rule' && normalize(node.selector) === NEUTRALIZER);
    expect(rule?.nodes.map((node) => (node.type === 'decl' ? `${node.prop}: ${node.value}` : ''))).toEqual(['border-color: revert-layer']);
    // The default color of a border returns in the base layer, where the utilities (`border-input`, `border-destructive`) win.
    expect(declarationsOf(`${GATE} *`, /@layer base/)['border-color']).toBe('var(--color-border)');
  });
});

describe('fonts.css: Inter served by us', () => {
  const publicFonts = read('src/styles/public-fonts.css');

  /** `@font-face` of `public-fonts.css`: family -> file (relative to `src/styles`). */
  function faces(): Map<string, string> {
    const declared = new Map<string, string>();
    for (const face of publicFonts.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const family = /font-family:\s*'([^']+)'/.exec(face[1])?.[1];
      const file = /url\('([^']+)'\)/.exec(face[1])?.[1];
      if (family && file) declared.set(family, file);
    }
    return declared;
  }

  it('Fonts_ImportTheFacesOfThePublicSite_DoNotDeclareThemAgain', () => {
    const imports = fonts.nodes.filter((node): node is AtRule => node.type === 'atrule' && node.name === 'import').map((node) => normalize(node.params));
    expect(imports).toEqual(["'./public-fonts.css'"]);
    expect(read('src/styles/fonts.css')).not.toMatch(/@font-face/);
  });

  it.each([
    ['--font-sans', ruleDeclarations(fonts, GATE)['--font-sans']],
    ['--font-display', themeDeclarations(fonts, 'static')['--font-display']],
  ])('Fonts_%s_FirstFamilyIsSelfHostedWithAnExistingFile', (_token, stack) => {
    const family = /^'([^']+)'/.exec(stack ?? '')?.[1];
    expect(family, stack).toBeDefined();
    const file = faces().get(family!);
    expect(file, `@font-face of ${family}`).toBeDefined();
    expect(existsSync(resolve(process.cwd(), 'src/styles', file!)), `${file} exists`).toBe(true);
  });

  it('Fonts_SansStack_StartsWithInterAndEndsWithAGenericFamily', () => {
    const stack = ruleDeclarations(fonts, GATE)['--font-sans'];
    expect(stack.startsWith("'Inter Variable', Inter, ")).toBe(true);
    expect(stack).toContain('system-ui');
    expect(stack.endsWith('sans-serif')).toBe(true);
  });

  it('Fonts_NoThirdPartyFontServer_IsReferenced', () => {
    const everything = [read('src/styles/fonts.css'), read('src/styles/tokens.css'), read('src/styles/globals.css'), read('index.html')].join('\n');
    expect(everything).not.toMatch(/fonts\.googleapis|fonts\.gstatic|typekit|use\.fontawesome|cdn\.|https?:\/\//i);
  });

  it('Fonts_Preload_IsTheFileOfTheInterFace', () => {
    const link = /<link\s+rel="preload"\s+href="([^"]+)"\s+as="font"\s+type="font\/woff2"\s+crossorigin\s*\/?>/.exec(read('index.html'));
    expect(link, 'a font preload with type and crossorigin in index.html').not.toBeNull();
    const href = link![1];
    expect(existsSync(resolve(process.cwd(), href.replace(/^\//, ''))), `${href} exists`).toBe(true);
    // The preloaded file is the one the `Inter Variable` face downloads, or it would be fetched twice.
    const face = faces().get('Inter Variable');
    expect(face).toBeDefined();
    expect(resolve(process.cwd(), 'src/styles', face!)).toBe(resolve(process.cwd(), href.replace(/^\//, '')));
  });
});
