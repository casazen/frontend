import { describe, expect, it } from 'vitest';
import type { BookingSite } from '@/lib/booking-link';
import {
  EMBED_LOADER_PATH,
  buildEmbedMountOptions,
  buildEmbedSnippet,
  embedAttributes,
  escapeAttribute,
  pluginDownloadUrl,
  publicDestinations,
  readSearchTarget,
  resolveEmbedBase,
  type EmbedSnippetInput,
} from '../embed-snippet';

const OWN: BookingSite = { orgSlug: 'villa-rossi', baseUrl: 'https://prenota.agenzia.test', ownHost: true };
const PLATFORM: BookingSite = { orgSlug: 'villa-rossi', baseUrl: 'https://sito.test/book/villa-rossi', ownHost: false };

const BOOKING: EmbedSnippetInput = { widget: 'booking', base: 'https://prenota.agenzia.test', org: null };

/** The element of the snippet as the loader reads it: its `data-casazen-*` attributes, by the name of the option. */
function attributesOf(snippet: string): Record<string, string> {
  const page = document.createElement('div');
  page.innerHTML = snippet;
  const element = page.querySelector('[data-casazen-widget]');
  if (!element) throw new Error('no widget element in the snippet');
  return Object.fromEntries(
    Array.from(element.attributes)
      .filter((attribute) => attribute.name.startsWith('data-casazen-'))
      .map((attribute) => [attribute.name.slice('data-casazen-'.length), attribute.value]),
  );
}

