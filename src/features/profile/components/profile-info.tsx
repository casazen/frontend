import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Mail, User, Shield } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import type { User as UserType } from '@/types';

interface ProfileInfoProps {
  user: UserType;
}

export function ProfileInfo({ user }: ProfileInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <div className="flex h-full w-full items-center justify-center bg-primary text-primary-foreground text-2xl font-semibold">
              {getInitials(user.name)}
            </div>
          </Avatar>
          <div>
            <h3 className="text-xl font-semibold">{user.name}</h3>
            <Badge variant="secondary" className="mt-1">
              {user.role}
            </Badge>
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">User ID</p>
              <p className="font-mono text-sm">{user.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <p className="font-medium capitalize">{user.role.toLowerCase()}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
