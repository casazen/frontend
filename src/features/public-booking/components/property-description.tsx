import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Past this many characters, or lines, the text is cut to a few lines with a button to read the rest. */
const LONG_TEXT_CHARACTERS = 420;
const LONG_TEXT_LINES = 6;

/** The description the host wrote: its own line breaks kept, long texts folded. */
export function PropertyDescription({ text, id }: { text: string; id?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const textId = useId();
  const long = text.length > LONG_TEXT_CHARACTERS || text.split('\n').length > LONG_TEXT_LINES;

  return (
    <section id={id} aria-label={t('publicProperty.description.title')} className="scroll-mt-20 space-y-3" data-testid="property-description">
      {/* Folded, the text fades out instead of ending in an ellipsis (a line break of the host would leave it alone on a line). */}
      <p
        id={textId}
        className={cn(
          'whitespace-pre-line break-words leading-relaxed',
          long && !open && 'max-h-40 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]',
        )}
      >
        {text}
      </p>
      {long ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={textId}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--cz-public-primary-text)] underline-offset-4 hover:underline"
        >
          {open ? t('publicProperty.description.less') : t('publicProperty.description.more')}
          <ChevronDown className={cn('h-4 w-4 transition-transform motion-reduce:transition-none', open && 'rotate-180')} aria-hidden />
        </button>
      ) : null}
    </section>
  );
}
