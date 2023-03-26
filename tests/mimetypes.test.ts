import { describe, expect, test } from '@jest/globals';
import { createHash } from 'crypto';
import mimetypes from '../src/mimetypes';

describe('mimetypes', () => {
  test('checksum', async () => {
    const json = JSON.stringify(Object.fromEntries(mimetypes.entries()), null, 2);

    const hash = createHash('md5').update(json).digest('hex');

    expect(hash).toBe('32557fe541d4524c086bd81cf95b81da');
  });
});
