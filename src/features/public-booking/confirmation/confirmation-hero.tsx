import type { ReactNode, RefObject } from 'react';
import { Clock, CreditCard, MailCheck, XCircle } from 'lucide-react';
import './confirmation.css';

export type SealKind = 'tick' | 'mail' | 'clock' | 'card' | 'cross';

function Seal({ kind }: { kind: SealKind }) {
  if (kind === 'tick') {
    return (
      <span className="bc-seal" aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none">
          <circle className="bc-seal__ring" cx="32" cy="32" r="29" />
          <path className="bc-seal__tick" d="M19.5 33.5l8.5 8.5 16.5-18" />
        </svg>
      </span>
    );
  }
  return (
    <span className={`bc-seal bc-seal--${kind}`} aria-hidden="true">
      {kind === 'mail' ? <MailCheck /> : kind === 'card' ? <CreditCard /> : kind === 'cross' ? <XCircle /> : <Clock />}
    </span>
  );
}

interface ConfirmationHeroProps {
  seal: SealKind;
  title: string;
  titleRef: RefObject<HTMLHeadingElement | null>;
  lead?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
}

export function ConfirmationHero({ seal, title, titleRef, lead, actions, aside }: ConfirmationHeroProps) {
  return (
    <section className="bc-hero" aria-labelledby="bc-title">
      <div className="bc-hero__in">
        <div className="bc-hero__copy">
          <Seal kind={seal} />
          <h1 id="bc-title" ref={titleRef} tabIndex={-1} className="public-display">
            {title}
          </h1>
          {lead ? <p className="bc-hero__lead">{lead}</p> : null}
          {actions ? <div className="bc-hero__cta">{actions}</div> : null}
        </div>
        {aside ? <div className="bc-hero__side">{aside}</div> : null}
      </div>
    </section>
  );
}
