import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

export function LinkProblem({ message, action, testId }: { message: string; action: ReactNode; testId: string }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 text-center" data-testid={testId}>
      <AlertCircle className="mx-auto size-10 text-destructive" aria-hidden="true" />
      <p role="alert">{message}</p>
      <div className="flex justify-center">{action}</div>
    </div>
  );
}
