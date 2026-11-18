import { beforeEach, describe, expect, it } from 'vitest';
import { clearAllWizardDrafts } from '@/lib/wizard-draft';
import { forgetPropertyStep, readPropertyStep, rememberPropertyStep } from '../property-setup-progress';

const scope = { userId: 'writer-a', orgId: 'organization-a' };
describe('the saved property setup location', () => {
  beforeEach(() => sessionStorage.clear());

  it('keeps only the property reference and step, scoped to the writer and organization', () => {
    rememberPropertyStep(scope, 'p1', 'photos');
    expect(readPropertyStep(scope)).toEqual({ propertyId: 'p1', step: 'photos' });
    expect(JSON.parse(sessionStorage.getItem(sessionStorage.key(0)!)!).values).toEqual({ propertyId: 'p1' });
    expect(readPropertyStep({ ...scope, orgId: 'organization-b' })).toBeNull();
    expect(readPropertyStep({ ...scope, userId: 'writer-b' })).toBeNull();
    clearAllWizardDrafts();
    expect(readPropertyStep(scope)).toBeNull();
  });

  it('ignores unknown steps and finishing another property preserves the current one', () => {
    rememberPropertyStep(scope, 'p2', 'prices');
    rememberPropertyStep(scope, 'p2', 'unrecognized');
    forgetPropertyStep(scope, 'p1');
    expect(readPropertyStep(scope)).toEqual({ propertyId: 'p2', step: 'prices' });
    forgetPropertyStep(scope, 'p2');
    expect(readPropertyStep(scope)).toBeNull();
  });
});
