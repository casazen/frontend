import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Mail, User } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { getRoleLabel } from '@/lib/i18n-labels';

interface ProfileInfoProps {
  user: {
    name?: string;
    email?: string;
    picture?: string;
    sub?: string;
    role?: string;
    id?: string;
  };
}

export function ProfileInfo({ user }: ProfileInfoProps) {
  const { t } = useTranslation();
  const userId = user.id || user.sub || t('profile.notAvailable');
  const userName = user.name || t('profile.unknownUser');
  const userEmail = user.email || t('profile.notAvailable');
  const userRole = user.role ? getRoleLabel(user.role, t) : t('profile.user');

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-surface-2 px-5 py-4">
        <CardTitle className="text-base">{t('profile.profileInformation')}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex items-center gap-4 bg-primary-soft px-5 py-6 sm:px-7">
          <Avatar className="size-16 shrink-0 ring-4 ring-card">
            {user.picture ? (
              <img src={user.picture} alt={userName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary text-primary-foreground text-2xl font-semibold">
                {getInitials(userName)}
              </div>
            )}
          </Avatar>
          <div className="min-w-0">
            <h3 className="break-words text-2xl font-semibold tracking-tight">{userName}</h3>
            <Badge aria-label={t('profile.role') + ": " + userRole} variant="secondary" className="mt-2">
              {userRole}
            </Badge>
          </div>
        </div>

        <dl className="divide-y px-5 sm:px-7">
          <div className="flex items-start gap-3 py-4">
            <Mail aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-sm text-muted-foreground">{t('profile.email')}</dt>
              <dd className="break-all font-medium">{userEmail}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3 py-4">
            <User aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-sm text-muted-foreground">{t('profile.userId')}</dt>
              <dd className="break-all font-mono text-sm">{userId}</dd>
            </div>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
