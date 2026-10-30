import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { ShowcaseDocument, ShowcaseReadinessItem } from '@/types/supplier-showcase';
import { fixPathOf, halfFilledRows, stepOfRow, stepPath, type HalfFilledRow } from '../showcase-model';

/**
 * The checks the server makes before a publication, as the rows of a list: done (a tick), advised (an info) or to do (an alert), each
 * said in words as well as by the icon, with "Sistema" to the page where it is put right when that page exists. The `ul` is the caller's.
 */
export function ReadinessItems({ items }: { items: readonly ShowcaseReadinessItem[] }) {
  const { t } = useTranslation();
  return (
    <>
      {items.map((item) => {
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
    </>
  );
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
 * The rows of the texts and of the jobs that are half filled (the server refuses them at publication): one line per step where they are
 * put right, with the way there. Nothing when there are none.
 */
export function HalfFilledItems({ doc }: { doc: ShowcaseDocument }) {
  const { t } = useTranslation();
  const halfFilled = halfFilledRows(doc);
  return (
    <>
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
    </>
  );
}
