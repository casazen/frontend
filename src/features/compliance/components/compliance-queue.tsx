import { useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { matchesSearch } from '@/components/shared/list-view/list-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ComplianceQueueProps<Row> {
  rows: readonly Row[];
  textOf: (row: Row) => string;
  needsAction: (row: Row) => boolean;
  children: (row: Row) => ReactNode;
  testId?: string;
}

/** Filters the rows already available to this user. The priority callout above the queue stays visible when filtering. */
export function ComplianceQueue<Row>({ rows, textOf, needsAction, children, testId }: ComplianceQueueProps<Row>) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [actionOnly, setActionOnly] = useState(false);
  const pending = rows.filter(needsAction);
  const visible = (actionOnly ? pending : rows).filter(row => matchesSearch(textOf(row), query));
  const filtering = actionOnly || query.trim().length > 0;
  const clear = () => {
    setQuery('');
    setActionOnly(false);
  };

  return (
    <div className="min-w-0 rounded-2xl border bg-card">
      {(rows.length > 1 || filtering) && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 p-3">
          <label className="relative min-w-0 grow basis-52">
            <span className="sr-only">{t('commandPalette.title')}</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" value={query} placeholder={t('commandPalette.title')} onChange={event => setQuery(event.target.value)} className="h-11 pl-9" />
          </label>
          <Button type="button" variant={actionOnly ? 'default' : 'outline'} className="min-h-11 max-w-full whitespace-normal rounded-full" aria-pressed={actionOnly} onClick={() => setActionOnly(!actionOnly)}>
            {t('listView.chips.needAttention', { count: pending.length })}
          </Button>
        </div>
      )}
      {filtering && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1">
          <p role="status" className="text-sm text-muted-foreground">{t('listView.count', { count: visible.length })}</p>
          <Button type="button" variant="link" className="min-h-11" onClick={clear}>{t('listView.clear')}</Button>
        </div>
      )}
      <ul role="list" className="divide-y divide-border" data-testid={testId}>{visible.map(children)}</ul>
    </div>
  );
}
