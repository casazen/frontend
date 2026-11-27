import type { ReactNode } from 'react';

/** One option: its label (tied to its control when `htmlFor` is given) and, under it, what it is; the control on the right. Same look as the card of the service (`vd-opt`). */
export function OptionField({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="vd-opt">
      <span className="vd-opt__l">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}
        {hint ? <small>{hint}</small> : null}
      </span>
      {children}
    </div>
  );
}
