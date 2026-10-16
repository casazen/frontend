/** Id of the section of the working hours on the profile: the block at the top of the page takes the person here. */
export const HOURS_SECTION_ID = 'supplier-hours';

/** Brings the hours into view and gives the focus to the first day, so that the keyboard starts where the eyes go. */
export function focusHoursSection(): void {
  const section = document.getElementById(HOURS_SECTION_ID);
  if (!section) return;
  section.scrollIntoView({ block: 'start' });
  section.querySelector<HTMLElement>('[role="checkbox"], input')?.focus({ preventScroll: true });
}
