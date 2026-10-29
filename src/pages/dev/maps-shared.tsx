/* eslint-disable i18next/no-literal-string -- A page for developers and for the Playwright runs, not a screen of the product: it is not in the production build (see routes/dev-routes.tsx), so its words are not translated. */
import { useLayoutEffect, useRef } from 'react';
import { mountMapSvg } from '@/features/site-maps/mount-svg';

/** The SVG text of the engine as real nodes, filling a box with the aspect ratio of the map. */
export function SvgBox({ svg, className = '' }: { svg: string; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (host.current) mountMapSvg(host.current, svg);
  }, [svg]);
  return <div ref={host} className={`absolute inset-0 [&>svg]:absolute [&>svg]:inset-0 [&>svg]:h-full [&>svg]:w-full ${className}`} />;
}

export function HomePin({ x = 50, y = 50 }: { x?: number; y?: number }) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-full" style={{ left: `${x}%`, top: `${y}%` }} aria-hidden="true">
      <svg viewBox="0 0 26 34" width="26" height="34" className="drop-shadow">
        <path d="M13 1C6.4 1 1.5 6 1.5 12.4c0 8.4 11.5 20.6 11.5 20.6s11.5-12.2 11.5-20.6C24.5 6 19.6 1 13 1z" fill="#a3431f" stroke="#fff" strokeWidth="2" />
        <path d="M7.6 13 13 8l5.4 5v5.4H7.6z" fill="#fff" />
      </svg>
    </div>
  );
}

export function PoiDot({ letter, x, y }: { letter: string; x: number; y: number }) {
  return (
    <div
      className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#27506b] text-[11px] font-bold leading-none text-white shadow"
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-hidden="true"
    >
      {letter}
    </div>
  );
}
