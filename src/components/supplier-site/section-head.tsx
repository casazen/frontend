import type { ReactNode } from 'react';
import { Reveal } from './reveal';

interface SectionHeadProps {
  eyebrow?: string;
  title: string;
  text?: string;
  /** Id of the `h2`: the section points at it with `aria-labelledby`. */
  id: string;
  action?: ReactNode;
}

/** The head of a block of the home: a small label, the title, one line under it and, at the end, the way to the rest. */
export function SectionHead({ eyebrow, title, text, id, action }: SectionHeadProps) {
  return (
    <Reveal as="header" className="vz-head">
      <div className="vz-head__text">
        {eyebrow ? <p className="vz-eyebrow">{eyebrow}</p> : null}
        <h2 id={id}>{title}</h2>
        {text ? <p className="vz-head__lead">{text}</p> : null}
      </div>
      {action ? <div className="vz-head__action">{action}</div> : null}
    </Reveal>
  );
}
