import type { BookingSite } from '@/lib/booking-link';

/**
 * The code an agency pastes into its own website to show a CasaZen widget (E41/F03/US01, NF-147), and the same widget as the options of the loader
 * (`CasaZenEmbed.mount(element, options)`), so that what the preview of the console shows is what the pasted code produces: both come from ONE list of
 * attributes (`embedAttributes`), whose names are the options of the loader (`data-casazen-<name>` is the attribute of the option `<name>`).
 *
 * Pure: nothing is read from the page and nothing is stored. Only PUBLIC values go in: the address of the site, the slug of the org and of a home, the address of
 * the page of the agency that holds the booking engine, the places of the site. Whoever calls it chooses what to pass, and nothing else of the settings of the agency
 * (no id, no e-mail, no token) can get in, because the functions read only the members named in `EmbedSnippetInput`. Every value is escaped as the text of an
 * attribute, whatever it holds.
 */

/** The widgets of the loader (`§6` of the site integration analysis): the booking engine, one home, the entry of the guest area and the search bar. */
export const EMBED_WIDGETS = ['booking', 'property', 'guest-access', 'search'] as const;
export type EmbedWidget = (typeof EMBED_WIDGETS)[number];

/** Where the loader is served from, under the address of the site: the version is part of the path, and a change that breaks the contract is another one. */
export const EMBED_LOADER_PATH = '/embed/v1/embed.js';

/** A place the search bar offers: the same shape the bar reads (`data-casazen-destinations`, the JSON of `[{ id, label }]`). */
export interface EmbedDestination {
  id: string;
  label: string;
}

/** Where the widgets and the loader come from. */
export interface EmbedBase {
  /** The origin: the agency's own domain when it has one that is served, else the one of CasaZen. */
  base: string;
  /** The slug of the org, only on the CasaZen domain (`data-casazen-org`); `null` on the agency's own domain, which knows who it is. */
  org: string | null;
}

export interface EmbedSnippetInput extends EmbedBase {
  widget: EmbedWidget;
  /** The slug of the home of the `property` widget. */
  property?: string | null;
  /** The address of the page of the agency that holds the booking engine, for the `search` bar (already read by `readSearchTarget`). */
  target?: string | null;
  /** The places of the site for the `search` bar. */
  destinations?: readonly EmbedDestination[];
}

/** The name of an option of the loader and its value as text. */
export type EmbedAttribute = readonly [name: string, value: string];

/**
 * The origin the code is served from, and whether it needs the slug of the org: on the agency's own host (a verified custom domain or a CasaZen subdomain: the
 * origin of `site`) the host is enough, on the platform the origin of CasaZen and the slug of the org say who the widget is for.
 */
export function resolveEmbedBase(site: BookingSite): EmbedBase {
  return { base: new URL(site.baseUrl).origin, org: site.ownHost ? null : site.orgSlug };
}

const ATTRIBUTE_ENTITIES: Record<string, string> = { '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;' };

