import { useEffect } from 'react';

interface SeoMetaInput {
  title: string;
  description?: string;
  canonicalUrl?: string;
}

function upsertMeta(name: string, content: string, attribute: 'name' | 'property' = 'name') {
  let element = document.querySelector(`meta[${attribute}="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let element = document.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

export function applySeoMeta({ title, description, canonicalUrl }: SeoMetaInput) {
  document.title = title;

  if (description) {
    upsertMeta('description', description);
    upsertMeta('og:description', description, 'property');
  }

  upsertMeta('og:title', title, 'property');

  if (canonicalUrl) {
    upsertCanonical(canonicalUrl);
  }
}

export function useSeoMeta(meta: SeoMetaInput | null) {
  useEffect(() => {
    if (!meta) return;
    applySeoMeta(meta);
  }, [meta?.title, meta?.description, meta?.canonicalUrl]);
}
