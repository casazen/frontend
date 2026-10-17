import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface PublicSiteStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** `alert` when something went wrong and the guest has to act (retry); otherwise the state is plain content. */
  role?: 'alert';
  testId?: string;
  /** The way out: one action, the focal point of the state. */
  children?: ReactNode;
}

/**
 * A state of the booking site that replaces its content (the site does not exist, it could not be loaded): one icon, one
 * message and one way out, calm and centered. It sits inside the frame of the site (header and footer, the theme of the
 * host), and it reads the semantic tokens, which follow the theme there and the app's own look anywhere else (the page of
 * an unknown address is also shown outside the frame).
 */
export function PublicSiteState({ icon: Icon, title, description, role, testId, children }: PublicSiteStateProps) {
  return (
    <section
      role={role}
      data-testid={testId}
      className="mx-auto flex min-h-[55vh] max-w-md flex-col items-center justify-center gap-3 px-4 py-12 text-center"
    >
      <span
        aria-hidden
        className="mb-1 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-[var(--cz-public-primary-text,var(--color-primary))]"
      >
        <Icon className="h-7 w-7" />
      </span>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
      {children ? <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </section>
  );
}
