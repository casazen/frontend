import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toastUndo } from '@/lib/toast-undo';
import { cn } from '@/lib/utils';

interface ReorderableListProps<T> {
  items: readonly T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  label: string;
  itemLabel: (index: number) => string;
  newItem: () => T;
  addLabel: string;
  removedMessage: string;
  max?: number;
  className?: string;
  testId?: string;
}

export function ReorderableList<T>({
  items,
  onChange,
  renderItem,
  label,
  itemLabel,
  newItem,
  addLabel,
  removedMessage,
  max,
  className,
  testId,
}: ReorderableListProps<T>) {
  const { t } = useTranslation();
  const root = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const latest = useRef(items);
  const focusAfter = useRef<{ row: number; action: 'up' | 'down' } | 'new' | 'add' | null>(null);

  useEffect(() => {
    latest.current = items;
    const wanted = focusAfter.current;
    focusAfter.current = null;
    if (wanted === 'add') addButton.current?.focus();
    else if (wanted === 'new') {
      const rows = root.current?.querySelectorAll<HTMLElement>('[data-row]');
      rows?.item(rows.length - 1)?.querySelector<HTMLElement>('input, textarea, select')?.focus();
    } else if (wanted) {
      const row = root.current?.querySelector<HTMLElement>(`[data-row="${wanted.row}"]`);
      const button = row?.querySelector<HTMLElement>(`[data-action="${wanted.action}"]`);
      (button?.getAttribute('aria-disabled') === 'true' ? row?.querySelector<HTMLElement>('[data-action="up"], [data-action="down"]:not([aria-disabled="true"])') : button)?.focus();
    }
  }, [items]);

  const move = (index: number, to: number, action: 'up' | 'down') => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[index], next[to]] = [next[to], next[index]];
    focusAfter.current = { row: to, action };
    onChange(next);
  };

  const remove = (index: number) => {
    const removed = items[index];
    focusAfter.current = 'add';
    onChange(items.filter((_, position) => position !== index));
    toastUndo(removedMessage, {
      undo: () => {
        const current = latest.current;
        const at = Math.min(index, current.length);
        onChange([...current.slice(0, at), removed, ...current.slice(at)]);
      },
    });
  };

  const add = () => {
    focusAfter.current = 'new';
    onChange([...items, newItem()]);
  };

  return (
    <div ref={root} className={cn('space-y-3', className)} role="group" aria-label={label} data-testid={testId}>
      {items.map((item, index) => (
        <div key={index} role="group" aria-label={itemLabel(index)} data-row={index} className="space-y-3 rounded-lg border p-3 sm:p-4">
          <div className="min-w-0 space-y-3">{renderItem(item, index)}</div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-action="up"
              aria-disabled={index === 0 ? true : undefined}
              aria-label={t('reorderable.up', { item: itemLabel(index) })}
              onClick={() => move(index, index - 1, 'up')}
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-action="down"
              aria-disabled={index === items.length - 1 ? true : undefined}
              aria-label={t('reorderable.down', { item: itemLabel(index) })}
              onClick={() => move(index, index + 1, 'down')}
            >
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
              <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
              {t('reorderable.remove')}
              <span className="sr-only"> {itemLabel(index)}</span>
            </Button>
          </div>
        </div>
      ))}
      {max === undefined || items.length < max ? (
        <Button ref={addButton} type="button" variant="outline" onClick={add}>
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
          {addLabel}
        </Button>
      ) : null}
    </div>
  );
}
