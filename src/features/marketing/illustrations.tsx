import { useId } from 'react';

interface ArtProps {
  className?: string;
}

interface PersonProps {
  id: string;
  cx: number;
  cy: number;
  r: number;
  background: string;
  figure: string;
}

function Person({ id, cx, cy, r, background, figure }: PersonProps) {
  return (
    <g>
      <clipPath id={id}>
        <circle cx={cx} cy={cy} r={r} />
      </clipPath>
      <circle cx={cx} cy={cy} r={r} className={background} />
      <g clipPath={`url(#${id})`}>
        <circle cx={cx} cy={cy - r * 0.2} r={r * 0.33} className={figure} />
        <ellipse cx={cx} cy={cy + r * 0.88} rx={r * 0.74} ry={r * 0.52} className={figure} />
      </g>
    </g>
  );
}

const SPARK = 'M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4 Z';

export function GroupsArt({ className }: ArtProps) {
  const id = useId();
  return (
    <svg viewBox="0 0 260 160" role="presentation" aria-hidden="true" focusable="false" className={className}>
      <ellipse cx="130" cy="88" rx="120" ry="64" className="fill-primary-soft" />
      <Person id={`${id}-a`} cx={84} cy={92} r={30} background="fill-info-soft" figure="fill-info" />
      <Person id={`${id}-b`} cx={176} cy={92} r={30} background="fill-success-soft" figure="fill-success" />
      <Person id={`${id}-c`} cx={130} cy={74} r={38} background="fill-warning-soft" figure="fill-warning" />
      <circle cx="130" cy="74" r="38" className="fill-none stroke-card" strokeWidth="4" />
      <path d={SPARK} transform="translate(206 38)" className="fill-warning" />
      <path d={SPARK} transform="translate(52 48) scale(0.6)" className="fill-primary" />
      <circle cx="222" cy="112" r="4" className="fill-info" />
      <circle cx="40" cy="116" r="3" className="fill-success" />
    </svg>
  );
}

export function CampaignArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 260 160" role="presentation" aria-hidden="true" focusable="false" className={className}>
      <ellipse cx="130" cy="90" rx="120" ry="62" className="fill-primary-soft" />
      <rect x="66" y="66" width="128" height="80" rx="12" className="fill-card stroke-border" strokeWidth="2" />
      <path d="M70 74 L130 118 L190 74" className="fill-none stroke-border" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M130 130 C117 120 115 110 122 107 C127 105 130 108 130 110 C130 108 133 105 138 107 C145 110 143 120 130 130 Z"
        className="fill-primary"
      />
      <path d="M194 56 L238 34 L216 80 L206 62 Z" className="fill-info" />
      <path d="M206 62 L238 34" className="fill-none stroke-card" strokeWidth="2" strokeLinecap="round" />
      <path d={SPARK} transform="translate(48 50)" className="fill-warning" />
      <path d={SPARK} transform="translate(212 118) scale(0.6)" className="fill-primary" />
      <circle cx="38" cy="108" r="4" className="fill-success" />
      <circle cx="244" cy="96" r="3" className="fill-info" />
    </svg>
  );
}
