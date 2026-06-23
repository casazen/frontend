import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/use-workspace';
import { useEmptyWorkspaceRecovery } from '@/hooks/use-empty-workspace-recovery';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Navigate } from 'react-router-dom';

export function ContextPickerPage() {
  const { contexts, isReady, setActiveContext } = useWorkspace();
  const isRecovering = useEmptyWorkspaceRecovery(contexts.length, isReady);

  if (!isReady || isRecovering) {
    return <LoadingScreen message="Caricamento..." />;
  }

  if (contexts.length === 0) {
    return <Navigate to="/app/no-access" replace />;
  }

  if (contexts.length === 1) {
    return <Navigate to={contexts[0].defaultRoute} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Seleziona workspace</CardTitle>
          <CardDescription>Scegli il contesto applicativo da aprire.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {contexts.map((context) => (
            <Button
              key={context.contextKey}
              variant="outline"
              className="w-full justify-start"
              onClick={() => setActiveContext(context.contextKey)}
            >
              {context.displayName}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
