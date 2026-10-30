import * as React from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DropzoneProps {
  /** MIME types the picker offers (`image/jpeg`). What is dropped is not filtered here: the caller knows the rules and says which file fails. */
  accept: readonly string[];
  /** Told the files that were chosen or dropped, in the order given. The zone checks nothing about them. */
  onFiles: (files: File[]) => void;
  /** What the zone invites to do ("Trascina qui le foto"). */
  title: React.ReactNode;
  /** The button that opens the file picker: the way in for the keyboard, the phone and everyone who does not drag. */
  buttonLabel: string;
  /** The rules in one line ("JPG, PNG o WebP, fino a 10 MB"). */
  hint?: React.ReactNode;
  /** More than one file at a time. Default true. */
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  'data-testid'?: string;
}

/**
 * A place to drop files, with a button for those who do not drag (SR-07b). The button is the real control: it opens the file picker
 * and works with the keyboard and on a phone; the dashed area only adds the drop. It checks nothing and uploads nothing — it hands
 * the files over, in order, and the caller decides what is valid, one file at a time.
 */
export function Dropzone({
  accept,
  onFiles,
  title,
  buttonLabel,
  hint,
  multiple = true,
  disabled = false,
  className,
  'data-testid': testId = 'dropzone',
}: DropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const titleId = React.useId();
  const hintId = React.useId();
  const [dragging, setDragging] = React.useState(false);

  const hand = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
  };

  // Only files are welcome: dragging a photo of the gallery over the zone (to reorder it) must not light it up.
  const carriesFiles = (event: React.DragEvent) => Array.from(event.dataTransfer.types).includes('Files');

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      aria-describedby={hint ? hintId : undefined}
      data-testid={testId}
      data-dragging={dragging || undefined}
      className={cn(
        'flex min-w-0 flex-col items-center gap-3 rounded-lg border-2 border-dashed border-input px-4 py-8 text-center transition-colors',
        dragging && !disabled && 'border-primary bg-primary/5',
        disabled && 'opacity-60',
        className,
      )}
      onDragEnter={(event) => {
        if (disabled || !carriesFiles(event)) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (disabled || !carriesFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(event) => {
        // Moving over a child of the zone fires a leave on the zone itself: only going out of it counts.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        if (disabled || !carriesFiles(event)) return;
        event.preventDefault();
        setDragging(false);
        hand(event.dataTransfer.files);
      }}
    >
      <Upload aria-hidden="true" className="size-6 shrink-0 text-foreground/70" />
      <p id={titleId} className="break-words text-sm font-medium">
        {title}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(',')}
        multiple={multiple}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        data-testid={`${testId}-input`}
        onChange={(event) => {
          hand(event.target.files);
          // The same file can be chosen again after a failure.
          event.target.value = '';
        }}
      />
      <Button type="button" variant="outline" disabled={disabled} onClick={() => inputRef.current?.click()} data-testid={`${testId}-button`}>
        {buttonLabel}
      </Button>
      {hint ? (
        <p id={hintId} className="break-words text-xs text-foreground/70">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