/** `value` as the text of an attribute of HTML: the ampersand, both quotes and the angle brackets become entities, so that no value can end its attribute or open a tag. */
export function escapeAttribute(value: string): string {
  return value.replace(/[&"'<>]/g, (character) => ATTRIBUTE_ENTITIES[character] ?? character);
}

// The rules of the search bar for the places it takes (`src/embed/search-form.ts`, `parseDestinations`): the file of the bar runs in the page of another website and takes
// nothing from the app, so they are written here again; an entry the bar would drop is not put in the code.
const DESTINATION_ID = /^[A-Za-z0-9._~-]{1,100}$/;
const MAX_DESTINATIONS = 200;
const MAX_DESTINATION_LABEL_LENGTH = 80;

/** The places the bar can use: at most 200, an id of the characters of a slug, a label of 1 to 80 characters (spaces collapsed), no id twice. The rest is left out. */
export function publicDestinations(list: readonly EmbedDestination[]): EmbedDestination[] {
  const seen = new Set<string>();
  const kept: EmbedDestination[] = [];
  for (const item of list) {
    if (kept.length >= MAX_DESTINATIONS) break;
    const label = item.label.replace(/\s+/g, ' ').trim();
    if (!DESTINATION_ID.test(item.id) || seen.has(item.id) || label === '' || label.length > MAX_DESTINATION_LABEL_LENGTH) continue;
    seen.add(item.id);
    kept.push({ id: item.id, label });
  }
  return kept;
}

/** What the person typed as the page that holds the booking engine: nothing yet, something that is not an address of the web, or the address. */
export type SearchTarget = { state: 'empty' } | { state: 'invalid' } | { state: 'valid'; url: string };

const MAX_TARGET_LENGTH = 2048;

/**
 * The page the search bar leads to, as the person typed it: an absolute address of the web (`http` or `https`, with a host and no user name or password), written back as the
 * browser reads it (a character that does not belong in an address is escaped). A script, a `data:` address, text that is not an address and an address that carries a
 * credential are `invalid`; the bar would refuse them too (`resolveTarget`).
 */
export function readSearchTarget(raw: string): SearchTarget {
  const text = raw.trim();
  if (text === '') return { state: 'empty' };
  if (text.length > MAX_TARGET_LENGTH) return { state: 'invalid' };
  try {
    const url = new URL(text);
    const web = url.protocol === 'https:' || url.protocol === 'http:';
    return web && url.hostname !== '' && !url.username && !url.password ? { state: 'valid', url: url.href } : { state: 'invalid' };
  } catch {
    return { state: 'invalid' };
  }
}

/**
 * The attributes of the widget, in the order they are written: which widget, where it comes from, the language (`auto`: the one of the page that holds it) and what the
 * widget needs (the slug of the home, the page and the places of the bar). A value that is missing is left out, never written empty.
 */
export function embedAttributes(input: EmbedSnippetInput): EmbedAttribute[] {
  const attributes: EmbedAttribute[] = [
    ['widget', input.widget],
    ['base', input.base],
  ];
  if (input.org) attributes.push(['org', input.org]);
  attributes.push(['lang', 'auto']);
  if (input.widget === 'property' && input.property) attributes.push(['property', input.property]);
  if (input.widget === 'search') {
    if (input.target) attributes.push(['target', input.target]);
    const destinations = publicDestinations(input.destinations ?? []);
    if (destinations.length > 0) attributes.push(['destinations', JSON.stringify(destinations)]);
  }
  return attributes;
}

/**
 * The code to paste: the line that loads the loader (`async`, once per page whatever the number of widgets) and the element the loader fills. One attribute per line, so
 * that it reads well in a box and in a page builder.
 */
export function buildEmbedSnippet(input: EmbedSnippetInput): string {
  const script = `<script src="${escapeAttribute(`${input.base}${EMBED_LOADER_PATH}`)}" async></script>`;
  const attributes = embedAttributes(input)
    .map(([name, value]) => `  data-casazen-${name}="${escapeAttribute(value)}"`)
    .join('\n');
  return `${script}\n<div\n${attributes}\n></div>`;
}

/**
 * The options of `CasaZenEmbed.mount(element, options)` for the preview of the console: the same values as the attributes of the code, as text (the loader reads them as it
 * reads the attributes). The search bar is a preview (`preview: true`): it checks the stay and reports it but never leaves the page, so the console is not taken away; the
 * widgets in a frame have no such switch.
 */
export function buildEmbedMountOptions(input: EmbedSnippetInput): Record<string, string | boolean> {
  const options: Record<string, string | boolean> = Object.fromEntries(embedAttributes(input));
  if (input.widget === 'search') options.preview = true;
  return options;
}

/**
 * The address the plugin can be downloaded from (`VITE_WORDPRESS_PLUGIN_URL`: the ZIP of the latest release), or `null` while it is not set or is not an address on `https`
 * (no default in code: the link is simply not shown).
 */
export function pluginDownloadUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
