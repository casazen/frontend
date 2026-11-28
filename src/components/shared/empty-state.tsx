import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Info, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmptyStateAction = { label: string } & (
  | { href: string; onClick?: () => void }
  | { href?: undefined; onClick: () => void }
);

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  titleAs?: "h2" | "h3";
  description: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  helpLink?: { label: string; href: string };
  sampleData?: ReactNode;
  className?: string;
}

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

export function EmptyState({
  icon: Icon,
  title,
  titleAs: Title = "h3",
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
      <Title className="text-lg font-semibold mb-2">{title}</Title>
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
