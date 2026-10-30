import { createHash } from 'crypto';
import { describe, expect, test } from 'vitest';
import mimetypes from '../src/mimetypes.js';

describe('mimetypes', () => {
  test('checksum', async () => {
    const json = JSON.stringify(Object.fromEntries(mimetypes.entries()), null, 2);

    const hash = createHash('md5').update(json).digest('hex');

    expect(hash).toBe('b506fc6c70ca1d60c8aa52d3b1d245c4');
  });
});
