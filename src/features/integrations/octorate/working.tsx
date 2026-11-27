import { Spinner } from '@/components/ui/spinner';

/** A line of work in progress (the spinner announces it): the listings being read or shown, the state of the connection being read, or the code being exchanged. */
export function Working({ message, testId }: { message: string; testId: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg bg-muted p-4 text-sm" data-testid={testId}>
      <Spinner size="sm" />
      <span className="min-w-0 break-words">{message}</span>
    </div>
  );
}
