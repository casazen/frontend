import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface VetrinaUrlCopyProps {
  bookingSitePath: string;
}

export function VetrinaUrlCopy({ bookingSitePath }: VetrinaUrlCopyProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const absoluteUrl = `${window.location.origin}${bookingSitePath}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      toast.success(t('directBooking.urlCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('directBooking.urlCopyError'));
    }
  };

  return (
    <Card data-testid="vetrina-url-copy">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{t('directBooking.publicUrlTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('directBooking.publicUrlDescription')}</p>
        <div className="flex gap-2">
          <Input readOnly value={absoluteUrl} className="font-mono text-xs" data-testid="vetrina-public-url" />
          <Button type="button" variant="outline" onClick={handleCopy} className="shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">{t('directBooking.copyUrl')}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
