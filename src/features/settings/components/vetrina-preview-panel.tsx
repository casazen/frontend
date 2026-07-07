import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VetrinaPreviewPanelProps {
  bookingSitePath: string;
}

export function VetrinaPreviewPanel({ bookingSitePath }: VetrinaPreviewPanelProps) {
  const { t } = useTranslation();
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const absoluteUrl = `${window.location.origin}${bookingSitePath}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="vetrina-preview-panel">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2 md:px-6">
        <span className="text-sm font-medium">{t('directBooking.previewTitle')}</span>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            <Button
              type="button"
              variant={device === 'desktop' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDevice('desktop')}
              aria-label={t('directBooking.previewDesktop')}
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={device === 'mobile' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDevice('mobile')}
              aria-label={t('directBooking.previewMobile')}
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>
          <a
            href={absoluteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            {t('directBooking.openFullscreen')}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div
        className={`flex min-h-0 flex-1 bg-muted/20 ${
          device === 'mobile' ? 'items-stretch justify-center' : ''
        }`}
      >
        <iframe
          title={t('directBooking.previewIframeTitle')}
          src={bookingSitePath}
          className={`min-h-0 flex-1 border-0 bg-background ${
            device === 'mobile' ? 'w-full max-w-[430px] shadow-lg' : 'h-full w-full'
          }`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  );
}
