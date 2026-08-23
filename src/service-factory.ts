import type { Container } from '@chubbyts/chubbyts-dic-types/dist/container';
import { createAbstractFactory } from '@chubbyts/chubbyts-dic-config-factory/dist/dic-config-factory';
import type { Handler } from '@chubbyts/chubbyts-undici-server/dist/server';
import type { MimeTypes } from './handler.js';
import { createStaticFileHandler } from './handler.js';
import mimeTypes from './mimetypes.js';

/**
 * The configuration read by the service factories from `config.chubbyts.staticFile` (or
 * `config.chubbyts.staticFile.<name>` for named factories), see the parameters of `createStaticFileHandler`.
 */
export type StaticFileConfig = {
  publicDirectory: string;
  hashAlgorithm?: string;
};

type Config = {
  chubbyts: {
    staticFile: StaticFileConfig | Record<string, StaticFileConfig>;
  };
};

export const mimeTypesServiceFactory = createAbstractFactory((): MimeTypes => {
  return mimeTypes;
});

export const staticFileHandlerServiceFactory = createAbstractFactory(
  (container: Container, { resolveConfig, resolveDependency }): Handler => {
    const { publicDirectory, hashAlgorithm } = resolveConfig(container.get<Config>('config').chubbyts.staticFile);

    // a registered service wins over the shipped factory, so that the mime types can be replaced or shared
    return createStaticFileHandler(
      publicDirectory,
      resolveDependency(container, 'staticFileMimeTypes', mimeTypesServiceFactory),
      hashAlgorithm,
    );
  },
);
