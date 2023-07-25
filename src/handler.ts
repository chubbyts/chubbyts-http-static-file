import { createHash, getHashes } from 'crypto';
import { accessSync, constants, createReadStream, statSync } from 'fs';
import { extname } from 'path';
import type { Handler } from '@chubbyts/chubbyts-http-types/dist/handler';
import type { Response, ServerRequest } from '@chubbyts/chubbyts-http-types/dist/message';
import type { ResponseFactory, StreamFromFileFactory } from '@chubbyts/chubbyts-http-types/dist/message-factory';
import { createNotFound } from '@chubbyts/chubbyts-http-error/dist/http-error';

export type MimeTypes = Map<string, string>;

const assertHashAlgorithm = (hashAlgorithm: string): void => {
  const supportedHashAlgorithms = getHashes();

  if (!supportedHashAlgorithms.includes(hashAlgorithm)) {
    throw new Error(
      `Not supported hash algorithm: "${hashAlgorithm}", supported are: "${supportedHashAlgorithms.join('", "')}"`,
    );
  }
};

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

export const createStaticFileHandler = (
  responseFactory: ResponseFactory,
  streamFromFileFactory: StreamFromFileFactory,
  publicDirectory: string,
  mimeTypes: MimeTypes,
  hashAlgorithm = 'md5',
): Handler => {
  assertHashAlgorithm(hashAlgorithm);

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

  return async (request: ServerRequest): Promise<Response> => {
    const filepath = publicDirectory + request.uri.path;

    if (!access(filepath) || statSync(filepath).isDirectory()) {
      throw createNotFound({ detail: `There is no file at path "${request.uri.path}"` });
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
