import type { ReactNode, RefObject } from 'react';
import { Clock, CreditCard, MailCheck, XCircle } from 'lucide-react';
import './confirmation.css';

/** The mark above the title: the drawn tick only for a booking the backend confirmed; every other state has its own icon (D24). */
export type SealKind = 'tick' | 'mail' | 'clock' | 'card' | 'cross';

function Seal({ kind }: { kind: SealKind }) {
  if (kind === 'tick') {
    // The ring and the tick draw themselves once; with «reduce motion» they are simply there (`confirmation.css`).
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
  /** The one action of the case, and the quiet link beside it. */
  actions?: ReactNode;
  /** The ticket. */
  aside?: ReactNode;
}

/**
 * The first screen of the confirmation (DB-06b), with one focal point: the state of the booking in a title, one action, and the
 * ticket beside it. The title is the only `h1` of the page and takes the focus when the page opens or its state changes. In reading
 * order: title, lead, action, ticket.
 */
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
