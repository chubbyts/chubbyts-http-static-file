import type { Handler } from '@chubbyts/chubbyts-http-types/dist/handler';
import type { Middleware } from '@chubbyts/chubbyts-http-types/dist/middleware';
import type { Response, ServerRequest } from '@chubbyts/chubbyts-http-types/dist/message';
import type { ResponseFactory, StreamFromFileFactory } from '@chubbyts/chubbyts-http-types/dist/message-factory';
import { createHash, getHashes } from 'crypto';
import { extname } from 'path';
import { statSync, accessSync, constants, createReadStream } from 'fs';

type MimeTypes = Map<string, string>;

const access = (filepath: string): boolean => {
  try {
    accessSync(filepath, constants.R_OK);

    return true;
  } catch {
    return false;
  }
};

const checksum = async (filepath: string, hashAlgorithm: string): Promise<string> => {
  return new Promise((resolve: (hash: string) => void) => {
    const hash = createHash(hashAlgorithm);
    const stream = createReadStream(filepath);

    stream.on('data', (data) => {
      hash.update(data);
    });

    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });
  });
};

export const createStaticFileMiddleware = (
  responseFactory: ResponseFactory,
  streamFromFileFactory: StreamFromFileFactory,
  publicDirectory: string,
  hashAlgorithm: string = 'md5',
  mimeTypes: MimeTypes = require('./mimetypes').default,
): Middleware => {
  const supportedHashAlgorithms = getHashes();

  if (!getHashes().includes(hashAlgorithm)) {
    throw new Error(
      `Not supported hash algorithm: "${hashAlgorithm}", supported are: "${supportedHashAlgorithms.join('", "')}"`,
    );
  }

  const createResponse = (code: number, filename: string, hash: string): Response => {
    const extension = extname(filename).slice(1);
    const mimeType = mimeTypes.get(extension);

    const response = responseFactory(code);

    return {
      ...response,
      headers: {
        ...response.headers,
        'content-length': [String(statSync(filename).size)],
        etag: [hash],
        ...(mimeType ? { 'content-type': [mimeType] } : {}),
      },
    };
  };

  return async (request: ServerRequest, handler: Handler): Promise<Response> => {
    const filepath = publicDirectory + request.uri.path;

    if (!access(filepath) || statSync(filepath).isDirectory()) {
      return handler(request);
    }

    const hash = await checksum(filepath, hashAlgorithm);

    if (request.headers['if-none-match']?.includes(hash)) {
      const response = createResponse(304, filepath, hash);

      response.body.end();

      return response;
    }

    const response = createResponse(200, filepath, hash);

    return {
      ...response,
      body: streamFromFileFactory(filepath),
    };
  };
};
