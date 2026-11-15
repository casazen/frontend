import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { copySiteAddress } from '../domain/copy-site-address';
import type { OrgBookingSite } from '../domain/use-org-domain';

/** What the address in the box is when it is not the one of the site, so that the host reads it before copying. Nothing when it is the site's own. */
function SiteAddressNote({ status }: { status: OrgBookingSite['status'] }) {
  const { t } = useTranslation();
  if (status === 'ready') return null;

  const text =
    status === 'loading'
      ? t('directBooking.bookingLink.siteLoading')
      : status === 'failed'
        ? t('directBooking.siteAddress.failed')
        : t('directBooking.siteAddress.restricted');
  return (
    <p className="text-xs text-muted-foreground" role="status" data-testid="vetrina-url-status" data-status={status}>
      {text}
    </p>
  );
}

interface VetrinaUrlCopyProps {
  /** The address of the booking site as it really is (its own host, or the platform path on the address of the app): written as it is, never put on the page's own address. */
  url: string;
  /** How sure that address is (`useOrgBookingSite`): the copy waits while it is read, and says so when the address is the one of CasaZen. */
  status: OrgBookingSite['status'];
  variant?: 'card' | 'inline';
}

export function VetrinaUrlCopy({ url, status, variant = 'card' }: VetrinaUrlCopyProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!(await copySiteAddress(url, status, t))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (variant === 'inline') {
    return (
      <div className="w-full max-w-2xl space-y-1.5" data-testid="vetrina-url-copy">
        <div className="flex gap-2">
          <Input readOnly value={url} className="font-mono text-xs" data-testid="vetrina-public-url" />
          <Button type="button" variant="outline" onClick={handleCopy} disabled={status === 'loading'} className="shrink-0" data-testid="vetrina-url-copy-button">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">{t('directBooking.copyUrl')}</span>
          </Button>
        </div>
        <SiteAddressNote status={status} />
      </div>
    );
  }

  return (
    <Card data-testid="vetrina-url-copy">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{t('directBooking.publicUrlTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('directBooking.publicUrlDescription')}</p>
        <div className="flex gap-2">
          <Input readOnly value={url} className="font-mono text-xs" data-testid="vetrina-public-url" />
          <Button type="button" variant="outline" onClick={handleCopy} disabled={status === 'loading'} className="shrink-0" data-testid="vetrina-url-copy-button">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">{t('directBooking.copyUrl')}</span>
          </Button>
        </div>
        <SiteAddressNote status={status} />
      </CardContent>
    </Card>
  );
}
