import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EMBED_EVENT_NAMES, EMBED_PROTOCOL_VERSION, EMBED_SOURCE, buildEmbedMessage, fitsEmbedEventParams, parseEmbedMessage, type EmbedMessage } from '../protocol';

/**
 * Protocol v1 between the page of an agency's website and the frame of a widget (E41/F01/US01/T02, NF-145). The parser is the only door a message
 * goes through: everything that acts on a message (the bridge of the frame, the loader of the page) reads what it returns. A message that is not
 * of the contract, or carries more than the contract says, must never get through.
 */
const CHECKOUT = 'https://prenota.quokka360.com/property/casa-mare/checkout?checkin=2026-12-01&checkout=2026-12-05&guests=2';

const VALID: EmbedMessage[] = [
  buildEmbedMessage('ready', { widget: 'booking' }),
  buildEmbedMessage('ready', { widget: 'guest-access' }),
  buildEmbedMessage('resize', { height: 420 }),
  buildEmbedMessage('resize', { height: 0 }),
  buildEmbedMessage('navigate', { url: CHECKOUT, target: 'top' }),
  buildEmbedMessage('navigate', { url: 'http://localhost:3000/my-bookings?code=ABCDE-FGHIJ', target: 'blank' }),
  buildEmbedMessage('event', { name: 'search', params: { search_term: 'Lugano', start_date: '2026-12-01' } }),
  buildEmbedMessage('event', { name: 'view_item_list', params: { item_list_id: 'search_results', items: [{ item_id: 'p1', item_name: 'Casa Mare', index: 0, price: 480.5, quantity: 1 }] } }),
  buildEmbedMessage('event', { name: 'view_item', params: {} }),
  buildEmbedMessage('event', { name: 'begin_checkout', params: { currency: 'CHF', value: 1200 } }),
  buildEmbedMessage('url', { path: '/property/casa-mare', query: 'checkin=2026-12-01&guests=2' }),
  buildEmbedMessage('url', { path: '/booking', query: '' }),
  buildEmbedMessage('error', { code: 'not_found' }),
  buildEmbedMessage('error', { code: 'bad_version' }),
  buildEmbedMessage('config', { theme: { primary: '#0a7d5a', radius: '12px', font: 'moderno' }, lang: 'en' }),
  buildEmbedMessage('config', { theme: {} }),
  buildEmbedMessage('config', {}),
];

describe('parseEmbedMessage: a valid message of each type (AC1)', () => {
  it.each(VALID.map((message) => [message.type, message] as const))('protocol_%s_parsesBackWhatTheBuilderWrote', (_type, message) => {
    expect(parseEmbedMessage(message)).toEqual(message);
  });

  it('protocol_TheSevenTypesAreAllThere', () => {
    expect(new Set(VALID.map((message) => message.type))).toEqual(new Set(['ready', 'resize', 'navigate', 'event', 'url', 'error', 'config']));
  });

  it('buildEmbedMessage_Always_SaysTheSourceAndTheVersion', () => {
    for (const message of VALID) {
      expect(message.source).toBe(EMBED_SOURCE);
      expect(message.source).toBe('casazen');
      expect(message.v).toBe(EMBED_PROTOCOL_VERSION);
      expect(message.v).toBe(1);
    }
  });

  it('buildEmbedMessage_OutputSurvivesTheStructuredCloneOfPostMessage', () => {
    // What the receiver gets is a copy: the parser must read the copy as it reads the original.
    for (const message of VALID) {
      expect(parseEmbedMessage(structuredClone(message))).toEqual(message);
    }
  });
});

