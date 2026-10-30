import { tmpdir } from 'os';
import { createHash, randomBytes } from 'crypto';
import { appendFileSync, chmodSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import * as fsPromises from 'node:fs/promises';
import { Readable } from 'node:stream';
import { buffer, text } from 'node:stream/consumers';
import { describe, expect, test, vi } from 'vitest';
import { HttpError } from '@chubbyts/chubbyts-http-error/dist/http-error';
import { createResponseFactory, createServerRequestFactory } from '@chubbyts/chubbyts-http/message-factory';
import { createResponseHelpers, createServerRequestHelpers } from '@chubbyts/chubbyts-http/message-helper';
import type { Method, ServerRequest } from '@chubbyts/chubbyts-http-types/message';
import type { HeaderValue } from '@chubbyts/chubbyts-http-types/message-helper';
import { createStaticFileHandler } from '../src/handler.js';

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

// @chubbyts/chubbyts-http is used as implementation of the types
const serverRequestFactory = createServerRequestFactory();
const serverRequestHelpers = createServerRequestHelpers();
const responseFactory = createResponseFactory();
const responseHelpers = createResponseHelpers();

const createRequest = (uri: string, method: Method = 'GET', headers: Record<string, HeaderValue> = {}): ServerRequest =>
  Object.entries(headers).reduce(
    (request, [name, value]) => serverRequestHelpers.withHeader(request, name, value),
    serverRequestFactory(method, uri),
  );

const jpegEtag = '"0f1653b9b75fff62db7c49628e23a304"';

describe('handler', () => {
  test('with not supported algorithm', async () => {
    try {
      createStaticFileHandler(responseFactory, responseHelpers, '/unknown', new Map(), 'some-algo');
      throw new Error('Missing error');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toMatch(/Not supported hash algorithm: "some-algo", supported are: "([^"]+)", ".*"/);
    }
  });

  test.each([[undefined], ['']])('with invalid public directory %j', (publicDirectory) => {
    expect(() =>
      createStaticFileHandler(responseFactory, responseHelpers, publicDirectory as unknown as string, new Map()),
    ).toThrow(`Public directory needs to be a non-empty string, "${String(publicDirectory)}" given`);
  });

  test('with missing file', async () => {
    const serverRequest = createRequest('https://example.com/test.jpg');

    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;

    mkdirSync(publicDirectory, { recursive: true });

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

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
    const serverRequest = createRequest('https://example.com/test.jpg');

    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

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

    const serverRequest = createRequest('https://example.com/test.jpg');

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

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

    const serverRequest = createRequest(`https://example.com${path}`);

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

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

    const serverRequest = createRequest(`https://example.com${path}`);

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

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

    const serverRequest = createRequest(`https://example.com${path}`);

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

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

    const serverRequest = createRequest(`https://example.com${path}`);

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

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

  test('with failing stat of the opened file', async () => {
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

    const serverRequest = createRequest(`https://example.com${path}`);

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

    await expect(handler(serverRequest)).rejects.toThrow('stat failed');

    expect(onClose).toHaveBeenCalledTimes(1);

    openSpy.mockRestore();
    rmSync(publicDirectory, { recursive: true });
  });

  test('with read error while hashing', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.txt';

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(publicDirectory + path, 'test');

    const onClose = vi.fn();

    const realOpen = fsPromises.open;

    const openSpy = vi.spyOn(fsPromises, 'open').mockImplementationOnce(async (...args) => {
      const fileHandle = await realOpen(...(args as Parameters<typeof realOpen>));

      return new Proxy(fileHandle, {
        get: (target, property) => {
          if ('createReadStream' === property) {
            return () =>
              new Readable({
                read() {
                  this.destroy(new Error('read failed'));
                },
              });
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

    const serverRequest = createRequest(`https://example.com${path}`);

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

    await expect(handler(serverRequest)).rejects.toThrow('read failed');

    expect(onClose).toHaveBeenCalledTimes(1);

    openSpy.mockRestore();
    rmSync(publicDirectory, { recursive: true });
  });

  test('with not file related error', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.txt';

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(publicDirectory + path, 'test');

    const openSpy = vi.spyOn(fsPromises, 'open').mockImplementationOnce(async () => {
      // e.g. EMFILE, which is no client error
      throw new Error('too many open files');
    });

    const serverRequest = createRequest(`https://example.com${path}`);

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

    await expect(handler(serverRequest)).rejects.toThrow('too many open files');

    openSpy.mockRestore();
    rmSync(publicDirectory, { recursive: true });
  });

  test.runIf(process.platform !== 'win32')('with symlink swapped in after resolving', async () => {
    const baseDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const publicDirectory = `${baseDirectory}/public`;
    const path = '/test.txt';

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(`${baseDirectory}/secret.txt`, 'must not be served');
    symlinkSync(`${baseDirectory}/secret.txt`, publicDirectory + path);

    const realRealpath = fsPromises.realpath;

    // simulates the race: the path got resolved while it still was a file within the public directory
    const realpathSpy = vi
      .spyOn(fsPromises, 'realpath')
      .mockImplementationOnce(async (...args) => realRealpath(...(args as Parameters<typeof realRealpath>)))
      .mockImplementationOnce(async () => `${await realRealpath(publicDirectory)}${path}`);

    const serverRequest = createRequest(`https://example.com${path}`);

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

    try {
      await handler(serverRequest);
      throw new Error('Missing error');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(404);
    }

    realpathSpy.mockRestore();
    rmSync(baseDirectory, { recursive: true });
  });

  test.each([['POST'], ['PUT'], ['PATCH'], ['DELETE'], ['OPTIONS']])('with not allowed method %s', async (method) => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.txt';

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(publicDirectory + path, 'test');

    const serverRequest = createRequest(`https://example.com${path}`, method);

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

    try {
      await handler(serverRequest);
      throw new Error('Missing error');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(405);
      expect((e as HttpError).detail).toBe(`Method "${method}" is not allowed, allowed are "GET", "HEAD"`);
      expect((e as HttpError).headers).toEqual({ allow: 'GET, HEAD' });
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

    const serverRequest = createRequest(`https://example.com${path}`, 'HEAD');

    const handler = createStaticFileHandler(
      responseFactory,
      responseHelpers,
      publicDirectory,
      (await import('../src/mimetypes.js')).default,
    );

    const response = await handler(serverRequest);

    expect(response.status).toBe(200);
    expect(response.reasonPhrase).toBe('OK');
    expect(response.headers).toEqual({
      'content-length': ['1229'],
      'content-type': ['image/jpeg'],
      etag: [jpegEtag],
      'x-content-type-options': ['nosniff'],
    });
    expect(await text(response.body)).toBe('');

    rmSync(publicDirectory, { recursive: true });
  });

  test('with image', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.jpg';
    const filepath = publicDirectory + path;

    const data = Buffer.from(jpegHex, 'hex');

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(filepath, data);

    const serverRequest = createRequest(`https://example.com${path}`);

    const handler = createStaticFileHandler(
      responseFactory,
      responseHelpers,
      publicDirectory,
      (await import('../src/mimetypes.js')).default,
    );

    const response = await handler(serverRequest);

    expect(response.status).toBe(200);
    expect(response.reasonPhrase).toBe('OK');
    expect(response.headers).toEqual({
      'content-length': ['1229'],
      'content-type': ['image/jpeg'],
      etag: [jpegEtag],
      'x-content-type-options': ['nosniff'],
    });
    expect((await buffer(response.body)).toString('hex')).toBe(jpegHex);

    rmSync(publicDirectory, { recursive: true });
  });

  test('with image and query string', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.jpg';
    const filepath = publicDirectory + path;

    const data = Buffer.from(jpegHex, 'hex');

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(filepath, data);

    const serverRequest = createRequest(`https://example.com${path}?version=1`);

    const handler = createStaticFileHandler(
      responseFactory,
      responseHelpers,
      publicDirectory,
      (await import('../src/mimetypes.js')).default,
    );

    const response = await handler(serverRequest);

    expect(response.status).toBe(200);
    expect((await buffer(response.body)).toString('hex')).toBe(jpegHex);

    rmSync(publicDirectory, { recursive: true });
  });

  test.runIf(process.platform !== 'win32')('with filesystem root as public directory', async () => {
    const filepath = `${tmpdir()}/${randomBytes(16).toString('hex')}.txt`;

    writeFileSync(filepath, 'test');

    const serverRequest = createRequest(`https://example.com${filepath}`);

    const handler = createStaticFileHandler(responseFactory, responseHelpers, '/', new Map());

    const response = await handler(serverRequest);

    expect(response.status).toBe(200);
    expect(await text(response.body)).toBe('test');

    rmSync(filepath);
  });

  test('with image and matching etag', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.jpg';
    const filepath = publicDirectory + path;

    const data = Buffer.from(jpegHex, 'hex');

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(filepath, data);

    const serverRequest = createRequest(`https://example.com${path}`, 'GET', { 'if-none-match': jpegEtag });

    const handler = createStaticFileHandler(
      responseFactory,
      responseHelpers,
      publicDirectory,
      (await import('../src/mimetypes.js')).default,
    );

    const response = await handler(serverRequest);

    expect(response.status).toBe(304);
    expect(response.reasonPhrase).toBe('Not Modified');
    expect(response.headers).toEqual({
      'content-length': ['1229'],
      'content-type': ['image/jpeg'],
      etag: [jpegEtag],
      'x-content-type-options': ['nosniff'],
    });
    expect(await text(response.body)).toBe('');

    rmSync(publicDirectory, { recursive: true });
  });

  test.each([
    ['wildcard', '*'],
    ['weak', `W/${jpegEtag}`],
    ['list', `"other", W/${jpegEtag}`],
    ['multiple header values', ['"other"', `W/${jpegEtag}`]],
  ])('with image and matching etag via %s', async (_, ifNoneMatch) => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.jpg';
    const filepath = publicDirectory + path;

    const data = Buffer.from(jpegHex, 'hex');

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(filepath, data);

    const serverRequest = createRequest(`https://example.com${path}`, 'GET', { 'if-none-match': ifNoneMatch });

    const handler = createStaticFileHandler(
      responseFactory,
      responseHelpers,
      publicDirectory,
      (await import('../src/mimetypes.js')).default,
    );

    const response = await handler(serverRequest);

    expect(response.status).toBe(304);
    expect(await text(response.body)).toBe('');

    rmSync(publicDirectory, { recursive: true });
  });

  test('with image and not matching etag', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.jpg';
    const filepath = publicDirectory + path;

    const data = Buffer.from(jpegHex, 'hex');

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(filepath, data);

    const serverRequest = createRequest(`https://example.com${path}`, 'GET', {
      'if-none-match': '"other", W/"another"',
    });

    const handler = createStaticFileHandler(
      responseFactory,
      responseHelpers,
      publicDirectory,
      (await import('../src/mimetypes.js')).default,
    );

    const response = await handler(serverRequest);

    expect(response.status).toBe(200);
    expect((await buffer(response.body)).toString('hex')).toBe(jpegHex);

    rmSync(publicDirectory, { recursive: true });
  });

  test('with existing file and unknown mime type', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.unknown';
    const filepath = publicDirectory + path;

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(filepath, 'test');

    const serverRequest = createRequest(`https://example.com${path}`);

    const handler = createStaticFileHandler(
      responseFactory,
      responseHelpers,
      publicDirectory,
      (await import('../src/mimetypes.js')).default,
    );

    const response = await handler(serverRequest);

    expect(response.status).toBe(200);
    expect(response.reasonPhrase).toBe('OK');
    expect(response.headers).toEqual({
      'content-length': ['4'],
      'content-type': ['application/octet-stream'],
      etag: ['"098f6bcd4621d373cade4e832627b4f6"'],
      'x-content-type-options': ['nosniff'],
    });
    expect(await text(response.body)).toBe('test');

    rmSync(publicDirectory, { recursive: true });
  });

  test('with unknown file', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;

    mkdirSync(publicDirectory, { recursive: true });

    const serverRequest = createRequest('https://example.com/test.unknown');

    const handler = createStaticFileHandler(
      responseFactory,
      responseHelpers,
      publicDirectory,
      (await import('../src/mimetypes.js')).default,
    );

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

  test.each([
    ['space', 'with space.txt', '/with%20space.txt'],
    ['unicode', 'café.txt', '/caf%C3%A9.txt'],
    ['percent', '100%.txt', '/100%25.txt'],
  ])('with percent encoded path (%s)', async (_, filename, path) => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(`${publicDirectory}/${filename}`, 'test');

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

    const response = await handler(createRequest(`https://example.com${path}`));

    expect(response.status).toBe(200);
    expect(await text(response.body)).toBe('test');

    rmSync(publicDirectory, { recursive: true });
  });

  test.each([
    ['malformed encoding', '/%E0%A4%A.txt'],
    ['null byte', '/test.txt%00.jpg'],
    ['encoded traversal', '/%2e%2e/%2e%2e/etc/passwd'],
    ['too long name', `/${'a'.repeat(1024)}.txt`],
  ])('with invalid path (%s)', async (_, path) => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(`${publicDirectory}/test.txt`, 'test');

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

    try {
      await handler(createRequest(`https://example.com${path}`));
      throw new Error('Missing error');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(404);
    }

    rmSync(publicDirectory, { recursive: true });
  });

  test('with uppercase extension', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/TEST.JPG';

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(publicDirectory + path, Buffer.from(jpegHex, 'hex'));

    const handler = createStaticFileHandler(
      responseFactory,
      responseHelpers,
      publicDirectory,
      (await import('../src/mimetypes.js')).default,
    );

    const response = await handler(createRequest(`https://example.com${path}`));

    expect(response.headers['content-type']).toEqual(['image/jpeg']);
    expect((await buffer(response.body)).toString('hex')).toBe(jpegHex);

    rmSync(publicDirectory, { recursive: true });
  });

  test('with empty file', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.txt';

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(publicDirectory + path, '');

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

    const response = await handler(createRequest(`https://example.com${path}`));

    expect(response.status).toBe(200);
    expect(response.headers['content-length']).toEqual(['0']);
    expect(response.headers.etag).toEqual(['"d41d8cd98f00b204e9800998ecf8427e"']);
    expect(await text(response.body)).toBe('');

    rmSync(publicDirectory, { recursive: true });
  });

  test('with file growing after the response got created', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.txt';

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(publicDirectory + path, 'test');

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

    const response = await handler(createRequest(`https://example.com${path}`));

    appendFileSync(publicDirectory + path, ' appended');

    // the body matches the content-length and the etag
    expect(response.headers['content-length']).toEqual(['4']);
    expect(response.headers.etag).toEqual(['"098f6bcd4621d373cade4e832627b4f6"']);
    expect(await text(response.body)).toBe('test');

    rmSync(publicDirectory, { recursive: true });
  });

  test('with file grown since its size got read', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.txt';

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(publicDirectory + path, 'test');

    const realOpen = fsPromises.open;

    // the size got read before the last byte got written
    const openSpy = vi.spyOn(fsPromises, 'open').mockImplementationOnce(async (...args) => {
      const fileHandle = await realOpen(...(args as Parameters<typeof realOpen>));

      return new Proxy(fileHandle, {
        get: (target, property) => {
          if ('stat' === property) {
            return async () => ({ isFile: () => true, size: 3 });
          }

          return Reflect.get(target, property, target);
        },
      });
    });

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

    const response = await handler(createRequest(`https://example.com${path}`));

    expect(response.headers['content-length']).toEqual(['3']);
    expect(response.headers.etag).toEqual(['"' + createHash('md5').update('tes').digest('hex') + '"']);
    expect(await text(response.body)).toBe('tes');

    openSpy.mockRestore();
    rmSync(publicDirectory, { recursive: true });
  });

  test('with aborted request before the body got consumed', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.txt';

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(publicDirectory + path, 'test');

    const abortController = new AbortController();

    const serverRequest = serverRequestHelpers.withSignal(
      createRequest(`https://example.com${path}`),
      abortController.signal,
    );

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

    const response = await handler(serverRequest);

    const body = response.body as Readable;

    const closed = new Promise((resolve) => body.once('close', resolve));

    abortController.abort();

    await closed;

    expect(body.destroyed).toBe(true);

    rmSync(publicDirectory, { recursive: true });
  });

  test('with already aborted request', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.txt';
    const size = 1024 * 1024;

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(publicDirectory + path, randomBytes(size));

    const realOpen = fsPromises.open;

    const onStream = vi.fn<(stream: ReturnType<fsPromises.FileHandle['createReadStream']>) => void>();

    const openSpy = vi.spyOn(fsPromises, 'open').mockImplementationOnce(async (...args) => {
      const fileHandle = await realOpen(...(args as Parameters<typeof realOpen>));

      return new Proxy(fileHandle, {
        get: (target, property) => {
          if ('createReadStream' === property) {
            return (...streamArgs: Parameters<typeof target.createReadStream>) => {
              const stream = target.createReadStream(...streamArgs);
              onStream(stream);

              return stream;
            };
          }

          return Reflect.get(target, property, target);
        },
      });
    });

    const serverRequest = serverRequestHelpers.withSignal(
      createRequest(`https://example.com${path}`),
      AbortSignal.abort(),
    );

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

    await expect(handler(serverRequest)).rejects.toMatchObject({ name: 'AbortError' });

    // the hashing stopped early
    expect(onStream).toHaveBeenCalledTimes(1);
    expect(onStream.mock.calls[0][0].bytesRead).toBeLessThan(size);

    openSpy.mockRestore();
    rmSync(publicDirectory, { recursive: true });
  });

  test('with request aborted after the last chunk got hashed', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.txt';

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(publicDirectory + path, 'test');

    const abortController = new AbortController();

    const realOpen = fsPromises.open;

    const openSpy = vi.spyOn(fsPromises, 'open').mockImplementationOnce(async (...args) => {
      const fileHandle = await realOpen(...(args as Parameters<typeof realOpen>));

      return new Proxy(fileHandle, {
        get: (target, property) => {
          if ('createReadStream' === property) {
            return (...streamArgs: Parameters<typeof target.createReadStream>) =>
              target.createReadStream(...streamArgs).once('end', () => abortController.abort());
          }

          return Reflect.get(target, property, target);
        },
      });
    });

    const serverRequest = serverRequestHelpers.withSignal(
      createRequest(`https://example.com${path}`),
      abortController.signal,
    );

    const handler = createStaticFileHandler(responseFactory, responseHelpers, publicDirectory, new Map());

    await expect(handler(serverRequest)).rejects.toMatchObject({ name: 'AbortError' });

    openSpy.mockRestore();
    rmSync(publicDirectory, { recursive: true });
  });
});
