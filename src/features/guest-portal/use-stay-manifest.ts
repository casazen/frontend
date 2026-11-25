import { useEffect } from 'react';

/** The browser can pin this stay. The manifest is assembled in the page so there is no request for a manifest carrying the token. */
export function useStayManifest(token: string, name: string | undefined, themeColor: string) {
  useEffect(() => {
    if (!name || !crypto.subtle) return;

    let active = true;
    let manifestUrl: string | undefined;
    let previous: string | null = null;
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifest) return;

    const absolute = (path: string) => new URL(path, window.location.origin).href;
    void crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)).then((digest) => {
      if (!active) return;
      const id = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
      const icons = [192, 512].map((size) => ({
        src: absolute(`/icon-${size}.png`), sizes: `${size}x${size}`, type: 'image/png',
      }));
      const data = {
        id: absolute(`/s/install/${id}`),
        name,
        short_name: name,
        start_url: absolute(`/s/${token}`),
        scope: absolute('/s/'),
        display: 'standalone',
        background_color: '#fbfaf8',
        theme_color: themeColor,
        icons,
      };
      previous = manifest.getAttribute('href');
      manifestUrl = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/manifest+json' }));
      manifest.setAttribute('href', manifestUrl);
    }).catch(() => {});

    return () => {
      active = false;
      if (!manifestUrl) return;
      URL.revokeObjectURL(manifestUrl);
      if (manifest.getAttribute('href') === manifestUrl) {
        if (previous === null) manifest.removeAttribute('href');
        else manifest.setAttribute('href', previous);
      }
    };
  }, [token, name, themeColor]);
}
