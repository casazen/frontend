export const LTR_AGREEMENTS_KEY = ['admin', 'ltr-reference-data', 'agreements'] as const;

export const LTR_IMU_CHANNELS_KEY = ['admin', 'ltr-reference-data', 'imu-channels'] as const;

export const ltrAgreementKey = (id: string) => [...LTR_AGREEMENTS_KEY, id] as const;

export const ltrAuditKey = (entityId: string) => ['admin', 'ltr-reference-data', 'audit', entityId] as const;
