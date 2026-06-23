import { useState } from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { copyTextToClipboard } from '@/lib/utils';

export function ApiAccessTokenCard() {
  const { t } = useTranslation();
  const { getAccessToken, refreshAccessToken } = useAuth();
  const [isCopying, setIsCopying] = useState(false);

  const handleCopyToken = async () => {
    setIsCopying(true);
    try {
      let token: string | undefined;
      try {
        token = await getAccessToken();
      } catch {
        token = await refreshAccessToken();
      }

      if (!token) {
        toast.error(t('profile.tokenUnavailable'));
        return;
      }

      await copyTextToClipboard(token);
      toast.success(t('profile.tokenCopied'));
    } catch {
      toast.error(t('profile.tokenCopyError'));
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.apiToken')}</CardTitle>
        <CardDescription>
          {t('profile.apiTokenDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button type="button" variant="outline" onClick={() => void handleCopyToken()} disabled={isCopying}>
          <Copy className="mr-2 h-4 w-4" />
          {isCopying ? t('profile.copying') : t('profile.copyToken')}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t('profile.tokenPasteInstructions')}
        </p>
      </CardContent>
    </Card>
  );
}
