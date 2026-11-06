import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FOCUS_PARAM } from './checkin-wizard-model';

/**
 * A "Fix" of the checks (or a failed save) leads to a step with `?focus=<id of a field>`: once the step is on screen the focus goes to that
 * field, and the parameter is dropped, so that a reload or "back" does not move the focus again. It waits a frame: the wizard puts the
 * focus on the title of the new step when it opens, and the field must come after that.
 */
export function useFocusFromAddress(): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const target = searchParams.get(FOCUS_PARAM);

  useEffect(() => {
    if (!target) return undefined;
    const frame = requestAnimationFrame(() => {
      document.getElementById(target)?.focus();
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete(FOCUS_PARAM);
          return next;
        },
        { replace: true },
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [target, setSearchParams]);
}
