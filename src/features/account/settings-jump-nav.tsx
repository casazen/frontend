import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { settingsSectionId, settingsSectionOf, type SettingsSection } from './settings-sections';

/** The page has more sections than this before the jump is worth a row of links: with fewer, the whole page is one look. */
const MIN_SECTIONS_FOR_JUMP = 4;

export interface JumpSection {
  id: SettingsSection;
  label: string;
}

/**
 * «Vai a…» of the settings of the account (AM-08b-e): a row of links to the sections of the page, once they are more than three, and
 * the address that names one (`?section=payments`) opens the page already there: it scrolls to the section and puts the focus on its
 * title, so a screen reader and the keyboard are where the eyes are. A name that is none of the sections is ignored. The links are
 * links (the address changes, the back button does not trap the person) and the section in view is marked.
 */
export function SettingsJumpNav({ sections }: { sections: readonly JumpSection[] }) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const wanted = settingsSectionOf(searchParams.get('section'));
  const shown = sections.some((section) => section.id === wanted) ? wanted : undefined;

  useEffect(() => {
    if (!shown) return;
    const target = document.getElementById(settingsSectionId(shown));
    if (!target) return;

    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    target.scrollIntoView?.({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    const title = target.querySelector<HTMLElement>('h2');
    if (title) {
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
  }, [shown]);

  if (sections.length < MIN_SECTIONS_FOR_JUMP) return null;

  return (
    <nav aria-label={t('accountSettings.jump.label')} data-testid="settings-jump-nav">
      <ul role="list" className="flex flex-wrap gap-2">
        {sections.map((section) => (
          <li key={section.id}>
            <Link
              to={{ search: `?section=${section.id}` }}
              replace
              aria-current={section.id === shown ? 'true' : undefined}
              data-testid={`settings-jump-${section.id}`}
              className={cn(
                'inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium ring-1 ring-inset ring-border transition-colors',
                'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                section.id === shown ? 'bg-muted text-foreground' : 'text-foreground/80',
              )}
            >
              {section.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
