import type { OrgSiteDocumentSource } from '@/types';

/**
 * Limits and checks of the operator documents (BK-14, A3-21). Mirror of the backend
 * `Casazen.Core/SiteDocuments/OrgSiteDocumentRules.cs`, which validates again: keep the two in sync.
 */
export const DOCUMENT_CONTENT_MAX_LENGTH = 50_000;
export const DOCUMENT_URL_MAX_LENGTH = 2048;

/** An HTML start or end tag, a comment or a processing instruction. `<https://x>` is not one. */
const HTML_TAG = /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>|<[!?]/;
const MARKDOWN_LINK = /\[[^\]\n]*\]\(\s*([^)\s]*)[^)\n]*\)/g;
const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/** The text as the backend stores it: line breaks unified, control characters dropped, runs of blank lines reduced. */
export function normalizeDocumentText(text: string): string {
  return text
    .replace(/\r\n|\r|\u2028|\u2029/g, '\n')
    // eslint-disable-next-line no-control-regex -- removing control characters is the point
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n');
}

function isAllowedLink(url: string): boolean {
  try {
    return ALLOWED_LINK_PROTOCOLS.has(new URL(url.trim()).protocol);
  } catch {
    return false;
  }
}

/** Translation key of the first problem of a text, or null when it can be published. */
export function checkDocumentText(text: string): string | null {
  const normalized = normalizeDocumentText(text);
  if (normalized.length === 0) return 'siteDocuments.errors.contentRequired';
  if (normalized.length > DOCUMENT_CONTENT_MAX_LENGTH) return 'siteDocuments.errors.contentTooLong';
  if (HTML_TAG.test(normalized)) return 'siteDocuments.errors.htmlNotAllowed';
  for (const match of normalized.matchAll(MARKDOWN_LINK)) {
    if (!isAllowedLink(match[1])) return 'siteDocuments.errors.linkInvalid';
  }
  return null;
}

/** Translation key of the first problem of an address, or null when it can be published (https, no credentials, a host with a dot). */
export function checkDocumentUrl(value: string): string | null {
  const url = value.trim();
  if (url.length === 0) return 'siteDocuments.errors.urlRequired';
  // eslint-disable-next-line no-control-regex -- an address with a control character or a space is never valid
  if (url.length > DOCUMENT_URL_MAX_LENGTH || /[\s\u0000-\u001F]/.test(url)) return 'siteDocuments.errors.urlInvalid';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !parsed.hostname.includes('.')) {
      return 'siteDocuments.errors.urlInvalid';
    }
    return null;
  } catch {
    return 'siteDocuments.errors.urlInvalid';
  }
}

/** Translation key of the first problem of the form, or null; only the field of the chosen source counts. */
export function checkSiteDocumentForm(source: OrgSiteDocumentSource, content: string, externalUrl: string): string | null {
  return source === 'Text' ? checkDocumentText(content) : checkDocumentUrl(externalUrl);
}
