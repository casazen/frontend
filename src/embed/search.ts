/**
 * `/embed/v1/search.js`: the native search bar of the hero area of an agency's website (NF-146). The loader (`embed.js`) fetches it, once, when a page has
 * a `[data-casazen-widget="search"]` element; it registers its function with `CasaZenEmbed.register('search', mount)` and the loader calls it with the
 * options of each element (`SearchOptions`). Built by `scripts/build-embed.mjs` as ONE file (an IIFE of at most 16 KB gzip), with no dependency and no
 * call to any server. The module has NO exports on purpose: an IIFE with exports would assign them to a global of its own name.
 *
 * The nonce of this script is the one the loader copied from its own: a page whose policy asks for nonces lets a `<style>` that carries it through, in the
 * browsers that have no constructable stylesheets (`search-styles.ts`).
 */

import type { WidgetMount } from './mount-widget';
import { createSearchForm } from './search-form';
import { installStyles } from './search-styles';

const script = document.currentScript as HTMLScriptElement | null;
const nonce = script?.nonce ?? '';
let bars = 0;

const mount: WidgetMount = (element, options) => {
  installStyles(element, nonce);
  bars += 1;
  element.textContent = '';
  element.appendChild(createSearchForm(options, `czs-${bars}`));
};

(window as Window & { CasaZenEmbed?: { register?: (name: string, fn: WidgetMount) => void } }).CasaZenEmbed?.register?.('search', mount);
