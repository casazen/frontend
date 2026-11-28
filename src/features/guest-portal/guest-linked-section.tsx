import type { ReactNode } from 'react';
import { generatePath, Navigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { linkedStayPaths, type LinkedStayAction } from './linked-stay-paths';
import './guest-portal.css';

export function GuestLinkedSection({ action, legacy = false, children }: {
  action: LinkedStayAction; legacy?: boolean; children: ReactNode;
}) {
  const { flags, isLoading } = useFeatureFlags();
  const params = useParams();
  const location = useLocation();
  const { t } = useTranslation();
  if (isLoading) return <p role="status">{t('embed.loading')}</p>;
  if (!flags.guestPortal) return <>{children}</>;
  if (legacy) {
    if (Object.values(params).some(value => !value || value === '.' || value === '..' || /[/\\]/.test(value))) return <>{children}</>;
    const pathname = generatePath<string>(linkedStayPaths[action], params);
    return <Navigate replace to={{ pathname, search: location.search, hash: location.hash }} />;
  }
  return <div className="guest-portal guest-linked-section">
    <header className="stay-header"><div className="stay-header-inner">
      <span className="stay-brand">{t('guestPortal.setup.title')}</span>
    </div></header>
    {children}
  </div>;
}
