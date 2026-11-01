import DOMPurify, { type Config, type DOMPurify as DOMPurifyInstance } from 'dompurify';

/**
 * Allowlist sanitizer for editorial HTML (A8-08, A9-29). Every `dangerouslySetInnerHTML`
 * must go through `sanitizeHtml`. Mirrors the backend `SeoHtmlSanitizer` (HtmlSanitizer):
 * keep the two allowlists aligned.
 */
export const SANITIZE_ALLOWED_TAGS = [
  'p',
  'br',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'a',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
] as const;

/** Forced on every link, whatever the source HTML says. */
export const SANITIZE_LINK_REL = 'noopener noreferrer';

/** Only absolute http, https and mailto links: relative and any other scheme lose their href. */
const ALLOWED_URI = /^(?:https?|mailto):/i;

const CONFIG: Config = {
  ALLOWED_TAGS: [...SANITIZE_ALLOWED_TAGS],
  ALLOWED_ATTR: ['href'],
  ALLOWED_URI_REGEXP: ALLOWED_URI,
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  // Disallowed elements are unwrapped (text stays readable); these are dropped with their
  // content, on top of DOMPurify's defaults (script, style, iframe, svg, math, template, ...).
  KEEP_CONTENT: true,
  ADD_FORBID_CONTENTS: ['frame', 'frameset', 'object', 'embed', 'applet', 'textarea', 'select', 'canvas'],
};

let purifier: DOMPurifyInstance | null = null;

/** Dedicated instance, so the link hook never leaks into other DOMPurify users. */
function getPurifier(): DOMPurifyInstance {
  if (purifier) return purifier;
  const instance = DOMPurify(window);
  instance.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'A') {
      (node as Element).setAttribute('rel', SANITIZE_LINK_REL);
    }
  });
  purifier = instance;
  return instance;
}

/** Elements that carry text: when sanitizing leaves one with none, nothing of it is worth showing. */
const TEXT_ELEMENTS = 'li, p, h2, h3, h4, a, strong, em, ul, ol';

/** Passes needed at most: removing the last item of a list empties the list, and a list nests only so deep. */
const MAX_EMPTY_PASSES = 10;

/**
 * Drops what the sanitizer left empty: an item whose link lost its address or its text (a published guide ended its sources with a
 * bullet and nothing after it), a paragraph made of a removed tag. Same rule as the backend `SeoHtmlSanitizer`. Table cells are not
 * touched: an empty cell is still a cell.
 */
function removeEmptyElements(root: ParentNode): void {
  for (let pass = 0; pass < MAX_EMPTY_PASSES; pass += 1) {
    const empty = Array.from(root.querySelectorAll(TEXT_ELEMENTS)).filter((element) => (element.textContent ?? '').trim() === '');
    if (empty.length === 0) return;
    empty.forEach((element) => element.remove());
  }
}

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html || !html.trim()) return '';
  const fragment = getPurifier().sanitize(html, { ...CONFIG, RETURN_DOM_FRAGMENT: true });
  removeEmptyElements(fragment);
  const container = window.document.createElement('div');
  container.appendChild(fragment);
  return container.innerHTML.trim();
}
