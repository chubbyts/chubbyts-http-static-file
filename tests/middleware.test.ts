import { describe, expect, test } from '@jest/globals';
import { Response, ServerRequest } from '@chubbyts/chubbyts-http-types/dist/message';
import { createStaticFileMiddleware } from '../src/middleware';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { createReadStream, mkdirSync, rmSync, writeFileSync } from 'fs';
import { Duplex, PassThrough, Stream } from 'stream';

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

const readStream = async (stream: Stream) => {
  return new Promise((resolve, reject) => {
    let data = '';

    stream.on('data', (chunk) => (data += chunk));
    stream.on('end', () => resolve(data));
    stream.on('error', (error) => reject(error));
  });
};

describe('middleware', () => {
  test('with not supported algorithm', async () => {
    const responseFactory = jest.fn();
    const streamFromFileFactory = jest.fn();
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;

    try {
      createStaticFileMiddleware(responseFactory, streamFromFileFactory, '/unknown', 'some-algo');
      throw new Error('Missing error');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toMatch(/Not supported hash algorithm: "some-algo", supported are: "([^"]+)", ".*"/);
    }

    expect(responseFactory).toHaveBeenCalledTimes(0);
    expect(streamFromFileFactory).toHaveBeenCalledTimes(0);
  });

  test('with missing file', async () => {
    const request = { uri: { path: '/test.jpg' } } as ServerRequest;
    const response = {} as Response;

    const handler = jest.fn(async (givenRequest: ServerRequest): Promise<Response> => {
      expect(givenRequest).toBe(request);

      return response;
    });

    const responseFactory = jest.fn();
    const streamFromFileFactory = jest.fn();
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;

    mkdirSync(publicDirectory, { recursive: true });

    const middleware = createStaticFileMiddleware(responseFactory, streamFromFileFactory, publicDirectory);

    await middleware(request, handler);

    rmSync(publicDirectory, { recursive: true });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(responseFactory).toHaveBeenCalledTimes(0);
    expect(streamFromFileFactory).toHaveBeenCalledTimes(0);
  });

  test('with directory', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.jpg';
    const filepath = publicDirectory + path;

    mkdirSync(publicDirectory, { recursive: true });
    mkdirSync(filepath);

    const request = { uri: { path } } as ServerRequest;
    const response = {} as Response;

    const handler = jest.fn(async (givenRequest: ServerRequest): Promise<Response> => {
      expect(givenRequest).toBe(request);

      return response;
    });

    const responseFactory = jest.fn();
    const streamFromFileFactory = jest.fn();

    const middleware = createStaticFileMiddleware(responseFactory, streamFromFileFactory, publicDirectory);

    await middleware(request, handler);

    rmSync(publicDirectory, { recursive: true });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(responseFactory).toHaveBeenCalledTimes(0);
    expect(streamFromFileFactory).toHaveBeenCalledTimes(0);
  });

  test('with image', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.jpg';
    const filepath = publicDirectory + path;

    const data = Buffer.from(jpegHex, 'hex');

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(filepath, data);

    const request = { headers: {}, uri: { path } } as ServerRequest;
    const response = { headers: {} } as Response;

    const handler = jest.fn(async (givenRequest: ServerRequest): Promise<Response> => {
      expect(givenRequest).toBe(request);

      return response;
    });

    const responseFactory = jest.fn((givenStatus) => {
      expect(givenStatus).toBe(200);

      return response;
    });

    const streamFromFileFactory = jest.fn((filepath) => {
      const newStream = new PassThrough();
      createReadStream(filepath).pipe(newStream);
      return newStream;
    });

    const middleware = createStaticFileMiddleware(responseFactory, streamFromFileFactory, publicDirectory);

    const middlewareResponse = await middleware(request, handler);

    expect(middlewareResponse).toEqual({
      ...response,
      body: expect.any(Duplex),
      headers: {
        'content-length': ['1229'],
        'content-type': ['image/jpeg'],
        etag: ['0f1653b9b75fff62db7c49628e23a304'],
      },
    });

    await readStream(middlewareResponse.body);

    rmSync(publicDirectory, { recursive: true });

    expect(handler).toHaveBeenCalledTimes(0);
    expect(responseFactory).toHaveBeenCalledTimes(1);
    expect(streamFromFileFactory).toHaveBeenCalledTimes(1);
  });

  test('with image and matching etag', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.jpg';
    const filepath = publicDirectory + path;

    const data = Buffer.from(jpegHex, 'hex');

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(filepath, data);

    const request = {
      headers: { 'if-none-match': ['0f1653b9b75fff62db7c49628e23a304'] },
      uri: { path },
    } as unknown as ServerRequest;

    const end = jest.fn();

    const response = { headers: {}, body: { end } } as unknown as Response;

    const handler = jest.fn(async (givenRequest: ServerRequest): Promise<Response> => {
      expect(givenRequest).toBe(request);

      return response;
    });

    const responseFactory = jest.fn((givenStatus) => {
      expect(givenStatus).toBe(304);

      return response;
    });

    const streamFromFileFactory = jest.fn();

    const middleware = createStaticFileMiddleware(responseFactory, streamFromFileFactory, publicDirectory);

    const middlewareResponse = await middleware(request, handler);

    expect(middlewareResponse).toEqual({
      ...response,
      headers: {
        'content-length': ['1229'],
        'content-type': ['image/jpeg'],
        etag: ['0f1653b9b75fff62db7c49628e23a304'],
      },
    });

    rmSync(publicDirectory, { recursive: true });

    expect(end).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(0);
    expect(responseFactory).toHaveBeenCalledTimes(1);
    expect(streamFromFileFactory).toHaveBeenCalledTimes(0);
  });

  test('with unknown file', async () => {
    const publicDirectory = `${tmpdir()}/${randomBytes(16).toString('hex')}`;
    const path = '/test.unknown';
    const filepath = publicDirectory + path;

    mkdirSync(publicDirectory, { recursive: true });

    writeFileSync(filepath, '-');

    const request = { headers: {}, uri: { path } } as ServerRequest;
    const response = { headers: {} } as Response;

    const handler = jest.fn(async (givenRequest: ServerRequest): Promise<Response> => {
      expect(givenRequest).toBe(request);

      return response;
    });

    const responseFactory = jest.fn((givenStatus) => {
      expect(givenStatus).toBe(200);

      return response;
    });

    const streamFromFileFactory = jest.fn((filepath) => {
      const newStream = new PassThrough();
      createReadStream(filepath).pipe(newStream);
      return newStream;
    });

    const middleware = createStaticFileMiddleware(responseFactory, streamFromFileFactory, publicDirectory);

    const middlewareResponse = await middleware(request, handler);

    expect(middlewareResponse).toEqual({
      ...response,
      body: expect.any(Duplex),
      headers: {
        'content-length': ['1'],
        etag: ['336d5ebc5436534e61d16e63ddfca327'],
      },
    });

    await readStream(middlewareResponse.body);

    rmSync(publicDirectory, { recursive: true });

    expect(handler).toHaveBeenCalledTimes(0);
    expect(responseFactory).toHaveBeenCalledTimes(1);
    expect(streamFromFileFactory).toHaveBeenCalledTimes(1);
  });
});
