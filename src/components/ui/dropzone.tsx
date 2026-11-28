import * as React from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DropzoneProps {
  accept: readonly string[];
  onFiles: (files: File[]) => void;
  title: React.ReactNode;
  buttonLabel: string;
  hint?: React.ReactNode;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  'data-testid'?: string;
  inputTestId?: string;
}

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
  inputTestId,
}: DropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const titleId = React.useId();
  const hintId = React.useId();
  const [dragging, setDragging] = React.useState(false);

  const hand = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
  };

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
        data-testid={inputTestId ?? `${testId}-input`}
        onChange={(event) => {
          hand(event.target.files);
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