describe('parseEmbedMessage: what is not a message of version 1 (AC1)', () => {
  const base = { source: 'casazen', v: 1 } as const;

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'casazen'],
    ['a number', 1],
    ['a list', [{ ...base, type: 'ready', widget: 'booking' }]],
    ['an object with nothing', {}],
    ['a wrong source', { source: 'other', v: 1, type: 'ready', widget: 'booking' }],
    ['a source in another case', { source: 'CasaZen', v: 1, type: 'ready', widget: 'booking' }],
    ['no source', { v: 1, type: 'ready', widget: 'booking' }],
    ['a wrong version', { source: 'casazen', v: 2, type: 'ready', widget: 'booking' }],
    ['a version written as text', { source: 'casazen', v: '1', type: 'ready', widget: 'booking' }],
    ['no version', { source: 'casazen', type: 'ready', widget: 'booking' }],
    ['an unknown type', { ...base, type: 'close' }],
    ['no type', { ...base }],
    ['a type that is not text', { ...base, type: 5 }],
    ['an object that is not plain', new Map([['source', 'casazen']])],
  ])('parseEmbedMessage_%s_IsNull', (_label, data) => {
    expect(parseEmbedMessage(data)).toBeNull();
  });

  it.each([
    ['not a number', 'tall'],
    ['not finite (Infinity)', Number.POSITIVE_INFINITY],
    ['not finite (NaN)', Number.NaN],
    ['negative', -1],
    ['missing', undefined],
  ])('parseEmbedMessage_ResizeHeight_%s_IsNull', (_label, height) => {
    expect(parseEmbedMessage({ ...base, type: 'resize', height })).toBeNull();
  });

  it('parseEmbedMessage_ResizeHeight_IsBroughtDownToTheLimit', () => {
    expect(parseEmbedMessage({ ...base, type: 'resize', height: 99999 })).toEqual({ ...base, type: 'resize', height: 50000 });
    expect(parseEmbedMessage({ ...base, type: 'resize', height: 50000 })).toEqual({ ...base, type: 'resize', height: 50000 });
  });

  it.each([
    ['a relative address', '/property/casa-mare/checkout'],
    ['a protocol-relative address', '//prenota.quokka360.com/x'],
    ['a script', 'javascript:alert(1)'],
    ['a data address', 'data:text/html,<p>x</p>'],
    ['another scheme', 'ftp://prenota.quokka360.com/x'],
    ['a blob', 'blob:https://prenota.quokka360.com/1234'],
    ['credentials in the address', 'https://user:pw@prenota.quokka360.com/x'],
    ['an address that is not one', 'not a url'],
    ['an empty address', ''],
    ['an address over 2048 characters', `https://prenota.quokka360.com/${'a'.repeat(2048)}`],
  ])('parseEmbedMessage_NavigateUrl_%s_IsNull', (_label, url) => {
    expect(parseEmbedMessage({ ...base, type: 'navigate', url, target: 'top' })).toBeNull();
  });

  it('parseEmbedMessage_NavigateUrl_OfExactly2048Characters_Passes', () => {
    const url = `https://prenota.quokka360.com/${'a'.repeat(2048 - 'https://prenota.quokka360.com/'.length)}`;

    expect(url).toHaveLength(2048);
    expect(parseEmbedMessage({ ...base, type: 'navigate', url, target: 'top' })).not.toBeNull();
  });

  it.each([['self'], ['_top'], ['TOP'], [''], [undefined], [1]])('parseEmbedMessage_NavigateTarget_%s_IsNull', (target) => {
    expect(parseEmbedMessage({ ...base, type: 'navigate', url: CHECKOUT, target })).toBeNull();
  });

  it.each([['page_view'], ['purchase'], ['Search'], [''], [undefined], [3]])('parseEmbedMessage_EventName_%s_IsNull', (name) => {
    // `purchase` is pushed by the pages of the site on its own domain, never by a frame.
    expect(parseEmbedMessage({ ...base, type: 'event', name, params: {} })).toBeNull();
  });

  it('parseEmbedMessage_EventNames_AreTheFourOfTheContract', () => {
    expect([...EMBED_EVENT_NAMES]).toEqual(['search', 'view_item_list', 'view_item', 'begin_checkout']);
  });

  it.each([
    ['text', 'items'],
    ['a number', 3],
    ['a list', [{ item_id: 'p1' }]],
    ['null', null],
    ['nothing', undefined],
    ['a boolean', true],
  ])('parseEmbedMessage_EventParams_%s_IsNull', (_label, params) => {
    expect(parseEmbedMessage({ ...base, type: 'event', name: 'view_item', params })).toBeNull();
  });

  it.each([
    ['url', { path: 'x'.repeat(1001), query: '' }],
    ['query', { path: '/booking', query: 'q='.padEnd(1001, 'x') }],
    ['a path that is not text', { path: 5, query: '' }],
    ['a query that is not text', { path: '/booking', query: null }],
    ['no query', { path: '/booking' }],
  ])('parseEmbedMessage_Url_%s_Wrong_IsNull', (_label, fields) => {
    expect(parseEmbedMessage({ ...base, type: 'url', ...fields })).toBeNull();
  });

  it('parseEmbedMessage_Url_OfExactly1000Characters_Passes', () => {
    expect(parseEmbedMessage({ ...base, type: 'url', path: 'x'.repeat(1000), query: 'y'.repeat(1000) })).not.toBeNull();
  });

  it.each([['Not Found'], ['not found'], [''], ['x'.repeat(33)], ['1abc'], ['not_found!'], [undefined], [404], [null]])('parseEmbedMessage_ErrorCode_%s_IsNull', (code) => {
    expect(parseEmbedMessage({ ...base, type: 'error', code })).toBeNull();
  });

  it.each([['Booking'], ['guest access'], [''], [undefined], [7]])('parseEmbedMessage_ReadyWidget_%s_IsNull', (widget) => {
    expect(parseEmbedMessage({ ...base, type: 'ready', widget })).toBeNull();
  });

  it.each([
    ['a theme that is text', { theme: 'red' }],
    ['a theme that is null', { theme: null }],
    ['a theme that is a list', { theme: ['red'] }],
    ['a language that is a number', { lang: 5 }],
    ['a language that is null', { lang: null }],
    ['a language that is too long', { lang: 'x'.repeat(17) }],
  ])('parseEmbedMessage_Config_%s_IsNull', (_label, fields) => {
    expect(parseEmbedMessage({ ...base, type: 'config', ...fields })).toBeNull();
  });
});

