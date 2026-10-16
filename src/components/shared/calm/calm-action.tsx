import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CalmActionShared {
  /** What the action does, already translated ("Registra il contratto"). */
  label: string;
  /** When several actions say the same ("Apri") this tells them apart; it must start with the label ("Apri: contratto Rossi"). */
  ariaLabel?: string;
  testId?: string;
}

/**
 * The action of a block, as a description and not as a button: the block decides how it looks. It either goes to a page
 * (`href`: a path of the app is a link of the router, an address with a scheme is a plain link) or runs something (`onClick`).
 */
export type CalmAction = CalmActionShared &
  (
    | { href: string; /** Handed to the page that opens (`useLocation().state`), as a router link does. */ state?: unknown; onClick?: undefined }
    | { onClick: () => void; href?: undefined; state?: undefined }
  );

/** `https://…`, `mailto:…`, `tel:…`, `//host/…`: an address outside the router. */
const OUTSIDE_THE_ROUTER = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

export interface CalmLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  state?: unknown;
}

/** A link to a path of the app (no reload, the router handles it) or to an address outside it (a plain `<a>`). */
export const CalmLink = React.forwardRef<HTMLAnchorElement, CalmLinkProps>(function CalmLink({ href, state, ...props }, ref) {
  if (OUTSIDE_THE_ROUTER.test(href)) return <a ref={ref} href={href} {...props} />;
  return <Link ref={ref} to={href} state={state} {...props} />;
});

export interface CalmActionButtonProps {
  action: CalmAction;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  iconRight?: React.ReactNode;
}

// 44 px high at least on every device (the product rule), and a long label wraps instead of pushing the page sideways.
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

/** The action as a button (it runs something) or a link that looks like one (it goes somewhere). */
export function CalmActionButton({ action, variant, size, className, iconRight }: CalmActionButtonProps) {
  const classes = cn(TOUCH_TARGET, className);

  if (action.href !== undefined) {
    return (
      <Button asChild variant={variant} size={size} className={classes} iconRight={iconRight}>
        <CalmLink href={action.href} state={action.state} aria-label={action.ariaLabel} data-testid={action.testId}>
          {action.label}
        </CalmLink>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={classes}
      iconRight={iconRight}
      aria-label={action.ariaLabel}
      data-testid={action.testId}
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  );
}
