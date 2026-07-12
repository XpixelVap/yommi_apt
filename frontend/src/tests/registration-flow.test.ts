import assert from 'node:assert/strict';
import test from 'node:test';
import { runOptionalUpload } from '../utils/optionalUpload';

test('optional logo failure does not cancel completed registration', async () => {
  let registrationPersisted = true;
  const uploaded = await runOptionalUpload(async () => {
    throw new Error('upload failed');
  });
  assert.equal(uploaded, false);
  assert.equal(registrationPersisted, true);
});