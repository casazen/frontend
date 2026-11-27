import { useEffect } from 'react';

export interface SeoMetaInput {
  title: string;
  description?: string;
  canonicalUrl?: string | null;
  noindex?: boolean;
  follow?: boolean;
  referrer?: 'no-referrer';
  imageUrl?: string | null;
  ogType?: 'website' | 'article';
}

type MetaAttribute = 'name' | 'property';

type Restore = () => void;

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

export function applySeoMeta({ title, description, canonicalUrl, noindex, follow, referrer, imageUrl, ogType }: SeoMetaInput): Restore {
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

  if (noindex) restores.push(upsertMeta('robots', follow ? 'noindex,follow' : 'noindex,nofollow'));

  if (referrer) restores.push(upsertMeta('referrer', referrer));

  return () => {
    for (const restore of restores.reverse()) restore();
    document.title = previousTitle;
  };
}

export function useSeoMeta(meta: SeoMetaInput | null) {
  const title = meta?.title;
  const description = meta?.description;
  const canonicalUrl = meta?.canonicalUrl;
  const noindex = meta?.noindex;
  const follow = meta?.follow;
  const referrer = meta?.referrer;
  const imageUrl = meta?.imageUrl;
  const ogType = meta?.ogType;

  useEffect(() => {
    if (title === undefined) return;
    return applySeoMeta({ title, description, canonicalUrl, noindex, follow, referrer, imageUrl, ogType });
  }, [title, description, canonicalUrl, noindex, follow, referrer, imageUrl, ogType]);
}

export const SEO_DESCRIPTION_MAX_LENGTH = 155;

export function truncateDescription(text: string | null | undefined, maxLength = SEO_DESCRIPTION_MAX_LENGTH): string {
  const collapsed = (text ?? '').replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLength) return collapsed;

  const cut = collapsed.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const atWord = lastSpace >= maxLength / 2 ? cut.slice(0, lastSpace) : cut;
  return `${atWord.replace(/[\s,;:.-]+$/, '')}…`;
}
