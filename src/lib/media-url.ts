/**
 * Photos are served by the object storage with absolute URLs (backend task FD-07). A relative path,
 * such as the legacy `/uploads/...` of the old container disk, cannot be shown: on Vercel every
 * unknown path is rewritten to `index.html`. Such entries are treated as missing photos.
 */
export function isDisplayableMediaUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:' || protocol === 'blob:' || protocol === 'data:';
  } catch {
    return false;
  }
}

/** The displayable (absolute) URLs of a photo list, in order. */
export function displayableMediaUrls(urls: readonly (string | null | undefined)[] | null | undefined): string[] {
  return (urls ?? []).filter(isDisplayableMediaUrl);
}
