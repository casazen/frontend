import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelpCircle, ArrowRight, X } from 'lucide-react';

export function IcalHelpTooltip() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, handleClickOutside]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        aria-label={t('supplier.help.icalTooltipLabel')}
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-72 rounded-lg border bg-white p-4 shadow-lg">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-2 right-2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Chiudi"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <p className="pr-5 text-sm text-muted-foreground">
            {t('supplier.help.icalTooltipText')}
          </p>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/help/ical');
            }}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {t('supplier.help.icalTooltipCta')}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
