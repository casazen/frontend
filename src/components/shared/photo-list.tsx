import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ArrowLeft, ArrowRight, ImageOff, Star, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isDisplayableMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';

export interface PhotoListItem {
  url: string;
  /** What the photo shows, for a screen reader; the page that owns the list writes it. */
  alt: string;
}

/** Every text of the list, already translated: the list belongs to no area, so it has no words of its own. */
export interface PhotoListLabels {
  add: string;
  /** What the add button says while the files go up. */
  adding: string;
  /** "2 of 6 photos". */
  counter: string;
  /** What is shown when there is no photo yet. */
  empty: string;
  /** The tag on the first photo: it is the one that represents the thing. */
  cover: string;
  /** A photo that cannot be shown (a broken link, a file that is not an image). */
  unavailable: string;
  moveEarlier: (position: number) => string;
  moveLater: (position: number) => string;
  remove: (position: number) => string;
}

export interface PhotoListProps {
  items: readonly PhotoListItem[];
  /** The most photos the list takes. */
  max: number;
  labels: PhotoListLabels;
  /** The photos to keep, in their new order. Called for a move and, without `onRemove`, for a removal. */
  onChange: (urls: string[]) => void;
  /** A removal that asks something first (a confirmation): the list does not remove, the owner does. */
  onRemove?: (url: string) => void;
  /** Files the person picked: the owner uploads them. Without it there is no "add" button. */
  onAdd?: (files: File[]) => void;
  /** What the picker offers (`image/jpeg,image/png,image/webp`). */
  accept?: string;
  /** Something is going on (a save): the buttons ignore clicks, but stay where they are so that the focus is not lost. */
  busy?: boolean;
  /** The files are going up: the add button says so. */
  uploading?: boolean;
  /** What the owner wants to say about the last action that failed (a refused upload), announced at once. */
  error?: string | null;
  testId?: string;
}

type Direction = 'earlier' | 'later';

/**
 * The photos of a thing, in order, the first being its cover: add, move one place earlier or later, remove (UI shared by the
 * areas that have photos, SP-06 first). Everything is a button of 44 px, so the order is changed with the keyboard and a
 * finger just as with a mouse: there is no dragging to do. A move gives the focus back to the same photo once the owner has
 * saved it, on the button of the same direction (or the other one when the photo has reached the end).
 *
 * It is a controlled list: it never changes what it shows by itself. The owner saves (`onChange`, `onAdd`) and passes the
 * list back.
 */
