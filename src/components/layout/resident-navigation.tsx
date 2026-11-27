import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ResidentNavigation({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const id = useId();
  return (
    <div>
      <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2 text-sm font-medium focus-visible:outline-ring" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {t(open ? 'nav.collapse' : 'nav.expand')}
        <ChevronDown aria-hidden="true" className={open ? 'size-4 rotate-180' : 'size-4'} />
      </button>
      <div id={id} hidden={!open}>
        <nav aria-label={label} className="resident-nav" data-testid={testId}>{children}</nav>
      </div>
    </div>
  );
}
