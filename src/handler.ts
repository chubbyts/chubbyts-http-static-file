import { createHash, getHashes } from 'node:crypto';
import { constants } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import { open, realpath } from 'node:fs/promises';
import { extname, sep } from 'node:path';
import type { HttpError } from '@chubbyts/chubbyts-http-error/dist/http-error';
import { createMethodNotAllowed, createNotFound } from '@chubbyts/chubbyts-http-error/dist/http-error';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { Body, Response, ServerRequest } from '@chubbyts/chubbyts-http-types/message';
import type { ResponseFactory } from '@chubbyts/chubbyts-http-types/message-factory';
import type { ResponseHelpers } from '@chubbyts/chubbyts-http-types/message-helper';

export type MimeTypes = Map<string, string>;

type ResolvedFile = {
  filepath: string;
  fileHandle: FileHandle;
  size: number;
};

// errors meaning there is no (accessible) file at the path, all others (e.g. EMFILE, EIO) are no client error
const fileNotFoundCodes = new Set(['EACCES', 'ELOOP', 'ENAMETOOLONG', 'ENOENT', 'ENOTDIR']);

// no symlink as last component (the resolved path contains none, so it got swapped in), no blocking on a fifo
const openFlags = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;

const assertHashAlgorithm = (hashAlgorithm: string): void => {
  const supportedHashAlgorithms = getHashes();

  if (!supportedHashAlgorithms.includes(hashAlgorithm)) {
    throw new Error(
      `Not supported hash algorithm: "${hashAlgorithm}", supported are: "${supportedHashAlgorithms.join('", "')}"`,
    );
  }
};

const decodePathname = (pathname: string, createFileNotFound: () => HttpError): string => {
  try {
    return decodeURIComponent(pathname);
  } catch {
    throw createFileNotFound();
  }
};

const resolveFile = async (
  publicDirectory: string,
  pathname: string,
  createFileNotFound: () => HttpError,
): Promise<ResolvedFile> => {
  const decodedPathname = decodePathname(pathname, createFileNotFound);

  if (decodedPathname.includes('\0')) {
    throw createFileNotFound();
  }

  try {
    const resolvedPublicDirectory = await realpath(publicDirectory);
    const filepath = await realpath(resolvedPublicDirectory + decodedPathname);

    const prefix = resolvedPublicDirectory.endsWith(sep) ? resolvedPublicDirectory : resolvedPublicDirectory + sep;

    if (!filepath.startsWith(prefix)) {
      throw createFileNotFound();
    }

    const fileHandle = await open(filepath, openFlags);

    try {
      // checked on the opened file, so a swap after the path got resolved cannot serve a fifo, device or directory
      const stats = await fileHandle.stat();

      if (!stats.isFile()) {
        throw createFileNotFound();
      }

      return { filepath, fileHandle, size: stats.size };
    } catch (e) {
      await fileHandle.close();

      throw e;
    }
  } catch (e) {
    if (fileNotFoundCodes.has((e as NodeJS.ErrnoException).code as string)) {
      throw createFileNotFound();
    }

    throw e;
  }
};

const calculateHash = async (
  fileHandle: FileHandle,
  size: number,
  hashAlgorithm: string,
  signal: AbortSignal,
): Promise<string> => {
  const hash = createHash(hashAlgorithm);

  if (0 === size) {
    return hash.digest('hex');
  }

  // limited to the size of the content-length header, a file growing in between would mismatch otherwise
  for await (const data of fileHandle.createReadStream({ start: 0, end: size - 1, autoClose: false })) {
    // checked per chunk, as the signal option of the stream emits an unhandled error if already aborted
    signal.throwIfAborted();

    hash.update(data as Buffer);
  }

  // from here on, until the listener of the body got added, there are only microtasks: an abort cannot happen in between
  signal.throwIfAborted();

  return hash.digest('hex');
};

// destroyed (and therefore the file closed) without an error, as the body might never get consumed (e.g. disconnect)
const createBody = (fileHandle: FileHandle, size: number, signal: AbortSignal): Body => {
  const body = fileHandle.createReadStream({ start: 0, end: size - 1 });

  // the signal is per request, destroying an already closed body is a noop
  signal.addEventListener('abort', () => body.destroy());

  return body;
};

// if-none-match is a list field: each value can contain multiple comma separated entity tags
const matchesIfNoneMatch = (ifNoneMatch: ReadonlyArray<string>, etag: string): boolean => {
  return ifNoneMatch
    .flatMap((value) => value.split(','))
    .some((part) => {
      const candidate = part.trim();

      if ('*' === candidate) {
        return true;
      }

      return (candidate.startsWith('W/') ? candidate.slice(2) : candidate) === etag;
    });
};

export const createStaticFileHandler = (
  responseFactory: ResponseFactory,
  responseHelpers: ResponseHelpers,
  publicDirectory: string,
  mimeTypes: MimeTypes,
  hashAlgorithm = 'md5',
): Handler => {
  // e.g. a missing config, the existence gets not checked as the directory can be created later (e.g. uploads)
  if ('string' !== typeof publicDirectory || '' === publicDirectory) {
    throw new Error(`Public directory needs to be a non-empty string, "${String(publicDirectory)}" given`);
  }

  assertHashAlgorithm(hashAlgorithm);

  const createResponse = (status: number, filepath: string, etag: string, size: number, body?: Body): Response => {
    const extension = extname(filepath).slice(1).toLowerCase();
    const mimeType = mimeTypes.get(extension) ?? 'application/octet-stream';

    const response = [
      ['content-length', size.toString()],
      ['etag', etag],
      ['content-type', mimeType],
      ['x-content-type-options', 'nosniff'],
    ].reduce((current, [name, value]) => responseHelpers.withHeader(current, name, value), responseFactory(status));

    // without a body the one of the response factory (empty) gets kept
    return body ? responseHelpers.withBody(response, body) : response;
  };

  return async (serverRequest: ServerRequest): Promise<Response> => {
    const { method, uri, signal } = serverRequest;

    if ('GET' !== method && 'HEAD' !== method) {
      throw createMethodNotAllowed({
        detail: `Method "${method}" is not allowed, allowed are "GET", "HEAD"`,
        headers: { allow: 'GET, HEAD' },
      });
    }

    const createFileNotFound = () => createNotFound({ detail: `There is no file at path "${uri.path}"` });

    const { filepath, fileHandle, size } = await resolveFile(publicDirectory, uri.path, createFileNotFound);

    const hash = await calculateHash(fileHandle, size, hashAlgorithm, signal).catch(async (e: unknown) => {
      await fileHandle.close();

      throw e;
    });

    const etag = `"${hash}"`;

    if (matchesIfNoneMatch(responseHelpers.getHeader(serverRequest, 'if-none-match'), etag)) {
      await fileHandle.close();

      return createResponse(304, filepath, etag, size);
    }

    if ('HEAD' === method || 0 === size) {
      await fileHandle.close();

      return createResponse(200, filepath, etag, size);
    }

    return createResponse(200, filepath, etag, size, createBody(fileHandle, size, signal));
  };
};
