import type { ReactNode } from 'react';
import { Reveal } from './reveal';

interface SectionHeadProps {
  eyebrow?: string;
  title: string;
  text?: string;
  id: string;
  action?: ReactNode;
}

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
