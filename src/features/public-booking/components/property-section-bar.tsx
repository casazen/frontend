import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export interface PropertySection {
  /** `id` of the section in the page. */
  id: string;
  label: string;
}

/** After a click the bar keeps the section that was clicked while the page scrolls there (ms): a short page may not reach the line. */
const CLICK_HOLD = 1000;

/**
 * How far down the window the bar sticks: right under the header of the site when that one sticks too (the shell of the
 * booking site decides, and may change), else at the top of the window.
 */
function stickOffset(nav: HTMLElement): number {
  const header = nav.closest('.public-site-root')?.querySelector(':scope > header');
  if (!header) return 0;
  const { position } = getComputedStyle(header);
  return position === 'sticky' || position === 'fixed' ? header.getBoundingClientRect().height : 0;
}

/**
 * Row of links to the sections the page has: it stays at the top while the sections go by and marks the one being read. The page
 * decides which sections exist (a section without data is not in the page and not here), so there are no dead links. From a tablet
 * up the links are tabs with an underline; on a phone they are chips that scroll sideways (DB-04a).
 */
export function PropertySectionBar({ sections }: { sections: PropertySection[] }) {
  const { t } = useTranslation();
  const navRef = useRef<HTMLElement>(null);
  const heldUntil = useRef(0);
  const [active, setActive] = useState(sections[0]?.id);
  const ids = sections.map((section) => section.id).join('|');

  // Where it sticks, decided by the DOM (not by state): it follows the header of the site on every resize.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const place = () => {
      nav.style.top = `${stickOffset(nav)}px`;
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, []);

  // The section being read is the last one whose top has passed a line just under the bar.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const list = ids.split('|');
    let frame = 0;
    const update = () => {
      frame = 0;
      if (performance.now() < heldUntil.current) return;
      const line = stickOffset(nav) + nav.offsetHeight + 32;
      let current = list[0];
      for (const id of list) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= line) current = id;
      }
      // At the end of the page the last section may be too short to reach the line: it is the one being read.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = list[list.length - 1];
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ids]);

  const go = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const nav = navRef.current;
    const target = document.getElementById(id);
    if (!nav || !target) return;
    event.preventDefault();
    heldUntil.current = event.timeStamp + CLICK_HOLD;
    setActive(id);
    // The section lands just under the bar (and the header, when it sticks).
    const top = target.getBoundingClientRect().top + window.scrollY - (stickOffset(nav) + nav.offsetHeight + 16);
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(0, top), behavior: calm ? 'auto' : 'smooth' });
  };

  return (
    <nav
      ref={navRef}
      aria-label={t('publicProperty.sectionBar.label')}
      className="sticky top-0 z-20 -mx-3 -mt-2 bg-[var(--cz-public-bg)] px-3 md:mx-0 md:px-0"
      data-testid="property-section-bar"
    >
      <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0 py-2 [scrollbar-width:none] md:gap-8 md:overflow-visible md:border-b md:py-0 [&::-webkit-scrollbar]:hidden">
        {sections.map((section) => (
          <li key={section.id} className="shrink-0">
            <a
              href={`#${section.id}`}
              aria-current={active === section.id ? 'location' : undefined}
              onClick={(event) => go(event, section.id)}
              className={cn(
                'relative flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full max-md:after:hidden motion-reduce:transition-none',
                'md:block md:min-h-0 md:rounded-none md:px-0 md:py-3',
                active === section.id
                  ? 'bg-[var(--cz-public-text)] text-[var(--cz-public-bg)] md:bg-transparent md:text-[var(--cz-public-text)] md:after:bg-[var(--cz-public-primary)]'
                  : 'text-[var(--cz-public-muted)] shadow-[inset_0_0_0_1px_var(--cz-public-line-strong)] hover:text-[var(--cz-public-text)] md:shadow-none',
              )}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
