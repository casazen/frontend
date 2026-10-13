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

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html || !html.trim()) return '';
  return getPurifier().sanitize(html, CONFIG).trim();
}
