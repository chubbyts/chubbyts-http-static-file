import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { afterAll, describe, expect, test } from 'vitest';
import { useObjectMock } from '@chubbyts/chubbyts-function-mock/dist/object-mock';
import type { Container } from '@chubbyts/chubbyts-dic-types/dist/container';
import type { ConfigFactory } from '@chubbyts/chubbyts-dic-config/dist/dic-config';
import { createContainerByConfigFactory } from '@chubbyts/chubbyts-dic-config/dist/dic-config';
import { HttpError } from '@chubbyts/chubbyts-http-error/dist/http-error';
import type { Handler } from '@chubbyts/chubbyts-undici-server/dist/server';
import { ServerRequest } from '@chubbyts/chubbyts-undici-server/dist/server';
import type { MimeTypes } from '../src/handler';
import mimeTypes from '../src/mimetypes';
import type { StaticFileConfig } from '../src/service-factory';
import { mimeTypesServiceFactory, staticFileHandlerServiceFactory } from '../src/service-factory';

// createStaticFileHandler returns an opaque closure, so the wiring gets proven by exercising the created handler
// against a real public directory

const publicDirectory = `${tmpdir()}/${randomBytes(8).toString('hex')}`;
const otherPublicDirectory = `${tmpdir()}/${randomBytes(8).toString('hex')}`;

mkdirSync(publicDirectory);
writeFileSync(`${publicDirectory}/file.txt`, 'text');

mkdirSync(otherPublicDirectory);
writeFileSync(`${otherPublicDirectory}/file.css`, 'css');

afterAll(() => {
  rmSync(publicDirectory, { recursive: true, force: true });
  rmSync(otherPublicDirectory, { recursive: true, force: true });
});

const md5Etag = '"1cb251ec0d568de6a929b520c4aed8d1"';
const sha1Etag = '"372ea08cab33e71c02c651dbc83a474d32c676ea"';

describe('mimeTypesServiceFactory', () => {
  test('create', () => {
    expect(mimeTypesServiceFactory()()).toBe(mimeTypes);
  });
});

describe('staticFileHandlerServiceFactory', () => {
  test('without name, without registered mime types', async () => {
    const staticFileConfig: StaticFileConfig = { publicDirectory };

    const [container, containerMocks] = useObjectMock<Container>([
      { name: 'get', parameters: ['config'], return: { chubbyts: { staticFile: staticFileConfig } } },
      { name: 'has', parameters: ['staticFileMimeTypes'], return: false },
    ]);

    const service = staticFileHandlerServiceFactory()(container);

    // the configured public directory and the shipped mime types get used
    const response = await service(new ServerRequest('https://example.com/file.txt'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain');
    expect(response.headers.get('etag')).toBe(md5Etag);
    expect(await response.text()).toBe('text');

    expect(containerMocks).toHaveLength(0);
  });

  test('without name, with hash algorithm, with registered mime types', async () => {
    const staticFileConfig: StaticFileConfig = { publicDirectory, hashAlgorithm: 'sha1' };

    const registeredMimeTypes: MimeTypes = new Map([['txt', 'text/custom']]);

    const [container, containerMocks] = useObjectMock<Container>([
      { name: 'get', parameters: ['config'], return: { chubbyts: { staticFile: staticFileConfig } } },
      { name: 'has', parameters: ['staticFileMimeTypes'], return: true },
      { name: 'get', parameters: ['staticFileMimeTypes'], return: registeredMimeTypes },
    ]);

    const service = staticFileHandlerServiceFactory()(container);

    // the registered mime types win over the shipped factory, the configured hash algorithm gets used
    const response = await service(new ServerRequest('https://example.com/file.txt'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/custom');
    expect(response.headers.get('etag')).toBe(sha1Etag);

    expect(containerMocks).toHaveLength(0);
  });

  test('with name, with registered named mime types', async () => {
    const registeredMimeTypes: MimeTypes = new Map([['css', 'text/custom-css']]);

    const [container, containerMocks] = useObjectMock<Container>([
      {
        name: 'get',
        parameters: ['config'],
        return: {
          chubbyts: {
            staticFile: { assets: { publicDirectory }, other: { publicDirectory: otherPublicDirectory } },
          },
        },
      },
      { name: 'has', parameters: ['staticFileMimeTypesother'], return: true },
      { name: 'get', parameters: ['staticFileMimeTypesother'], return: registeredMimeTypes },
    ]);

    const service = staticFileHandlerServiceFactory('other')(container);

    const response = await service(new ServerRequest('https://example.com/file.css'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/custom-css');

    // the named config points to the other public directory
    await expect(service(new ServerRequest('https://example.com/file.txt'))).rejects.toThrow(HttpError);

    expect(containerMocks).toHaveLength(0);
  });

  test('the hash algorithm gets passed through', () => {
    const [container, containerMocks] = useObjectMock<Container>([
      {
        name: 'get',
        parameters: ['config'],
        return: { chubbyts: { staticFile: { publicDirectory, hashAlgorithm: 'unknown' } } },
      },
      { name: 'has', parameters: ['staticFileMimeTypes'], return: false },
    ]);

    expect(() => staticFileHandlerServiceFactory()(container)).toThrow('Not supported hash algorithm: "unknown"');

    expect(containerMocks).toHaveLength(0);
  });
});

describe('with container by config', () => {
  test('the services are wired together', async () => {
    const container = createContainerByConfigFactory({
      chubbyts: {
        staticFile: { publicDirectory } satisfies StaticFileConfig,
      },
      dependencies: {
        factories: new Map<string, ConfigFactory>([
          ['staticFileHandler', staticFileHandlerServiceFactory()],
          ['staticFileMimeTypes', mimeTypesServiceFactory()],
        ]),
      },
    })();

    const staticFileHandler = container.get<Handler>('staticFileHandler');

    const response = await staticFileHandler(new ServerRequest('https://example.com/file.txt'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain');
    expect(await response.text()).toBe('text');
  });

  test('the named services are wired together', async () => {
    const container = createContainerByConfigFactory({
      chubbyts: {
        staticFile: {
          assets: { publicDirectory },
          other: { publicDirectory: otherPublicDirectory, hashAlgorithm: 'sha1' },
        } satisfies Record<string, StaticFileConfig>,
      },
      dependencies: {
        factories: new Map<string, ConfigFactory>([
          ['staticFileHandlerassets', staticFileHandlerServiceFactory('assets')],
          ['staticFileHandlerother', staticFileHandlerServiceFactory('other')],
          ['staticFileMimeTypesother', () => new Map([['css', 'text/custom-css']])],
        ]),
      },
    })();

    const assetsHandler = container.get<Handler>('staticFileHandlerassets');
    const otherHandler = container.get<Handler>('staticFileHandlerother');

    const assetsResponse = await assetsHandler(new ServerRequest('https://example.com/file.txt'));

    expect(assetsResponse.headers.get('content-type')).toBe('text/plain');
    expect(assetsResponse.headers.get('etag')).toBe(md5Etag);

    const otherResponse = await otherHandler(new ServerRequest('https://example.com/file.css'));

    expect(otherResponse.headers.get('content-type')).toBe('text/custom-css');
    expect(otherResponse.headers.get('etag')).toBe('"2f84417a9e73cead4d5c99e05daff2a534b30132"');
  });
});
