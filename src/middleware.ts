import type { Handler } from '@chubbyts/chubbyts-http-types/dist/handler';
import type { Middleware } from '@chubbyts/chubbyts-http-types/dist/middleware';
import type { Response, ServerRequest } from '@chubbyts/chubbyts-http-types/dist/message';
import type { ResponseFactory, StreamFromFileFactory } from '@chubbyts/chubbyts-http-types/dist/message-factory';
import { isHttpError } from '@chubbyts/chubbyts-http-error/dist/http-error';
import type { MimeTypes } from './handler';
import { createStaticFileHandler } from './handler';

/**
 * @deprecated
 */
export const createStaticFileMiddleware = (
  responseFactory: ResponseFactory,
  streamFromFileFactory: StreamFromFileFactory,
  publicDirectory: string,
  hashAlgorithm = 'md5',
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  mimeTypes: MimeTypes = require('./mimetypes').default,
): Middleware => {
  const staticFileHandler = createStaticFileHandler(
    responseFactory,
    streamFromFileFactory,
    publicDirectory,
    hashAlgorithm,
    mimeTypes,
  );

  return async (request: ServerRequest, handler: Handler): Promise<Response> => {
    try {
      return await staticFileHandler(request);
    } catch (e) {
      if (isHttpError(e)) {
        return handler(request);
      }

      throw e;
    }
  };
};
