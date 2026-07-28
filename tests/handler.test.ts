import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { chmodSync, existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import * as fsPromises from 'node:fs/promises';
import { describe, expect, test, vi } from 'vitest';
import { HttpError } from '@chubbyts/chubbyts-http-error/dist/http-error';
import { ServerRequest } from '@chubbyts/chubbyts-undici-server/dist/server';
import { createStaticFileHandler } from '../src/handler';

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof fsPromises>()),
}));

const jpegHex = `
ffd8ffe000104a46494600010101012c012c0000fffe0013437265617465
6420776974682047494d50ffe202b04943435f50524f46494c4500010100
0002a06c636d73044000006d6e74725247422058595a2007e70003001a00
130013001b616373704150504c0000000000000000000000000000000000
000000000000000000f6d6000100000000d32d6c636d7300000000000000
000000000000000000000000000000000000000000000000000000000000
000000000000000000000d64657363000001200000004063707274000001
600000003677747074000001980000001463686164000001ac0000002c72
58595a000001d8000000146258595a000001ec000000146758595a000002
000000001472545243000002140000002067545243000002140000002062
54524300000214000000206368726d0000023400000024646d6e64000002
5800000024646d64640000027c000000246d6c7563000000000000000100
00000c656e5553000000240000001c00470049004d005000200062007500
69006c0074002d0069006e002000730052004700426d6c75630000000000
0000010000000c656e55530000001a0000001c005000750062006c006900
6300200044006f006d00610069006e000058595a20000000000000f6d600
0100000000d32d736633320000000000010c42000005defffff325000007
930000fd90fffffba1fffffda2000003dc0000c06e58595a200000000000
006fa0000038f50000039058595a20000000000000249f00000f840000b6
c458595a2000000000000062970000b787000018d9706172610000000000
030000000266660000f2a700000d59000013d000000a5b6368726d000000
00000300000000a3d70000547c00004ccd0000999a0000266700000f5c6d
6c756300000000000000010000000c656e5553000000080000001c004700
49004d00506d6c756300000000000000010000000c656e55530000000800
00001c0073005200470042ffdb0043000302020302020303030304030304
050805050404050a070706080c0a0c0c0b0a0b0b0d0e12100d0e110e0b0b
1016101113141515150c0f171816141812141514ffdb0043010304040504
0509050509140d0b0d141414141414141414141414141414141414141414
1414141414141414141414141414141414141414141414141414141414ff
c20011080001000103011100021101031101ffc400140001000000000000
00000000000000000008ffc4001401010000000000000000000000000000
0000ffda000c03010002100310000001549fffc400141001000000000000
00000000000000000000ffda00080101000105027fffc400141101000000
00000000000000000000000000ffda0008010301013f017fffc400141101
00000000000000000000000000000000ffda0008010201013f017fffc400
14100100000000000000000000000000000000ffda0008010100063f027f
ffc40014100100000000000000000000000000000000ffda000801010001
3f217fffda000c030100020003000000109fffc400141101000000000000
00000000000000000000ffda0008010301013f107fffc400141101000000
00000000000000000000000000ffda0008010201013f107fffc400141001
00000000000000000000000000000000ffda0008010100013f107fffd9
`.replace(/\s+/g, '');

const jpegEtag = '"0f1653b9b75fff62db7c49628e23a304"';

