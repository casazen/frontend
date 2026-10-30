import { useLayoutEffect, useRef } from 'react';
import { mountMapSvg } from '../mount-svg';

/**
 * The SVG text of the engine as real nodes, filling the box it is in. The drawing is decorative (`aria-hidden`): whatever it
 * shows is also in the text of the page.
 */
export function SvgHost({ svg, className = '' }: { svg: string; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (host.current) mountMapSvg(host.current, svg);
  }, [svg]);
  return <div ref={host} aria-hidden="true" className={`absolute inset-0 [&>svg]:absolute [&>svg]:inset-0 [&>svg]:h-full [&>svg]:w-full ${className}`} />;
}
