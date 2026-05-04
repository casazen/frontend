import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Mail, User, Shield } from 'lucide-react';
import { getInitials } from '@/lib/utils';

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
  const userId = user.id || user.sub || 'N/A';
  const userName = user.name || 'Unknown User';
  const userEmail = user.email || 'N/A';
  const userRole = user.role || 'User';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            {user.picture ? (
              <img src={user.picture} alt={userName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary text-primary-foreground text-2xl font-semibold">
                {getInitials(userName)}
              </div>
            )}
          </Avatar>
          <div>
            <h3 className="text-xl font-semibold">{userName}</h3>
            <Badge variant="secondary" className="mt-1">
              {userRole}
            </Badge>
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{userEmail}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">User ID</p>
              <p className="font-mono text-sm">{userId}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <p className="font-medium capitalize">{userRole.toLowerCase()}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
