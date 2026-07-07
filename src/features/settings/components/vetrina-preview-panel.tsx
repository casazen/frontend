import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface VetrinaPreviewPanelProps {
  bookingSitePath: string;
}

export function VetrinaPreviewPanel({ bookingSitePath }: VetrinaPreviewPanelProps) {
  const { t } = useTranslation();
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const absoluteUrl = `${window.location.origin}${bookingSitePath}`;

  return (
    <Card data-testid="vetrina-preview-panel">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">{t('directBooking.previewTitle')}</CardTitle>
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
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`mx-auto overflow-hidden rounded-lg border bg-muted/30 transition-all ${
            device === 'mobile' ? 'max-w-[375px]' : 'w-full'
          }`}
        >
          <iframe
            title={t('directBooking.previewIframeTitle')}
            src={bookingSitePath}
            className={`w-full border-0 ${device === 'mobile' ? 'h-[600px]' : 'h-[480px]'}`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
        <a
          href={absoluteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          {t('directBooking.openFullscreen')}
          <ExternalLink className="h-4 w-4" />
        </a>
      </CardContent>
    </Card>
  );
}
