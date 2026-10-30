import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

type RevealTag = 'div' | 'li' | 'header' | 'figure' | 'article';

interface RevealProps {
  as?: RevealTag;
  /** Position in a row of siblings: each one comes a little after the one before. */
  index?: number;
  className?: string;
  children: ReactNode;
}

/** After this long everything is shown whatever the observer said (a preview, a printout, a tab that was in the background). */
const SAFETY_MS = 2600;

/**
 * A block that comes in as the page is scrolled to it. The CSS hides it only for who accepts motion (`prefers-reduced-motion`), and
 * only until it is seen; a browser that cannot observe shows it at once. Nothing depends on it: it is all in the markup.
 */
export function Reveal({ as: Tag = 'div', index = 0, className, children }: RevealProps) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [shown, setShown] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (shown || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setShown(true);
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    observer.observe(element);
    const safety = window.setTimeout(() => setShown(true), SAFETY_MS);
    return () => {
      observer.disconnect();
      window.clearTimeout(safety);
    };
  }, [shown, element]);

  return (
    <Tag ref={setElement} className={className} data-reveal={shown ? 'shown' : 'pending'} style={{ '--i': index } as CSSProperties}>
      {children}
    </Tag>
  );
}
