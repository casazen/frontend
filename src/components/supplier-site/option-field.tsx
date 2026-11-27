import type { ReactNode } from 'react';

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
