import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Info, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** What a button of the state does: go somewhere (`href`) or run something (`onClick`). Text already translated. */
export type EmptyStateAction = { label: string } & (
  | { href: string; onClick?: () => void }
  | { href?: undefined; onClick: () => void }
);

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** The one thing to do about the emptiness ("Create the first booking"). */
  action?: EmptyStateAction;
  /** A second way out, quieter than the first ("Import from a file"). */
  secondaryAction?: EmptyStateAction;
  /** "How it works": a link to the page or the article that explains what this section is for. */
  helpLink?: { label: string; href: string };
  /**
   * Room for "Try with sample data": the button or link goes here once sample data exists. It is rendered as it comes,
   * after the actions and next to the help link.
   */
  sampleData?: ReactNode;
  className?: string;
}

/** `/app/...` goes through the router (no reload); anything else (an `https:` link, `mailto:`) is a plain link. */
const isInternalPath = (href: string) => href.startsWith("/") && !href.startsWith("//");

function ActionButton({ action, variant }: { action: EmptyStateAction; variant: "default" | "outline" }) {
  if (!action.href) {
    return (
      <Button variant={variant} onClick={action.onClick}>
        {action.label}
      </Button>
    );
  }
  return (
    <Button asChild variant={variant} onClick={action.onClick}>
      {isInternalPath(action.href) ? (
        <Link to={action.href}>{action.label}</Link>
      ) : (
        <a href={action.href}>{action.label}</a>
      )}
    </Button>
  );
}

const HELP_LINK =
  "inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/**
 * A section with nothing in it yet. It says what the section is for, offers the one thing to do (and, quieter, a second
 * one) and points to how it works: an empty page is never a dead end.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  helpLink,
  sampleData,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      <div className="rounded-full bg-muted p-6 mb-4">
        <Icon className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">{description}</p>
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action && <ActionButton action={action} variant="default" />}
          {secondaryAction && <ActionButton action={secondaryAction} variant="outline" />}
        </div>
      )}
      {(helpLink || sampleData) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {helpLink &&
            (isInternalPath(helpLink.href) ? (
              <Link to={helpLink.href} className={HELP_LINK}>
                <Info aria-hidden="true" className="size-4" />
                {helpLink.label}
              </Link>
            ) : (
              <a href={helpLink.href} className={HELP_LINK}>
                <Info aria-hidden="true" className="size-4" />
                {helpLink.label}
              </a>
            ))}
          {sampleData}
        </div>
      )}
    </div>
  );
}
