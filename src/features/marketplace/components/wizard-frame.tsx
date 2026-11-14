import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MARKETPLACE_PATH } from '../lib/marketplace-paths';

/** A link in the text of a step: at least 44 px high, a visible focus, underlined (the one way out of a wizard that is allowed, UX-02). */
export const WIZARD_LINK_CLASS =
  'inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

interface SaveAndExitProps {
  label: string;
  onLeave: () => void;
  testId: string;
}

/** The way out of a wizard that keeps what was answered, on every step (UX-06). It is a button: the wizard is one form, and a link would leave it without saying so. */
export function SaveAndExit({ label, onLeave, testId }: SaveAndExitProps) {
  return (
    <div className="flex justify-end">
      <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={onLeave} data-testid={testId}>
        {label}
      </Button>
    </div>
  );
}

interface WizardFrameProps {
  title: string;
  description?: string;
  testId: string;
  children: ReactNode;
}

/** The page of a wizard of the marketplace: as wide as the page, under its title, and the trail back to the Marketplace. */
export function WizardFrame({ title, description, testId, children }: WizardFrameProps) {
  const { t } = useTranslation();

  return (
    <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid={testId}>
      <PageHeader title={title} description={description} crumbs={[{ label: t('marketplace.title'), to: MARKETPLACE_PATH }, { label: title }]} />
      {children}
    </div>
  );
}
