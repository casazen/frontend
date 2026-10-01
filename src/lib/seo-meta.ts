import { useEffect } from 'react';

export interface SeoMetaInput {
  title: string;
  description?: string;
  /** Absolute URL on the public domain, from the backend (`App__PublicSiteBaseUrl`); never built in the browser. */
  canonicalUrl?: string | null;
  /** The page must not be indexed (not found, error, private page): `<meta name="robots" content="noindex,nofollow">`. */
  noindex?: boolean;
  /** Absolute https URL of the preview image (`og:image`). */
  imageUrl?: string | null;
  /** `og:type`; `website` when omitted. */
  ogType?: 'website' | 'article';
}

type MetaAttribute = 'name' | 'property';

/** Undoes what `applySeoMeta` did: the previous title, the previous values and the elements it had to create removed. */
type Restore = () => void;

/** Sets a `<meta>` and returns how to put it back: its previous content, or removal when it did not exist. */
function upsertMeta(name: string, content: string, attribute: MetaAttribute = 'name'): Restore {
  const existing = document.head.querySelector(`meta[${attribute}="${name}"]`);
  if (!existing) {
    const created = document.createElement('meta');
    created.setAttribute(attribute, name);
    created.setAttribute('content', content);
    document.head.appendChild(created);
    return () => created.remove();
  }

  const previous = existing.getAttribute('content');
  existing.setAttribute('content', content);
  return () => {
    if (previous === null) existing.removeAttribute('content');
    else existing.setAttribute('content', previous);
  };
}

function upsertCanonical(href: string): Restore {
  const existing = document.head.querySelector('link[rel="canonical"]');
  if (!existing) {
    const created = document.createElement('link');
    created.setAttribute('rel', 'canonical');
    created.setAttribute('href', href);
    document.head.appendChild(created);
    return () => created.remove();
  }

  const previous = existing.getAttribute('href');
  existing.setAttribute('href', href);
  return () => {
    if (previous === null) existing.removeAttribute('href');
    else existing.setAttribute('href', previous);
  };
}

/**
 * Writes the title and the meta tags of a page and returns the function that restores the previous ones: a page of the
 * single-page app must not leave its canonical, description or `noindex` on the pages that follow (A8-09).
 */
export function applySeoMeta({ title, description, canonicalUrl, noindex, imageUrl, ogType }: SeoMetaInput): Restore {
  const restores: Restore[] = [];
  const previousTitle = document.title;
  document.title = title;

  if (description) {
    restores.push(upsertMeta('description', description));
    restores.push(upsertMeta('og:description', description, 'property'));
    restores.push(upsertMeta('twitter:description', description));
  }

  restores.push(upsertMeta('og:title', title, 'property'));
  restores.push(upsertMeta('twitter:title', title));
  restores.push(upsertMeta('og:type', ogType ?? 'website', 'property'));

  if (canonicalUrl) {
    restores.push(upsertCanonical(canonicalUrl));
    restores.push(upsertMeta('og:url', canonicalUrl, 'property'));
  }

  if (imageUrl) {
    restores.push(upsertMeta('og:image', imageUrl, 'property'));
    restores.push(upsertMeta('twitter:image', imageUrl));
  }
  restores.push(upsertMeta('twitter:card', imageUrl ? 'summary_large_image' : 'summary'));

  if (noindex) restores.push(upsertMeta('robots', 'noindex,nofollow'));

  return () => {
    // In reverse order, so a tag written twice by nested calls ends on its original value.
    for (const restore of restores.reverse()) restore();
    document.title = previousTitle;
  };
}

export function useSeoMeta(meta: SeoMetaInput | null) {
  // Depend on the primitive fields: callers pass a new object literal on every render.
  const title = meta?.title;
  const description = meta?.description;
  const canonicalUrl = meta?.canonicalUrl;
  const noindex = meta?.noindex;
  const imageUrl = meta?.imageUrl;
  const ogType = meta?.ogType;

  useEffect(() => {
    if (title === undefined) return;
    return applySeoMeta({ title, description, canonicalUrl, noindex, imageUrl, ogType });
  }, [title, description, canonicalUrl, noindex, imageUrl, ogType]);
}

/** Longest description of a search result snippet (the first 155 characters, spec-branded-booking-site AC13). */
export const SEO_DESCRIPTION_MAX_LENGTH = 155;

/** `text` on one line, cut at a word boundary to `maxLength` characters with an ellipsis when something was cut. */
export function truncateDescription(text: string | null | undefined, maxLength = SEO_DESCRIPTION_MAX_LENGTH): string {
  const collapsed = (text ?? '').replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLength) return collapsed;

  const cut = collapsed.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const atWord = lastSpace >= maxLength / 2 ? cut.slice(0, lastSpace) : cut;
  return `${atWord.replace(/[\s,;:.-]+$/, '')}…`;
}
