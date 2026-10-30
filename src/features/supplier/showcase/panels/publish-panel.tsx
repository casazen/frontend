import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { ShowcaseContent, ShowcaseDocument } from '@/types/supplier-showcase';
import { bookingsReasonKey, changeLabelKey, halfFilledRows, PAYMENTS_SETTINGS_PATH } from '../showcase-model';
import { HalfFilledItems, ReadinessItems } from './readiness-items';

interface PublishPanelProps {
  content: ShowcaseContent;
  /** The draft as it is on screen: the half-filled rows are looked for in it. */
  doc: ShowcaseDocument;
  /** Sends what waits, then publishes. */
  onPublish: () => void;
  busy: boolean;
}

/**
 * "Anteprima e pubblica" (SP-13d), the last step: the checks the server makes (what must be there to publish, what is advised), the rows of
 * the texts and of the jobs that are half filled (the server refuses them at publication), what the publication changes, why the bookings
 * would stay closed, and the one button. The server judges the checks again when it publishes: a button that is off here is a
 * convenience, not the guard.
 */
export function PublishPanel({ content, doc, onPublish, busy }: PublishPanelProps) {
  const { t } = useTranslation();
  const { readiness, changes, state } = content;
  const reasonKey = bookingsReasonKey(content.bookings.blockedBy);
  const upToDate = state === 'Online' && changes.length === 0;
  const blocked = !readiness.canPublish || halfFilledRows(doc).length > 0;
  const changed = changes.map((member) => {
    const key = changeLabelKey(member);
    return key ? t(key) : member;
  });

  return (
    <div className="space-y-8" data-testid="supplier-showcase-panel-publish">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('supplier.showcase.editor.publish.checks')}</h2>
        <ul className="space-y-3">
          <HalfFilledItems doc={doc} />
          <ReadinessItems items={readiness.items} />
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
