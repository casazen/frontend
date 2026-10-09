interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * Title, description and, on the right, the controls of the page. It has to fit a phone whatever the font of the machine:
 * the text block can shrink (`min-w-0`) and a word longer than the screen breaks, and the controls go under the text when
 * they would leave it less than 14rem, instead of pushing out of the screen (a select or two buttons made the whole page
 * scroll sideways at 360-390 px with a font wider than Segoe UI, as the Linux machines of the CI have). With room enough
 * nothing changes: text on the left, controls on the right.
 */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 grow basis-56">
        <h1 className="break-words text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-2 break-words">{description}</p>
        )}
      </div>
      {action && <div className="min-w-0 max-w-full">{action}</div>}
    </div>
  );
}