describe('handler', () => {
  test('with not supported algorithm', async () => {
    try {
      createStaticFileHandler('/unknown', new Map(), 'some-algo');
      throw new Error('Missing error');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toMatch(/Not supported hash algorithm: "some-algo", supported are: "([^"]+)", ".*"/);
    }
  });

  test('with missing file', async () => {
    const serverRequest = new ServerRequest('https://example.com/test.jpg');

    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;

    mkdirSync(publicDirectory, { recursive: true });

    const handler = createStaticFileHandler(publicDirectory, new Map());

    try {
      await handler(serverRequest);
      throw new Error('Missing error');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect({ ...(e as HttpError) }).toMatchInlineSnapshot(`
        {
          "_httpError": "NotFound",
          "detail": "There is no file at path "/test.jpg"",
          "status": 404,
          "title": "Not Found",
          "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.4.5",
        }
      `);
    }

    rmSync(publicDirectory, { recursive: true });
  });

  test('with missing public directory', async () => {
    const serverRequest = new ServerRequest('https://example.com/test.jpg');

    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;

    const handler = createStaticFileHandler(publicDirectory, new Map());

    try {
      await handler(serverRequest);
      throw new Error('Missing error');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(404);
    }
  });

  test('with file as public directory', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;

    writeFileSync(publicDirectory, 'test');

    const serverRequest = new ServerRequest('https://example.com/test.jpg');

    const handler = createStaticFileHandler(publicDirectory, new Map());

    try {
      await handler(serverRequest);
      throw new Error('Missing error');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(404);
    }

    rmSync(publicDirectory);
  });

  test('with directory', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.jpg';
    const filepath = publicDirectory + path;

    mkdirSync(publicDirectory, { recursive: true });
    mkdirSync(filepath);

    const serverRequest = new ServerRequest(`https://example.com${path}`);

    const handler = createStaticFileHandler(publicDirectory, new Map());

    try {
      await handler(serverRequest);
      throw new Error('Missing error');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect({ ...(e as HttpError) }).toMatchInlineSnapshot(`
        {
          "_httpError": "NotFound",
          "detail": "There is no file at path "/test.jpg"",
          "status": 404,
          "title": "Not Found",
          "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.4.5",
        }
      `);
    }

    rmSync(publicDirectory, { recursive: true });
  });

  test('with symlink pointing outside the public directory', async () => {
    const baseDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const publicDirectory = `${baseDirectory}/public`;
    const privateDirectory = `${baseDirectory}/public-private`;
    const path = '/secret.txt';

    mkdirSync(publicDirectory, { recursive: true });
    mkdirSync(privateDirectory, { recursive: true });

    writeFileSync(privateDirectory + path, 'must not be served');
    symlinkSync(privateDirectory + path, publicDirectory + path);

    const serverRequest = new ServerRequest(`https://example.com${path}`);

    const handler = createStaticFileHandler(publicDirectory, new Map());

    try {
      await handler(serverRequest);
      throw new Error('Missing error');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(404);
    }

    rmSync(baseDirectory, { recursive: true });
  });

  test.runIf(process.platform === 'linux')('with fifo', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.fifo';
    const filepath = publicDirectory + path;

    mkdirSync(publicDirectory, { recursive: true });

    execFileSync('mkfifo', [filepath]);

    const serverRequest = new ServerRequest(`https://example.com${path}`);

    const handler = createStaticFileHandler(publicDirectory, new Map());

    try {
      await handler(serverRequest);
      throw new Error('Missing error');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(404);
    }

    rmSync(publicDirectory, { recursive: true });
  });

  test.runIf(process.platform !== 'win32' && process.getuid?.() !== 0)('with unreadable file', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.txt';
    const filepath = publicDirectory + path;

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(filepath, 'test');
    chmodSync(filepath, 0o000);

    const serverRequest = new ServerRequest(`https://example.com${path}`);

    const handler = createStaticFileHandler(publicDirectory, new Map());

    try {
      await handler(serverRequest);
      throw new Error('Missing error');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(404);
    }

    chmodSync(filepath, 0o644);
    rmSync(publicDirectory, { recursive: true });
  });

  test('with file deleted between open and stat', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.txt';
    const filepath = publicDirectory + path;

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(filepath, 'test');

    const onClose = vi.fn();

    const realOpen = fsPromises.open;

    const openSpy = vi.spyOn(fsPromises, 'open').mockImplementationOnce(async (...args) => {
      const fileHandle = await realOpen(...(args as Parameters<typeof realOpen>));

      return new Proxy(fileHandle, {
        get: (target, property) => {
          if ('stat' === property) {
            return async () => {
              throw new Error('stat failed');
            };
          }

          if ('close' === property) {
            return async () => {
              onClose();

              return target.close();
            };
          }

          return Reflect.get(target, property, target);
        },
      });
    });

    const serverRequest = new ServerRequest(`https://example.com${path}`);

    const handler = createStaticFileHandler(publicDirectory, new Map());

    try {
      await handler(serverRequest);
      throw new Error('Missing error');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(404);
    }

    expect(onClose).toHaveBeenCalledTimes(1);

    openSpy.mockRestore();
    rmSync(publicDirectory, { recursive: true });
  });

  test.runIf(existsSync('/proc/self/mem'))('with readable but unhashable file', async () => {
    const serverRequest = new ServerRequest('https://example.com/mem');

    const handler = createStaticFileHandler('/proc/self', new Map());

    try {
      await handler(serverRequest);
      throw new Error('Missing error');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(404);
    }
  });

  test.each([['POST'], ['PUT'], ['PATCH'], ['DELETE'], ['OPTIONS']])('with not allowed method %s', async (method) => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.txt';

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(publicDirectory + path, 'test');

    const serverRequest = new ServerRequest(`https://example.com${path}`, { method });

    const handler = createStaticFileHandler(publicDirectory, new Map());

    try {
      await handler(serverRequest);
      throw new Error('Missing error');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(405);
      expect((e as HttpError).detail).toBe(`Method "${method}" is not allowed, allowed are "GET", "HEAD"`);
    }

    rmSync(publicDirectory, { recursive: true });
  });

  test('with head request', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.jpg';
    const filepath = publicDirectory + path;

    const data = Buffer.from(jpegHex, 'hex');

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(filepath, data);

    const serverRequest = new ServerRequest(`https://example.com${path}`, { method: 'HEAD' });

    const handler = createStaticFileHandler(publicDirectory, (await import('../src/mimetypes')).default);

    const response = await handler(serverRequest);

    expect(response.status).toBe(200);
    expect(response.statusText).toBe('OK');
    expect(Object.fromEntries(response.headers.entries())).toEqual({
      'content-length': '1229',
      'content-type': 'image/jpeg',
      etag: jpegEtag,
      'x-content-type-options': 'nosniff',
    });
    expect(response.body).toBeNull();

    rmSync(publicDirectory, { recursive: true });
  });

  test('with image', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.jpg';
    const filepath = publicDirectory + path;

    const data = Buffer.from(jpegHex, 'hex');

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(filepath, data);

    const serverRequest = new ServerRequest(`https://example.com${path}`);

    const handler = createStaticFileHandler(publicDirectory, (await import('../src/mimetypes')).default);

    const response = await handler(serverRequest);

    expect(response.status).toBe(200);
    expect(response.statusText).toBe('OK');
    expect(Object.fromEntries(response.headers.entries())).toEqual({
      'content-length': '1229',
      'content-type': 'image/jpeg',
      etag: jpegEtag,
      'x-content-type-options': 'nosniff',
    });
    expect(response.body).not.toBeNull();

    expect(Buffer.from(await response.arrayBuffer()).toString('hex')).toBe(jpegHex);

    rmSync(publicDirectory, { recursive: true });
  });

  test('with image and query string', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.jpg';
    const filepath = publicDirectory + path;

    const data = Buffer.from(jpegHex, 'hex');

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(filepath, data);

    const serverRequest = new ServerRequest(`https://example.com${path}?version=1`);

    const handler = createStaticFileHandler(publicDirectory, (await import('../src/mimetypes')).default);

    const response = await handler(serverRequest);

    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).toString('hex')).toBe(jpegHex);

    rmSync(publicDirectory, { recursive: true });
  });

  test.runIf(process.platform !== 'win32')('with filesystem root as public directory', async () => {
    const filepath = `${tmpdir()}/${randomBytes(16).toString('hex')}.txt`;

    writeFileSync(filepath, 'test');

    const serverRequest = new ServerRequest(`https://example.com${filepath}`);

    const handler = createStaticFileHandler('/', new Map());

    const response = await handler(serverRequest);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('test');

    rmSync(filepath);
  });

  test('with image and matching etag', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.jpg';
    const filepath = publicDirectory + path;

    const data = Buffer.from(jpegHex, 'hex');

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(filepath, data);

    const serverRequest = new ServerRequest(`https://example.com${path}`, {
      headers: { 'if-none-match': jpegEtag },
    });

    const handler = createStaticFileHandler(publicDirectory, (await import('../src/mimetypes')).default);

    const response = await handler(serverRequest);

    expect(response.status).toBe(304);
    expect(response.statusText).toBe('Not Modified');
    expect(Object.fromEntries(response.headers.entries())).toEqual({
      'content-length': '1229',
      'content-type': 'image/jpeg',
      etag: jpegEtag,
      'x-content-type-options': 'nosniff',
    });
    expect(response.body).toBeNull();

    rmSync(publicDirectory, { recursive: true });
  });

  test.each([
    ['wildcard', '*'],
    ['weak', `W/${jpegEtag}`],
    ['list', `"other", W/${jpegEtag}`],
  ])('with image and matching etag via %s', async (_, ifNoneMatch) => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.jpg';
    const filepath = publicDirectory + path;

    const data = Buffer.from(jpegHex, 'hex');

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(filepath, data);

    const serverRequest = new ServerRequest(`https://example.com${path}`, {
      headers: { 'if-none-match': ifNoneMatch },
    });

    const handler = createStaticFileHandler(publicDirectory, (await import('../src/mimetypes')).default);

    const response = await handler(serverRequest);

    expect(response.status).toBe(304);
    expect(response.body).toBeNull();

    rmSync(publicDirectory, { recursive: true });
  });

  test('with image and not matching etag', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.jpg';
    const filepath = publicDirectory + path;

    const data = Buffer.from(jpegHex, 'hex');

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(filepath, data);

    const serverRequest = new ServerRequest(`https://example.com${path}`, {
      headers: { 'if-none-match': '"other", W/"another"' },
    });

    const handler = createStaticFileHandler(publicDirectory, (await import('../src/mimetypes')).default);

    const response = await handler(serverRequest);

    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).toString('hex')).toBe(jpegHex);

    rmSync(publicDirectory, { recursive: true });
  });

  test('with existing file and unknown mime type', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.unknown';
    const filepath = publicDirectory + path;

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(filepath, 'test');

    const serverRequest = new ServerRequest(`https://example.com${path}`);

    const handler = createStaticFileHandler(publicDirectory, (await import('../src/mimetypes')).default);

    const response = await handler(serverRequest);

    expect(response.status).toBe(200);
    expect(response.statusText).toBe('OK');
    expect(Object.fromEntries(response.headers.entries())).toEqual({
      'content-length': '4',
      'content-type': 'application/octet-stream',
      etag: '"098f6bcd4621d373cade4e832627b4f6"',
      'x-content-type-options': 'nosniff',
    });
    expect(response.body).not.toBeNull();
    expect(await response.text()).toBe('test');

    rmSync(publicDirectory, { recursive: true });
  });

  test('with unknown file', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;

    mkdirSync(publicDirectory, { recursive: true });

    const serverRequest = new ServerRequest('https://example.com/test.unknown');

    const handler = createStaticFileHandler(publicDirectory, (await import('../src/mimetypes')).default);

    try {
      await handler(serverRequest);
      throw new Error('expect fail');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect({ ...(e as HttpError) }).toMatchInlineSnapshot(`
        {
          "_httpError": "NotFound",
          "detail": "There is no file at path "/test.unknown"",
          "status": 404,
          "title": "Not Found",
          "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.4.5",
        }
      `);
    }

    rmSync(publicDirectory, { recursive: true });
  });
});
