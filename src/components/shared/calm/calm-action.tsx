import { Link } from 'react-router-dom';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TOUCH_TARGET } from './calm-styles';

interface CalmActionShared {
  /** What the action does, already translated ("Registra il contratto"). */
  label: string;
  /** When several actions say the same ("Apri") this tells them apart; it must start with the label ("Apri: contratto Rossi"). */
  ariaLabel?: string;
  testId?: string;
  /**
   * Work in progress: a spinner goes before the label, the button announces `aria-busy` and ignores clicks (it keeps the
   * focus). Use it while what the action started is not over, so that a second tap cannot send it twice.
   */
  loading?: boolean;
}

/**
 * The action of a block, as a description and not as a button: the block decides how it looks. It either goes to a page
 * (`href`: a path of the app, or an address with a scheme, which the router link opens as a plain link) or runs something
 * (`onClick`, called without arguments: it never receives the click event, so `mutation.mutate` is safe to hand in).
 */
export type CalmAction = CalmActionShared &
  (
    | { href: string; /** Handed to the page that opens (`useLocation().state`), as a router link does. */ state?: unknown; onClick?: undefined; disabled?: undefined }
    | { onClick: () => void; /** Not available now: not in the Tab order, not clickable. Only for an action that runs something. */ disabled?: boolean; href?: undefined; state?: undefined }
  );

export interface CalmActionButtonProps {
  action: CalmAction;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  iconRight?: React.ReactNode;
}

/** The action as a button (it runs something) or a link that looks like one (it goes somewhere). */
export function CalmActionButton({ action, variant, size, className, iconRight }: CalmActionButtonProps) {
  const classes = cn(TOUCH_TARGET, className);

  if (action.href !== undefined) {
    return (
      <Button asChild variant={variant} size={size} className={classes} iconRight={iconRight} loading={action.loading}>
        <Link to={action.href} state={action.state} aria-label={action.ariaLabel} data-testid={action.testId}>
          {action.label}
        </Link>
      </Button>
    );
  }

  const { onClick } = action;
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={classes}
      iconRight={iconRight}
      loading={action.loading}
      disabled={action.disabled}
      aria-label={action.ariaLabel}
      data-testid={action.testId}
      onClick={() => onClick()}
    >
      {action.label}
    </Button>
  );
}
