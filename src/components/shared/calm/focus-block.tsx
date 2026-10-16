import * as React from 'react';
import { ArrowRight, Clock, UserRound, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalmActionButton, type CalmAction } from './calm-action';
import { TONE_STYLES, type CalmTone } from './calm-tone';

export interface FocusBlockProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title' | 'children'> {
  /** How it feels: the accent of the area (`neutral`, default), or good, bad or urgent news. The icon follows the tone. */
  tone?: CalmTone;
  /** A few words above the title: "Adesso", "Da sistemare". */
  kicker?: string;
  /** The one thing to do, as a short sentence. It is the name of the block for a screen reader. */
  title: string;
  /** Why, or what it is about, in a sentence or two. */
  body?: React.ReactNode;
  /** Whose turn it is: "Tocca a te", "Tocca a Elisa", "Se ne occupa CasaZen". */
  who?: string;
  /** How long it takes or when it is due: "5 minuti", "Entro venerdì 18". */
  when?: string;
  /** The action that does it. Always there: a block that says what to do and gives no way to do it is a dead end. */
  primary: CalmAction;
  /** The other way out, if there is one ("Più tardi", "Vedi il contratto"). */
  secondary?: CalmAction;
  /** What comes after, written as the person reads it ("Poi: la firma del conduttore"). */
  then?: string;
  /** Replaces the icon of the tone. It is decorative: the title and the words carry the meaning. */
  icon?: LucideIcon;
}

/**
 * The one highlighted block of a screen: what to do now, whose turn it is, how long it takes, what comes after, and the
 * button that does it. A page has at most one (the redesign conventions, §7bis, "un solo punto focale"): two colored blocks together
 * and the person does not know where to look.
 *
 * It is a `region` named by its title, so a screen reader finds it from the list of landmarks; the title is the `h2` of the
 * page area. The tone is told three ways, never by color alone: the tint, the icon, and the words you give it.
 *
 *     <FocusBlock tone="warning" kicker="Adesso" title="Il canone di ottobre non è arrivato" who="Tocca a te"
 *       when="Scaduto da 3 giorni" primary={{ label: 'Invia il sollecito', onClick: sendReminder }} />
 */
export function FocusBlock({ tone = 'neutral', kicker, title, body, who, when, primary, secondary, then, icon, className, ...props }: FocusBlockProps) {
  const titleId = React.useId();
  const style = TONE_STYLES[tone];
  const Icon = icon ?? style.Icon;

  return (
    <section
      {...props}
      aria-labelledby={titleId}
      data-tone={tone}
      className={cn('flex min-w-0 flex-col gap-3 rounded-xl p-4 ring-1 ring-inset forced-colors:outline-1 sm:flex-row sm:gap-4 sm:p-6', style.surface, className)}
    >
      <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-full bg-background sm:size-12', style.accent)}>
        <Icon className="size-5 sm:size-6" />
      </span>

      <div className="min-w-0 flex-1 space-y-2">
        {kicker ? <p className={cn('break-words text-xs font-semibold uppercase tracking-wide', style.accent)}>{kicker}</p> : null}
        <h2 id={titleId} className="break-words text-lg font-semibold leading-snug sm:text-xl">
          {title}
        </h2>
        {body ? <div className="break-words text-sm text-foreground/80 sm:text-base">{body}</div> : null}

        {who || when ? (
          <ul role="list" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground/70">
            {who ? (
              <li className="flex min-w-0 items-center gap-1.5">
                <UserRound aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 break-words">{who}</span>
              </li>
            ) : null}
            {when ? (
              <li className="flex min-w-0 items-center gap-1.5">
                <Clock aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 break-words">{when}</span>
              </li>
            ) : null}
          </ul>
        ) : null}

        {then ? (
          <p className="flex items-start gap-1.5 text-sm text-foreground/70">
            <ArrowRight aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 break-words">{then}</span>
          </p>
        ) : null}

        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <CalmActionButton action={primary} className="w-full sm:w-auto" />
          {secondary ? <CalmActionButton action={secondary} variant="outline" className="w-full sm:w-auto" /> : null}
        </div>
      </div>
    </section>
  );
}