describe('parseEmbedMessage: the members of the contract and nothing else (AC1)', () => {
  const base = { source: 'casazen', v: 1 } as const;

  it('parseEmbedMessage_ExtraMembers_AreDropped', () => {
    const parsed = parseEmbedMessage({
      ...base,
      type: 'navigate',
      url: CHECKOUT,
      target: 'top',
      token: 'secret',
      email: 'guest@example.com',
      nested: { a: 1 },
    });

    expect(parsed).toEqual({ ...base, type: 'navigate', url: CHECKOUT, target: 'top' });
    expect(Object.keys(parsed ?? {}).sort()).toEqual(['source', 'target', 'type', 'url', 'v']);
  });

  it('parseEmbedMessage_Config_KeepsOnlyTheShortTextMembersOfTheTheme', () => {
    const parsed = parseEmbedMessage({
      ...base,
      type: 'config',
      theme: { primary: '#0a7d5a', radius: 12, font: 'moderno', extra: 'x', accent: '#fff', padding: '4px' },
      lang: 'en',
      other: true,
    });

    // A radius that is not text is not one; a member that is not in the contract is dropped; the valid ones stay.
    expect(parsed).toEqual({ ...base, type: 'config', theme: { primary: '#0a7d5a', font: 'moderno' }, lang: 'en' });
  });

  it('parseEmbedMessage_Config_DropsAThemeValueThatIsNotAShortText', () => {
    const parsed = parseEmbedMessage({ ...base, type: 'config', theme: { primary: 'x'.repeat(65), font: 'classico' } });

    expect(parsed).toEqual({ ...base, type: 'config', theme: { font: 'classico' } });
  });

  it('parseEmbedMessage_EventParams_AreACleanCopyOfTheJson', () => {
    const params = { item_list_id: 'search_results', items: [{ item_id: 'p1', hidden: undefined }], skipped: undefined };
    const parsed = parseEmbedMessage({ ...base, type: 'event', name: 'view_item_list', params });

    expect(parsed).toEqual({ ...base, type: 'event', name: 'view_item_list', params: { item_list_id: 'search_results', items: [{ item_id: 'p1' }] } });
    // A copy: the page cannot reach what the frame holds through it.
    expect((parsed as EmbedMessage<'event'>).params).not.toBe(params);
    expect('skipped' in (parsed as EmbedMessage<'event'>).params).toBe(false);
  });
});

