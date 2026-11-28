import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

type RevealTag = 'div' | 'li' | 'header' | 'figure' | 'article';

interface RevealProps {
  as?: RevealTag;
  index?: number;
  className?: string;
  children: ReactNode;
}

const SAFETY_MS = 2600;

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
