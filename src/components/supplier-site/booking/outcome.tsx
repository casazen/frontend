import type { ReactNode } from 'react';

/** A state of the page of the verification link that is not the success: one icon, one sentence of what happened, the way on. */
export function Outcome({ icon, tone, title, text, actions, testId }: { icon: ReactNode; tone?: 'error'; title: string; text: string; actions?: ReactNode; testId: string }) {
  return (
    <div className="vz-container" data-testid={testId}>
      <section className={`vz-state${tone ? ` vz-state--${tone}` : ''}`}>
        <span className="vz-state__icon" aria-hidden="true">
          {icon}
        </span>
        <h1 tabIndex={-1}>{title}</h1>
        <p>{text}</p>
        {actions ? <div className="vz-state__actions">{actions}</div> : null}
      </section>
    </div>
  );
}
