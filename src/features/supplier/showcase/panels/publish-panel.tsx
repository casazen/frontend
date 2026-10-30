import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ShowcaseContent, ShowcaseDocument } from '@/types/supplier-showcase';
import { bookingsReasonKey, changeLabelKey, fixPathOf, halfFilledRows, PAYMENTS_SETTINGS_PATH, stepOfRow, stepPath, type HalfFilledRow } from '../showcase-model';

interface PublishPanelProps {
  content: ShowcaseContent;
  /** The draft as it is on screen: the half-filled rows are looked for in it. */
  doc: ShowcaseDocument;
  /** Sends what waits, then publishes. */
  onPublish: () => void;
  busy: boolean;
}

/** How a half-filled row is called ("Domanda 2"). */
function rowName(row: HalfFilledRow, t: (key: string, options?: Record<string, unknown>) => string): string {
  const n = row.index + 1;
  switch (row.section) {
    case 'team':
      return t('supplier.showcase.editor.texts.person', { n });
    case 'certs':
      return t('supplier.showcase.editor.texts.cert', { n });
    case 'faq':
      return t('supplier.showcase.editor.texts.question', { n });
    case 'guarantee':
      return t('supplier.showcase.editor.texts.guaranteeTitle');
    case 'gallery':
      return t('supplier.showcase.editor.works.work', { n });
  }
}

/** The steps where half-filled rows are put right, with the key of what is said of each. */
const HALF_FILLED_STEPS = [
  { step: 'texts', messageKey: 'supplier.showcase.editor.publish.halfFilled' },
  { step: 'works', messageKey: 'supplier.showcase.editor.publish.halfFilledWorks' },
] as const;

/**
 * "Anteprima e pubblica" (SP-13d), the last step: the checks the server makes (what must be there to publish, what is advised), the rows of
 * the texts that are half filled (the server refuses them at publication), what the publication changes, why the bookings would stay
 * closed, and the one button. The server judges the checks again when it publishes: a button that is off here is a convenience, not the
 * guard.
 */
export function PublishPanel({ content, doc, onPublish, busy }: PublishPanelProps) {
  const { t } = useTranslation();
  const { readiness, changes, state } = content;
  const reasonKey = bookingsReasonKey(content.bookings.blockedBy);
  const halfFilled = halfFilledRows(doc);
  const upToDate = state === 'Online' && changes.length === 0;
  const blocked = !readiness.canPublish || halfFilled.length > 0;
  const changed = changes.map((member) => {
    const key = changeLabelKey(member);
    return key ? t(key) : member;
  });

  return (
    <div className="space-y-8" data-testid="supplier-showcase-panel-publish">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('supplier.showcase.editor.publish.checks')}</h2>
        <ul className="space-y-3">
          {HALF_FILLED_STEPS.map(({ step, messageKey }) => {
            const rows = halfFilled.filter((row) => stepOfRow(row) === step);
            if (rows.length === 0) return null;
            return (
              <li key={step} className="flex flex-wrap items-start gap-x-3 gap-y-1 text-sm" data-testid={`supplier-showcase-check-half-filled-${step}`} data-level="todo">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 basis-48 break-words">
                  {t(messageKey, { rows: rows.map((row) => rowName(row, t)).join(', ') })}
                  <span className="sr-only"> — {t('supplier.showcase.editor.publish.level.todo')}</span>
                </span>
                <span aria-hidden="true" className="text-foreground/70">
                  {t('supplier.showcase.editor.publish.level.todo')}
                </span>
                <Link className="inline-flex min-h-11 items-center font-medium underline underline-offset-4" to={stepPath(step)}>
                  {t('supplier.showcase.before.fix')}
                </Link>
              </li>
            );
          })}
          {readiness.items.map((item) => {
            const path = fixPathOf(item);
            const Icon = item.level === 'ok' ? CheckCircle2 : item.level === 'todo' ? AlertCircle : Info;
            return (
              <li key={item.code} className="flex flex-wrap items-start gap-x-3 gap-y-1 text-sm" data-testid={`supplier-showcase-check-${item.code}`} data-level={item.level}>
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 basis-48 break-words">
                  {t(`supplier.showcase.readiness.${item.code}`)}
                  <span className="sr-only"> — {t(`supplier.showcase.editor.publish.level.${item.level}`)}</span>
                </span>
                <span aria-hidden="true" className="text-foreground/70">
                  {t(`supplier.showcase.editor.publish.level.${item.level}`)}
                </span>
                {item.level !== 'ok' && path ? (
                  <Link className="inline-flex min-h-11 items-center font-medium underline underline-offset-4" to={path}>
                    {t('supplier.showcase.before.fix')}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t('supplier.showcase.editor.publish.changes')}</h2>
        <p className="text-sm" data-testid="supplier-showcase-publish-changes">
          {changed.length > 0 ? changed.join(', ') : state === 'Draft' ? t('supplier.showcase.editor.publish.firstTime') : t('supplier.showcase.editor.publish.nothing')}
        </p>
      </section>

      {reasonKey && state !== 'Paused' ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t('supplier.showcase.bookings.title')}</h2>
          <p className="text-sm">{t(content.bookings.open ? 'supplier.showcase.focus.onlineBookingsOpen' : reasonKey)}</p>
          {content.bookings.blockedBy.includes('payments_account_not_ready') ? (
            <Button asChild variant="outline" size="sm">
              <Link to={PAYMENTS_SETTINGS_PATH}>{t('supplier.showcase.bookings.goToPayments')}</Link>
            </Button>
          ) : null}
        </section>
      ) : null}

      <div className="space-y-2">
        <Button
          type="button"
          size="lg"
          loading={busy}
          disabled={blocked || upToDate}
          onClick={onPublish}
          data-testid="supplier-showcase-publish-button"
        >
          {state === 'Draft' ? t('supplier.showcase.focus.publish') : t('supplier.showcase.focus.publishChanges')}
        </Button>
        {blocked ? <p className="text-sm text-foreground/70">{t('supplier.showcase.editor.publish.cannot')}</p> : null}
        {upToDate ? <p className="text-sm text-foreground/70">{t('supplier.showcase.editor.publish.upToDate')}</p> : null}
        {state === 'Paused' ? <p className="text-sm text-foreground/70">{t('supplier.showcase.editor.publish.paused')}</p> : null}
      </div>
    </div>
  );
}
