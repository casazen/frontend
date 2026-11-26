import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { publicCheckinApi, type SelfiePose } from '@/api/checkin.api';
import { SelfieCapture } from '@/components/checkin';
import { Button } from '@/components/ui/button';

interface Props {
  token: string;
  attemptsRemaining: number | null;
  isProcessing: boolean;
  onRequestOperator: () => void;
  onCapture: (neutral: Blob, pose: SelfiePose) => Promise<boolean>;
}

type Challenge = Awaited<ReturnType<typeof publicCheckinApi.startSelfieChallenge>>;

export function ActiveSelfieCapture({ token, onCapture, ...controls }: Props) {
  const { t } = useTranslation();
  const [pose, setPose] = useState<{ neutral: Blob; challenge: Challenge } | null>(null);
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);

  const capture = async (image: Blob) => {
    if (pose) {
      if (Date.parse(pose.challenge.expiresAt) <= Date.now()) {
        setPose(null);
        setFailed(true);
        return true;
      }
      return onCapture(pose.neutral, { turnedSelfie: image, challengeToken: pose.challenge.challengeToken });
    }
    setStarting(true);
    setFailed(false);
    try {
      const challenge = await publicCheckinApi.startSelfieChallenge(token);
      if (!challenge.challengeToken || typeof challenge.noseToRight !== 'boolean' || !Number.isFinite(Date.parse(challenge.expiresAt))) {
        throw new Error('Invalid selfie challenge');
      }
      setPose({ neutral: image, challenge });
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setStarting(false);
    }
  };

  return (
    <>
      <SelfieCapture
        key={pose?.challenge.challengeToken ?? 'neutral'}
        {...controls}
        isProcessing={controls.isProcessing || starting}
        onCapture={capture}
        instruction={t(!pose ? 'checkin.biometric.capture.neutral' : pose.challenge.noseToRight
          ? 'checkin.biometric.capture.turnRight' : 'checkin.biometric.capture.turnLeft')}
        confirmLabel={pose ? undefined : t('checkin.next')}
      />
      {failed && <p role="alert">{t('checkin.biometric.capture.challengeFailed')}</p>}
      {pose && <Button type="button" variant="outline" disabled={controls.isProcessing} onClick={() => { setPose(null); setFailed(false); }}>
        {t('checkin.biometric.capture.restartPose')}
      </Button>}
      {(pose || failed) && <Button type="button" variant="ghost" disabled={controls.isProcessing} onClick={controls.onRequestOperator}>
        {t('checkin.identity.operator.ask')}
      </Button>}
    </>
  );
}
