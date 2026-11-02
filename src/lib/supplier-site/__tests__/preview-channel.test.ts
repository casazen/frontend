import { describe, expect, it } from 'vitest';
import { buildPreviewMessage, buildPreviewReady, PREVIEW_READY_TYPE, readPreviewMessage } from '../preview-channel';

describe('preview channel: the draft the editor sends to the frame', () => {
  const parent = {};
  const self = { origin: 'https://www.casazen.space', parent };
  const draft = { tagline: 'Case vacanza sempre pronte', faq: [{ q: 'Quanto costa?', a: 'Dipende.' }] };
  const fromParent = (data: unknown, origin = self.origin, source: unknown = parent) => ({ origin, source: source as MessageEventSource, data });

  it('readPreviewMessage_ParentOfTheSameOrigin_GivesTheDraft', () => {
    expect(readPreviewMessage(fromParent(buildPreviewMessage(draft)), self)).toEqual(draft);
  });

  it('readPreviewMessage_OtherOrigin_IsDropped', () => {
    expect(readPreviewMessage(fromParent(buildPreviewMessage(draft), 'https://evil.example'), self)).toBeNull();
  });

  it('readPreviewMessage_OrderOfTheServices_PassesAsLongAsItIsWithinTheContract', () => {
    const withOrder = { ...draft, serviceOrder: ['pulizie', 'bucato'] };
    expect(readPreviewMessage(fromParent(buildPreviewMessage(withOrder)), self)).toEqual(withOrder);
    const tooMany = { ...draft, serviceOrder: Array.from({ length: 31 }, (_, index) => `servizio-${index}`) };
    expect(readPreviewMessage(fromParent(buildPreviewMessage(tooMany)), self)).toBeNull();
  });

  it('readPreviewMessage_NotFromTheParentThatFramesThePage_IsDropped', () => {
    expect(readPreviewMessage(fromParent(buildPreviewMessage(draft), self.origin, {}), self)).toBeNull();
    expect(readPreviewMessage(fromParent(buildPreviewMessage(draft), self.origin, null), self)).toBeNull();
  });

  it('readPreviewMessage_OtherTypeVersionOrShape_IsDropped', () => {
    const valid = buildPreviewMessage(draft);
    expect(readPreviewMessage(fromParent({ ...valid, type: 'something-else' }), self)).toBeNull();
    expect(readPreviewMessage(fromParent({ ...valid, schemaVersion: 2 }), self)).toBeNull();
    expect(readPreviewMessage(fromParent({ ...valid, content: 'not an object' }), self)).toBeNull();
    expect(readPreviewMessage(fromParent({ ...valid, content: { faq: 'nope' } }), self)).toBeNull();
    expect(readPreviewMessage(fromParent({ ...valid, content: { tagline: 'x'.repeat(5000) } }), self)).toBeNull();
    expect(readPreviewMessage(fromParent(null), self)).toBeNull();
  });

  it('readPreviewMessage_MembersOutsideTheContract_AreDropped', () => {
    const message = buildPreviewMessage({ ...draft, phone: '+39 06 1234567', email: 'a@b.it' } as never);
    const content = readPreviewMessage(fromParent(message), self);

    expect(content).toEqual(draft);
    expect(content).not.toHaveProperty('phone');
    expect(content).not.toHaveProperty('email');
  });

  it('buildPreviewReady_SaysItIsReady', () => {
    expect(buildPreviewReady().type).toBe(PREVIEW_READY_TYPE);
  });
});
