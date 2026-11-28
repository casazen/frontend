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

export const EMBED_WIDGETS = ['booking', 'property', 'guest-access', 'search'] as const;
export type EmbedWidget = (typeof EMBED_WIDGETS)[number];

export const EMBED_LOADER_PATH = '/embed/v1/embed.js';

export interface EmbedDestination {
  id: string;
  label: string;
}

export interface EmbedBase {
  base: string;
  org: string | null;
}

export interface EmbedSnippetInput extends EmbedBase {
  widget: EmbedWidget;
  property?: string | null;
  target?: string | null;
  destinations?: readonly EmbedDestination[];
}

export type EmbedAttribute = readonly [name: string, value: string];

export function resolveEmbedBase(site: BookingSite): EmbedBase {
  return { base: new URL(site.baseUrl).origin, org: site.ownHost ? null : site.orgSlug };
}

const ATTRIBUTE_ENTITIES: Record<string, string> = { '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;' };

/** `value` as the text of an attribute of HTML: the ampersand, both quotes and the angle brackets become entities, so that no value can end its attribute or open a tag. */
export function escapeAttribute(value: string): string {
  return value.replace(/[&"'<>]/g, (character) => ATTRIBUTE_ENTITIES[character] ?? character);
}

const DESTINATION_ID = /^[A-Za-z0-9._~-]{1,100}$/;
const MAX_DESTINATIONS = 200;
const MAX_DESTINATION_LABEL_LENGTH = 80;

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

const PLUGIN_RELEASES = 'https://github.com/casazen/frontend/releases/download';

export type PluginChannel = 'main' | 'develop';

export function pluginChannel(deployEnv: unknown): PluginChannel {
  return deployEnv === 'production' ? 'main' : 'develop';
}

function httpsAddress(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function pluginDownloadUrl(override: unknown, deployEnv: unknown): string {
  return httpsAddress(override) ?? `${PLUGIN_RELEASES}/wp-plugin-${pluginChannel(deployEnv)}/casazen.zip`;
}
