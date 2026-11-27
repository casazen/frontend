import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { routinesApi } from '@/api/routines.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Operation = 'CreateCleaningRequest' | 'RequestReview';

export function RoutineActionAssist({ initialText, onApply }: { initialText: string; onApply: (type: Operation) => void }) {
  const { t } = useTranslation();
  const id = useId();
  const [instruction, setInstruction] = useState(initialText);
  const [suggestion, setSuggestion] = useState<Operation | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  async function suggest() {
    setSuggestion(null);
    setBusy(true);
    setFeedback('');
    try {
      const { type } = await routinesApi.suggestAction(instruction.trim());
      if (type === 'CreateCleaningRequest' || type === 'RequestReview') setSuggestion(type);
      else setFeedback('routines.assist.noMatch');
    } catch {
      setFeedback('routines.assist.unavailable');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <Label htmlFor={id}>{t('routines.assist.label')}</Label>
      <Input id={id} value={instruction} maxLength={500} disabled={busy}
        placeholder={t('routines.assist.example')} onChange={e => { setInstruction(e.target.value); setFeedback(''); setSuggestion(null); }} />
      <Button type="button" variant="outline" size="sm" disabled={busy || !instruction.trim()} onClick={suggest}>
        {t(busy ? 'routines.assist.loading' : 'routines.assist.suggest')}
      </Button>
      {suggestion && (
        <Button type="button" size="sm" onClick={() => onApply(suggestion)}>
          {t('routines.assist.use', { action: t(suggestion === 'RequestReview' ? 'routines.actionTypes.requestReview' : 'routines.actionTypes.createCleaningRequest') })}
        </Button>
      )}
      {feedback && <p role="status" className="text-sm">{t(feedback)}</p>}
    </div>
  );
}
