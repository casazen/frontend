import { useLayoutEffect, useRef } from 'react';
import { mountMapSvg } from '../mount-svg';

export function SvgHost({ svg, className = '' }: { svg: string; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (host.current) mountMapSvg(host.current, svg);
  }, [svg]);
  return <div ref={host} aria-hidden="true" className={`absolute inset-0 [&>svg]:absolute [&>svg]:inset-0 [&>svg]:h-full [&>svg]:w-full ${className}`} />;
}
