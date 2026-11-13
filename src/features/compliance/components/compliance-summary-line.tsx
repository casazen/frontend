import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { NoteLine } from '@/features/dashboard/components/note-line';
import type { NoteTone, RowNote } from '@/features/dashboard/lib/home-model';
import type { LightSummary } from '../lib/compliance-light';

/** The page of the adempimenti, where the rest of the list is. */
const COMPLIANCE_PATH = '/app/short-rent/compliance';

interface ComplianceSummaryLineProps {
  /** What the lights of the summary say (`summarizeLights`): counted from what the API sends, never worked out here. */
  lights: LightSummary;
  /**
   * `page`: above the list, with what each light counts. `home`: the one line of the Home, with the way to the page. The words are the same.
   */
  variant?: 'page' | 'home';
}

/** How the line feels: red when something has to be done, amber while it is in hand, calm when nothing could be told (or all is in order). */
function toneOf(lights: LightSummary): NoteTone {
  if (lights.needs === 0) return 'success';
  if (lights.red > 0) return 'danger';
  if (lights.yellow > 0) return 'warning';
  return 'info';
}

/**
 * "Sono in regola?" in one line (NF-52): «Tutto in regola» when nothing needs attention, otherwise «N cose da fare» with what the lights
 * say («3 da sistemare, 2 in corso»). Everything is counted from the lights the API sends: an item with no light is never in order, it
 * is «da verificare» and counts as something to do. The icon and the words say it, the color is never the only signal.
 *
 * «Tutto in regola» is green, and green is only ever what the server proves: when no item carries a light (an older server, or the traffic
 * light off) an empty list says nothing about what nobody evaluated (ISTAT, the tourist tax, the receipts, the identity), so the line is
 * left out, as it was before the lights.
 */
export function ComplianceSummaryLine({ lights, variant = 'page' }: ComplianceSummaryLineProps) {
  const { t } = useTranslation();
  if (lights.needs === 0 && !lights.lightsOn) return null;

  const todo = t('compliance.summary.line.todo', { count: lights.needs });
  // The parts only when they tell more than the total does: all of them one kind is the total again.
  const parts = [
    lights.red > 0 ? t('compliance.summary.line.red', { count: lights.red }) : null,
    lights.yellow > 0 ? t('compliance.summary.line.yellow', { count: lights.yellow }) : null,
    lights.unknown > 0 ? t('compliance.summary.line.unknown', { count: lights.unknown }) : null,
  ].filter((part): part is string => part !== null);
  const text =
    lights.needs === 0
      ? t('compliance.summary.line.allClear')
      : variant === 'page' && parts.length > 1
        ? t('compliance.summary.line.withDetail', { todo, what: parts.join(', ') })
        : todo;
  const note: RowNote = { text, tone: toneOf(lights) };

  if (variant === 'page') {
    return (
      <p data-testid="compliance-summary-line" data-tone={note.tone}>
        <NoteLine note={note} />
      </p>
    );
  }

  return (
    <div data-testid="home-compliance-line" data-tone={note.tone} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <NoteLine note={note} />
      <Link
        to={COMPLIANCE_PATH}
        className="inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-sm font-medium text-primary-text underline-offset-2 outline-hidden ring-offset-background hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        data-testid="home-compliance-all"
      >
        {t('compliance.cockpit.openAll')}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}