describe('the params of an event are plain JSON of at most 4 KB (the proof of privacy)', () => {
  const base = { source: 'casazen', v: 1, type: 'event', name: 'view_item' } as const;

  class Guest {
    email = 'guest@example.com';
  }

  it.each([
    ['a map', new Map([['email', 'guest@example.com']])],
    ['a set', new Set(['guest@example.com'])],
    ['a date', new Date(0)],
    ['an instance of a class', new Guest()],
    ['a function', () => 'guest@example.com'],
    ['a regular expression', /guest/],
  ])('protocol_event_rejectsNonPlainParams_%s', (_label, params) => {
    expect(parseEmbedMessage({ ...base, params })).toBeNull();
  });

  it.each([
    ['a function inside', { item_id: 'p1', read: () => 1 }],
    ['a date inside', { item_id: 'p1', at: new Date(0) }],
    ['an instance inside', { item_id: 'p1', guest: new Guest() }],
    ['a symbol inside', { item_id: 'p1', mark: Symbol('x') }],
    ['a bigint inside', { item_id: 'p1', count: 10n }],
    ['NaN inside', { item_id: 'p1', price: Number.NaN }],
    ['Infinity inside', { item_id: 'p1', price: Number.POSITIVE_INFINITY }],
    ['undefined in a list', { items: [undefined] }],
  ])('protocol_event_rejectsNonPlainParams_%s', (_label, params) => {
    expect(parseEmbedMessage({ ...base, params })).toBeNull();
  });

  it('protocol_event_rejectsNonPlainParams_ThatLoopBackOnThemselves', () => {
    const params: Record<string, unknown> = { item_id: 'p1' };
    params.self = params;

    expect(parseEmbedMessage({ ...base, params })).toBeNull();
  });

  it('protocol_event_rejectsNonPlainParams_NestedTooDeep', () => {
    let params: Record<string, unknown> = { leaf: true };
    for (let level = 0; level < 10; level += 1) params = { inner: params };

    expect(parseEmbedMessage({ ...base, params })).toBeNull();
  });

  it('protocol_event_rejectsNonPlainParams_OfMoreThan4Kilobytes', () => {
    const fits = { note: 'x'.repeat(4096 - '{"note":""}'.length) };
    const tooBig = { note: 'x'.repeat(4096 - '{"note":""}'.length + 1) };

    expect(parseEmbedMessage({ ...base, params: fits })).not.toBeNull();
    expect(parseEmbedMessage({ ...base, params: tooBig })).toBeNull();
  });

  it('fitsEmbedEventParams_SaysWhatParseEmbedMessageWouldTake', () => {
    // For whoever builds the params (the GA4 builders): the same rule as the parser, in one place.
    const fits = { note: 'x'.repeat(4096 - '{"note":""}'.length) };
    const tooBig = { note: 'x'.repeat(4096 - '{"note":""}'.length + 1) };

    for (const [params, expected] of [[{}, true], [fits, true], [tooBig, false], [new Map(), false], [[{ item_id: 'p1' }], false], [null, false], ['text', false]] as const) {
      expect(fitsEmbedEventParams(params)).toBe(expected);
      expect(parseEmbedMessage({ ...base, params }) !== null).toBe(expected);
    }
  });

  it('protocol_event_CountsTheBytesOfTheTextNotItsCharacters', () => {
    // 1400 characters of three bytes each are 4200 bytes.
    expect(parseEmbedMessage({ ...base, params: { note: '€'.repeat(1400) } })).toBeNull();
    expect(parseEmbedMessage({ ...base, params: { note: '€'.repeat(1300) } })).not.toBeNull();
  });

  it('protocol_event_AcceptsTheFlatAndNestedShapesOfGa4', () => {
    const params = { currency: 'EUR', value: 1234.5, items: [{ item_id: 'p1', item_name: 'Casa Mare', index: 0, quantity: 1 }], flag: true, none: null };

    expect(parseEmbedMessage({ ...base, params })).toEqual({ ...base, params });
  });
});

describe('protocol.ts is the reference of the contract: pure TypeScript with no import from the app', () => {
  it('protocol_File_ImportsNothing', () => {
    // It ends up in the loader (a few kilobytes), in the plugin and in the acceptance test.
    const source = readFileSync(resolve(process.cwd(), 'src/embed/protocol.ts'), 'utf8');

    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/\brequire\(/);
    expect(source).not.toMatch(/\b(localStorage|sessionStorage|document\.cookie|indexedDB)\b/);
  });
});
