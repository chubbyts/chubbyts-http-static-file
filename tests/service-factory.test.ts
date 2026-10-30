import { tmpdir } from 'os';
import { text } from 'node:stream/consumers';
import { randomBytes } from 'crypto';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { afterAll, describe, expect, test } from 'vitest';
import { useObjectMock } from '@chubbyts/chubbyts-function-mock/dist/object-mock';
import type { Container } from '@chubbyts/chubbyts-dic-types/dist/container';
import type { ConfigFactory } from '@chubbyts/chubbyts-dic-config/dist/dic-config';
import { createContainerByConfigFactory } from '@chubbyts/chubbyts-dic-config/dist/dic-config';
import { HttpError } from '@chubbyts/chubbyts-http-error/dist/http-error';
import { createResponseFactory, createServerRequestFactory } from '@chubbyts/chubbyts-http/message-factory';
import { createResponseHelpers } from '@chubbyts/chubbyts-http/message-helper';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { MimeTypes } from '../src/handler.js';
import mimeTypes from '../src/mimetypes.js';
import type { StaticFileConfig } from '../src/service-factory.js';
import { mimeTypesServiceFactory, staticFileHandlerServiceFactory } from '../src/service-factory.js';

// createStaticFileHandler returns an opaque closure, so the wiring gets proven by exercising the created handler
// against a real public directory, @chubbyts/chubbyts-http is used as implementation

const serverRequestFactory = createServerRequestFactory();
const responseFactory = createResponseFactory();
const responseHelpers = createResponseHelpers();

const createRequest = (uri: string) => serverRequestFactory('GET', uri);

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
      { name: 'get', parameters: ['responseFactory'], return: responseFactory },
      { name: 'get', parameters: ['responseHelpers'], return: responseHelpers },
      { name: 'has', parameters: ['staticFileMimeTypes'], return: false },
    ]);

    const service = staticFileHandlerServiceFactory()(container);

    // the configured public directory and the shipped mime types get used
    const response = await service(createRequest('https://example.com/file.txt'));

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toEqual(['text/plain']);
    expect(response.headers.etag).toEqual([md5Etag]);
    expect(await text(response.body)).toBe('text');

    expect(containerMocks).toHaveLength(0);
  });

  test('without name, with hash algorithm, with registered mime types', async () => {
    const staticFileConfig: StaticFileConfig = { publicDirectory, hashAlgorithm: 'sha1' };

    const registeredMimeTypes: MimeTypes = new Map([['txt', 'text/custom']]);

    const [container, containerMocks] = useObjectMock<Container>([
      { name: 'get', parameters: ['config'], return: { chubbyts: { staticFile: staticFileConfig } } },
      { name: 'get', parameters: ['responseFactory'], return: responseFactory },
      { name: 'get', parameters: ['responseHelpers'], return: responseHelpers },
      { name: 'has', parameters: ['staticFileMimeTypes'], return: true },
      { name: 'get', parameters: ['staticFileMimeTypes'], return: registeredMimeTypes },
    ]);

    const service = staticFileHandlerServiceFactory()(container);

    // the registered mime types win over the shipped factory, the configured hash algorithm gets used
    const response = await service(createRequest('https://example.com/file.txt'));

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toEqual(['text/custom']);
    expect(response.headers.etag).toEqual([sha1Etag]);
    expect(await text(response.body)).toBe('text');

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
      { name: 'get', parameters: ['responseFactory'], return: responseFactory },
      { name: 'get', parameters: ['responseHelpers'], return: responseHelpers },
      { name: 'has', parameters: ['staticFileMimeTypesother'], return: true },
      { name: 'get', parameters: ['staticFileMimeTypesother'], return: registeredMimeTypes },
    ]);

    const service = staticFileHandlerServiceFactory('other')(container);

    const response = await service(createRequest('https://example.com/file.css'));

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toEqual(['text/custom-css']);
    expect(await text(response.body)).toBe('css');

    // the named config points to the other public directory
    await expect(service(createRequest('https://example.com/file.txt'))).rejects.toThrow(HttpError);

    expect(containerMocks).toHaveLength(0);
  });

  test('the hash algorithm gets passed through', () => {
    const [container, containerMocks] = useObjectMock<Container>([
      {
        name: 'get',
        parameters: ['config'],
        return: { chubbyts: { staticFile: { publicDirectory, hashAlgorithm: 'unknown' } } },
      },
      { name: 'get', parameters: ['responseFactory'], return: responseFactory },
      { name: 'get', parameters: ['responseHelpers'], return: responseHelpers },
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
          ['responseFactory', () => responseFactory],
          ['responseHelpers', () => responseHelpers],
          ['staticFileHandler', staticFileHandlerServiceFactory()],
          ['staticFileMimeTypes', mimeTypesServiceFactory()],
        ]),
      },
    })();

    const staticFileHandler = container.get<Handler>('staticFileHandler');

    const response = await staticFileHandler(createRequest('https://example.com/file.txt'));

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toEqual(['text/plain']);
    expect(await text(response.body)).toBe('text');
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
          ['responseFactory', () => responseFactory],
          ['responseHelpers', () => responseHelpers],
          ['staticFileHandlerassets', staticFileHandlerServiceFactory('assets')],
          ['staticFileHandlerother', staticFileHandlerServiceFactory('other')],
          ['staticFileMimeTypesother', () => new Map([['css', 'text/custom-css']])],
        ]),
      },
    })();

    const assetsHandler = container.get<Handler>('staticFileHandlerassets');
    const otherHandler = container.get<Handler>('staticFileHandlerother');

    const assetsResponse = await assetsHandler(createRequest('https://example.com/file.txt'));

    expect(assetsResponse.headers['content-type']).toEqual(['text/plain']);
    expect(assetsResponse.headers.etag).toEqual([md5Etag]);
    expect(await text(assetsResponse.body)).toBe('text');

    const otherResponse = await otherHandler(createRequest('https://example.com/file.css'));

    expect(otherResponse.headers['content-type']).toEqual(['text/custom-css']);
    expect(otherResponse.headers.etag).toEqual(['"2f84417a9e73cead4d5c99e05daff2a534b30132"']);
    expect(await text(otherResponse.body)).toBe('css');
  });
});
