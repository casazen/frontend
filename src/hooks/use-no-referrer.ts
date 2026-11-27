import { useEffect } from 'react';

/**
 * `Referrer-Policy: no-referrer` for the page that uses it: a link that leaves it (the sign-in, the legal documents, the support address) says nothing of the page it was on. The secret is out of the
 * address bar by then, but the page never tells where a person came from.
 */
export function useNoReferrer() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}