describe('buildEmbedSnippet (E41/F03/US01, NF-147)', () => {
  it('embedSnippet_AgencyOwnDomain_NamesItsOriginAndNoOrg', () => {
    const snippet = buildEmbedSnippet({ ...BOOKING, ...resolveEmbedBase(OWN) });

    expect(snippet).toContain(`<script src="https://prenota.agenzia.test${EMBED_LOADER_PATH}" async></script>`);
    expect(attributesOf(snippet)).toEqual({ widget: 'booking', base: 'https://prenota.agenzia.test', lang: 'auto' });
    expect(snippet).not.toContain('data-casazen-org');
  });

  it('embedSnippet_CasazenDomain_NamesTheOriginOfCasazenAndTheSlugOfTheOrg', () => {
    const snippet = buildEmbedSnippet({ ...BOOKING, ...resolveEmbedBase(PLATFORM) });

    // The origin only: the `/book/<slug>` of the platform path is not part of where the loader and the frames live.
    expect(snippet).toContain(`<script src="https://sito.test${EMBED_LOADER_PATH}" async></script>`);
    expect(attributesOf(snippet)).toEqual({ widget: 'booking', base: 'https://sito.test', org: 'villa-rossi', lang: 'auto' });
  });

  it.each([
    ['booking', {}, { widget: 'booking' }],
    ['guest-access', {}, { widget: 'guest-access' }],
    ['property', { property: 'casa-mare' }, { widget: 'property', property: 'casa-mare' }],
    [
      'search',
      { target: 'https://www.agenzia.test/prenota', destinations: [{ id: 'lugano', label: 'Lugano' }] },
      { widget: 'search', target: 'https://www.agenzia.test/prenota', destinations: JSON.stringify([{ id: 'lugano', label: 'Lugano' }]) },
    ],
  ] as const)('embedSnippet_Widget_%s_WritesWhatItNeedsAndNothingElse', (widget, extra, expected) => {
    const snippet = buildEmbedSnippet({ ...BOOKING, widget, ...extra });

    expect(attributesOf(snippet)).toEqual({ base: 'https://prenota.agenzia.test', lang: 'auto', ...expected });
  });

  it('embedSnippet_AttributesOfAnotherWidget_AreLeftOut', () => {
    // A property or a target typed for another widget never leaks into the code of this one.
    const snippet = buildEmbedSnippet({ ...BOOKING, widget: 'booking', property: 'casa-mare', target: 'https://www.agenzia.test/x', destinations: [{ id: 'a', label: 'A' }] });

    expect(attributesOf(snippet)).toEqual({ widget: 'booking', base: 'https://prenota.agenzia.test', lang: 'auto' });
  });

  it('embedSnippet_escapesAttributeValues', () => {
    const hostile = `x" onload="alert(1)' <script>&amp;</script>`;
    const snippet = buildEmbedSnippet({
      widget: 'search',
      base: 'https://prenota.agenzia.test',
      org: hostile,
      target: `https://www.agenzia.test/p?a=1&b="2"&c=<i>`,
      destinations: [{ id: 'lugano', label: `L"ug'ano <b>&` }],
    });

    // No value ends its attribute or opens a tag: the only `<` of the code are the ones of its own two tags (`<script>` and `<div>` with their closing tags).
    const [scriptTag, rest] = snippet.split('</script>\n');
    expect(scriptTag).toBe('<script src="https://prenota.agenzia.test/embed/v1/embed.js" async>');
    expect(rest?.match(/</g)).toHaveLength(2);
    expect(snippet).toContain('data-casazen-org="x&quot; onload=&quot;alert(1)&#39; &lt;script&gt;&amp;amp;&lt;/script&gt;"');
    expect(snippet).toContain('&lt;i&gt;');

    // What the browser reads back is exactly what was written: the page that holds the code gets the values, not a second element or a second attribute.
    const attributes = attributesOf(snippet);
    expect(attributes.org).toBe(hostile);
    expect(Object.keys(attributes).sort()).toEqual(['base', 'destinations', 'lang', 'org', 'target', 'widget']);
    expect(JSON.parse(attributes.destinations ?? '[]')).toEqual([{ id: 'lugano', label: `L"ug'ano <b>&` }]);
  });

  it.each([
    ['&', '&amp;'],
    ['"', '&quot;'],
    ["'", '&#39;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
  ])('embedSnippet_escapeAttribute_%s_Becomes_%s', (raw, escaped) => {
    expect(escapeAttribute(`a${raw}b`)).toBe(`a${escaped}b`);
  });

  it('embedSnippet_containsOnlyPublicValues', () => {
    // Whatever else the caller holds (an id, an e-mail, a token, the settings of the domain) is not read: only the members named in the input go in.
    const input = {
      ...BOOKING,
      widget: 'property',
      property: 'casa-mare',
      orgId: 'c0ffee00-0000-4000-8000-000000000001',
      ownerEmail: 'mario.rossi@example.test',
      token: 'gs1.secret-token',
      gtmContainerId: 'GTM-ABC123',
      surfaces: { ownerLoginHostState: 'Ready' },
    } as EmbedSnippetInput;

    const snippet = buildEmbedSnippet(input);
    const options = buildEmbedMountOptions(input);

    for (const private_ of ['c0ffee00', 'mario.rossi', 'secret-token', 'GTM-ABC123', 'ownerLoginHostState']) {
      expect(snippet).not.toContain(private_);
      expect(JSON.stringify(options)).not.toContain(private_);
    }
    expect(attributesOf(snippet)).toEqual({ widget: 'property', base: 'https://prenota.agenzia.test', lang: 'auto', property: 'casa-mare' });
  });
});

describe('buildEmbedMountOptions: the preview is what the snippet produces', () => {
  it.each([
    ['booking', {}],
    ['guest-access', {}],
    ['property', { property: 'casa-mare' }],
    ['search', { target: 'https://www.agenzia.test/prenota', destinations: [{ id: 'lugano', label: 'Lugano' }, { id: 'locarno', label: 'Locarno' }] }],
  ] as const)('mountOptions_Widget_%s_AreTheAttributesOfTheSnippet', (widget, extra) => {
    const input: EmbedSnippetInput = { ...BOOKING, ...resolveEmbedBase(PLATFORM), widget, ...extra };

    // Only the search bar is a preview (it never leaves the console); the rest are the values a pasted snippet gives the loader.
    const { preview, ...options } = buildEmbedMountOptions(input);
    expect(options).toEqual(attributesOf(buildEmbedSnippet(input)));
    expect(preview).toBe(widget === 'search' ? true : undefined);
  });

  it('mountOptions_AreTheListOfTheAttributes', () => {
    expect(Object.fromEntries(embedAttributes({ ...BOOKING, org: 'villa-rossi' }))).toEqual({ widget: 'booking', base: 'https://prenota.agenzia.test', org: 'villa-rossi', lang: 'auto' });
  });
});

describe('resolveEmbedBase', () => {
  it('resolveEmbedBase_OwnHost_IsItsOriginWithNoOrg', () => {
    expect(resolveEmbedBase({ ...OWN, baseUrl: 'https://prenota.agenzia.test/' })).toEqual({ base: 'https://prenota.agenzia.test', org: null });
  });

  it('resolveEmbedBase_Platform_IsTheOriginAndTheSlug', () => {
    expect(resolveEmbedBase(PLATFORM)).toEqual({ base: 'https://sito.test', org: 'villa-rossi' });
  });
});

describe('readSearchTarget', () => {
  it('readSearchTarget_Nothing_IsEmpty', () => {
    expect(readSearchTarget('   ')).toEqual({ state: 'empty' });
  });

  it.each(['https://www.agenzia.test/prenota', '  http://agenzia.test/book?lang=it#top  '])('readSearchTarget_WebAddress_%s_IsValid', (raw) => {
    expect(readSearchTarget(raw)).toEqual({ state: 'valid', url: new URL(raw.trim()).href });
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://agenzia.test/x',
    '//agenzia.test/prenota',
    '/prenota',
    'www.agenzia.test/prenota',
    'https://user:secret@agenzia.test/prenota',
    'https://',
    'not an address',
    `https://agenzia.test/${'a'.repeat(2100)}`,
  ])('readSearchTarget_NotAnAddressOfTheWeb_%s_IsInvalid', (raw) => {
    expect(readSearchTarget(raw)).toEqual({ state: 'invalid' });
  });

  it('readSearchTarget_CharactersThatDoNotBelong_AreEscapedByTheBrowserNotCopied', () => {
    const read = readSearchTarget('https://agenzia.test/p?x="><script>');

    expect(read.state).toBe('valid');
    expect(read.state === 'valid' ? read.url : '').not.toMatch(/[<>"]/);
  });
});

describe('publicDestinations', () => {
  it('publicDestinations_KeepsWhatTheBarReads_AndDropsTheRest', () => {
    const places = publicDestinations([
      { id: 'lugano', label: '  Lugano   Centro ' },
      { id: 'lugano', label: 'Duplicato' },
      { id: 'con spazio', label: 'Id non valido' },
      { id: 'locarno', label: '' },
      { id: 'ascona', label: 'x'.repeat(81) },
      { id: 'melide', label: 'Melide' },
    ]);

    expect(places).toEqual([
      { id: 'lugano', label: 'Lugano Centro' },
      { id: 'melide', label: 'Melide' },
    ]);
  });

  it('publicDestinations_NoMoreThanTheBarTakes', () => {
    const many = Array.from({ length: 250 }, (_, index) => ({ id: `p${index}`, label: `Posto ${index}` }));

    expect(publicDestinations(many)).toHaveLength(200);
  });
});

describe('pluginDownloadUrl', () => {
  it.each([undefined, null, '', '   ', 42, 'not an address', 'http://agenzia.test/casazen.zip', 'ftp://agenzia.test/casazen.zip', 'https://user:pw@agenzia.test/casazen.zip', 'javascript:alert(1)'])(
    'pluginDownloadUrl_%s_IsNoLink',
    (raw) => {
      expect(pluginDownloadUrl(raw)).toBeNull();
    },
  );

  it('pluginDownloadUrl_AddressOnHttps_IsTheLink', () => {
    expect(pluginDownloadUrl(' https://downloads.agenzia.test/casazen-1.0.0.zip ')).toBe('https://downloads.agenzia.test/casazen-1.0.0.zip');
  });
});
