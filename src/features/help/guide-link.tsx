import { BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AppContextKey } from '@/config/route-manifest';
import { Button } from '@/components/ui/button';

export function GuideLink({ contextKey }: { contextKey: AppContextKey }) {
  const { t } = useTranslation();
  return (
    <Button asChild variant="ghost" size="icon">
      <Link to={`/app/${contextKey}/help`} aria-label={t('productGuide.open')} title={t('productGuide.open')}>
        <BookOpen className="h-5 w-5" aria-hidden="true" />
      </Link>
    </Button>
  );
}