export function PhotoList({ items, max, labels, onChange, onRemove, onAdd, accept, busy = false, uploading = false, error, testId = 'photo-list' }: PhotoListProps) {
  const input = useRef<HTMLInputElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const refocus = useRef<{ url: string; direction: Direction } | null>(null);
  const full = items.length >= max;
  // The order in which the photos are on screen: what changes when a move is saved (the list itself is a new array at each render).
  const order = items.map((item) => item.url).join('\n');

  // Once the new order is on screen, the focus goes back to the photo that was moved (the keys of the tiles are the URLs): a tile
  // that changes place in the page loses the focus of the browser. The owner saves first and answers later, so this waits for the
  // order to change, not for the next render.
  useEffect(() => {
    const target = refocus.current;
    if (!target) return;
    refocus.current = null;
    const same = buttons.current.get(`${target.url}|${target.direction}`);
    const other = buttons.current.get(`${target.url}|${target.direction === 'earlier' ? 'later' : 'earlier'}`);
    const next = same && same.getAttribute('aria-disabled') !== 'true' ? same : other;
    next?.focus();
  }, [order]);

  const move = (index: number, direction: Direction) => {
    if (busy) return;
    const target = direction === 'earlier' ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;
    const urls = items.map((item) => item.url);
    [urls[index], urls[target]] = [urls[target]!, urls[index]!];
    refocus.current = { url: items[index]!.url, direction };
    onChange(urls);
  };

  const remove = (url: string) => {
    if (busy) return;
    // Another action: a move that was refused earlier must not take the focus when this one changes the order.
    refocus.current = null;
    if (onRemove) onRemove(url);
    else onChange(items.filter((item) => item.url !== url).map((item) => item.url));
  };

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // The same file can be picked again after a refusal.
    event.target.value = '';
    refocus.current = null;
    if (files.length > 0) onAdd?.(files);
  };

  const register = (key: string) => (element: HTMLButtonElement | null) => {
    if (element) buttons.current.set(key, element);
    else buttons.current.delete(key);
  };

  return (
    <div className="min-w-0 space-y-3" data-testid={testId}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-foreground/70" data-testid={`${testId}-counter`}>
          {labels.counter}
        </p>
        {onAdd ? (
          <>
            <input
              ref={input}
              type="file"
              multiple
              accept={accept}
              className="hidden"
              onChange={pick}
              tabIndex={-1}
              aria-hidden="true"
              data-testid={`${testId}-input`}
            />
            <Button
              type="button"
              variant="outline"
              className="min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              loading={uploading}
              aria-disabled={busy || uploading || full || undefined}
              data-testid={`${testId}-add`}
              onClick={() => {
                if (busy || uploading || full) return;
                input.current?.click();
              }}
            >
              {uploading ? null : <Upload aria-hidden="true" className="size-4" />}
              {uploading ? labels.adding : labels.add}
            </Button>
          </>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="break-words text-sm text-danger-foreground" data-testid={`${testId}-error`}>
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-foreground/70" data-testid={`${testId}-empty`}>
          {labels.empty}
        </p>
      ) : (
        <ul role="list" className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-busy={busy || undefined}>
          {items.map((item, index) => (
            <PhotoTile
              key={item.url}
              item={item}
              position={index + 1}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              labels={labels}
              busy={busy}
              registerButton={register}
              onMove={(direction) => move(index, direction)}
              onRemove={() => remove(item.url)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface PhotoTileProps {
  item: PhotoListItem;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  labels: PhotoListLabels;
  busy: boolean;
  registerButton: (key: string) => (element: HTMLButtonElement | null) => void;
  onMove: (direction: Direction) => void;
  onRemove: () => void;
}

function PhotoTile({ item, position, isFirst, isLast, labels, busy, registerButton, onMove, onRemove }: PhotoTileProps) {
  const [failed, setFailed] = useState(false);
  const displayable = isDisplayableMediaUrl(item.url) && !failed;
  // `aria-disabled` and not `disabled`: a disabled button drops the focus of the person who has just pressed it.
  const button = 'size-11 shrink-0 px-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

  return (
    <li className="min-w-0 space-y-2" data-testid="photo-list-item">
      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
        {displayable ? (
          <img src={item.url} alt={item.alt} loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(true)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-foreground/70">
            <ImageOff aria-hidden="true" className="size-8" />
            <p className="text-xs">{labels.unavailable}</p>
          </div>
        )}
        {isFirst ? (
          <span
            className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-foreground shadow-sm ring-1 ring-inset ring-border"
            data-testid="photo-list-cover"
          >
            <Star aria-hidden="true" className="size-3" />
            {labels.cover}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <Button
          ref={registerButton(`${item.url}|earlier`)}
          type="button"
          variant="outline"
          className={button}
          aria-label={labels.moveEarlier(position)}
          aria-disabled={isFirst || busy || undefined}
          onClick={() => !isFirst && onMove('earlier')}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
        </Button>
        <Button
          ref={registerButton(`${item.url}|later`)}
          type="button"
          variant="outline"
          className={button}
          aria-label={labels.moveLater(position)}
          aria-disabled={isLast || busy || undefined}
          onClick={() => !isLast && onMove('later')}
        >
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={cn(button, 'ml-auto text-danger-foreground hover:text-danger-foreground')}
          aria-label={labels.remove(position)}
          aria-disabled={busy || undefined}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </li>
  );
}
