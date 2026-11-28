import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CircleHelp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export interface HelpTipProps {
  children: React.ReactNode;
  /** What the tip is about, as a heading ("Codice CIN"). It also names the button: "Cos'è: Codice CIN". */
  title?: string;
  label?: string;
  learnMoreHref?: string;
  learnMoreLabel?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  sheetOnPhone?: boolean;
  className?: string;
}

const EXTERNAL_HREF = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/guida\/)/i;

function LearnMoreLink({ href, label, onNavigate }: { href: string; label: string; onNavigate: () => void }) {
  const className =
    'mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-0';
  const content = (
    <>
      {label}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </>
  );

  if (EXTERNAL_HREF.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={onNavigate}>
        {content}
      </a>
    );
  }
  return (
    <Link to={href} className={className} onClick={onNavigate}>
      {content}
    </Link>
  );
}

/**
 * The "?" next to a word that needs explaining (UI-07): a button that opens a short explanation and, if there is one, a
 * link to the whole story. It opens on a click, a tap, Enter or Space, and never on hover alone, because a finger and a
 * keyboard have no hover. It closes with Esc, a click outside, or the link; the focus goes back to the button.
 *
 * Next to a field or a heading on a tablet or a desktop it is a bubble beside the button; on a phone it is a sheet from the
 * bottom, which a thumb reaches and does not hide behind the finger.
 *
 * A rule of content, not of code: at most three of them on a screen, and only for a word that is really technical (CIN,
 * RLI, cedolare secca). A page full of question marks says that the page is hard.
 */
export function HelpTip({ children, title, label, learnMoreHref, learnMoreLabel, side = 'bottom', sheetOnPhone = true, className }: HelpTipProps) {
  const { t } = useTranslation();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [open, setOpen] = React.useState(false);
  const titleId = React.useId();
  const textId = React.useId();
  const content = React.useRef<HTMLDivElement>(null);

  const name = label ?? (title ? t('helpTip.labelFor', { title }) : t('helpTip.label'));
  const link = learnMoreHref ? (
    <LearnMoreLink
      href={learnMoreHref}
      label={learnMoreLabel ?? t('helpTip.learnMore')}
      onNavigate={() => setOpen(false)}
    />
  ) : null;

  const trigger = (
    <button
      type="button"
      aria-label={name}
      className={cn(
        "relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground transition-colors before:absolute before:-inset-3 before:content-[''] hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-primary/10 data-[state=open]:text-primary",
        className,
      )}
    >
      <CircleHelp className="h-4 w-4" aria-hidden="true" />
    </button>
  );

  if (isPhone && sheetOnPhone) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" data-testid="help-tip-sheet" className="outline-none">
          <SheetHeader className="px-4 pb-2 pr-14 pt-0">
            <SheetTitle>{title ?? name}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-4">
            <SheetDescription className="break-words text-foreground">{children}</SheetDescription>
            {link}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        ref={content}
        side={side}
        data-testid="help-tip-popover"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : name}
        aria-describedby={textId}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          content.current?.focus();
        }}
      >
        {title ? (
          <p id={titleId} className="mb-1 text-sm font-semibold">
            {title}
          </p>
        ) : null}
        <p id={textId} className="break-words text-sm leading-relaxed">
          {children}
        </p>
        {link}
      </PopoverContent>
    </Popover>
  );
}
