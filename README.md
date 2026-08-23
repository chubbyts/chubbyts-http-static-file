# chubbyts-undici-static-file

[![CI](https://github.com/chubbyts/chubbyts-undici-static-file/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/chubbyts/chubbyts-undici-static-file/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/chubbyts/chubbyts-undici-static-file/badge.svg?branch=master)](https://coveralls.io/github/chubbyts/chubbyts-undici-static-file?branch=master)
[![Mutation testing badge](https://img.shields.io/endpoint?style=flat&url=https%3A%2F%2Fbadge-api.stryker-mutator.io%2Fgithub.com%2Fchubbyts%2Fchubbyts-undici-static-file%2Fmaster)](https://dashboard.stryker-mutator.io/reports/github.com/chubbyts/chubbyts-undici-static-file/master)
[![npm-version](https://img.shields.io/npm/v/@chubbyts/chubbyts-undici-static-file.svg)](https://www.npmjs.com/package/@chubbyts/chubbyts-undici-static-file)

[![bugs](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-undici-static-file&metric=bugs)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-undici-static-file)
[![code_smells](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-undici-static-file&metric=code_smells)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-undici-static-file)
[![coverage](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-undici-static-file&metric=coverage)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-undici-static-file)
[![duplicated_lines_density](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-undici-static-file&metric=duplicated_lines_density)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-undici-static-file)
[![ncloc](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-undici-static-file&metric=ncloc)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-undici-static-file)
[![sqale_rating](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-undici-static-file&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-undici-static-file)
[![alert_status](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-undici-static-file&metric=alert_status)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-undici-static-file)
[![reliability_rating](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-undici-static-file&metric=reliability_rating)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-undici-static-file)
[![security_rating](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-undici-static-file&metric=security_rating)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-undici-static-file)
[![sqale_index](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-undici-static-file&metric=sqale_index)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-undici-static-file)
[![vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-undici-static-file&metric=vulnerabilities)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-undici-static-file)

## Description

A minimal static file handler for chubbyts-undici-server.

## Requirements

 * node: 22
 * [@chubbyts/chubbyts-dic-config-factory][6]: ^1.0.0
 * [@chubbyts/chubbyts-dic-types][4]: ^2.3.0
 * [@chubbyts/chubbyts-http-error][2]: ^3.4.0
 * [@chubbyts/chubbyts-undici-server][3]: ^1.2.0

## Installation

Through [NPM](https://www.npmjs.com) as [@chubbyts/chubbyts-undici-static-file][1].

```ts
npm i @chubbyts/chubbyts-undici-static-file@^1.3.0
```

## Usage

```ts
import { createStaticFileHandler } from '@chubbyts/chubbyts-undici-static-file/dist/handler';
import { createGetRoute } from '@chubbyts/chubbyts-framework/dist/router/route';

const handler = createStaticFileHandler(
  '/path/to/public/directory',
  (await import('../src/mimetypes')).default,
);

// for example as a fallback route matching everything
const route = createGetRoute({
  path: '/*path',
  name: 'static_file',
  handler,
});
```

### Service factories (chubbyts-dic-config)

The package ships service factories (abstract factories built on [chubbyts-dic-config-factory][6]) for a [chubbyts-dic-config][5] (or any [chubbyts-dic-types][4] compatible) container within `@chubbyts/chubbyts-undici-static-file/dist/service-factory`, configured through `config.chubbyts.staticFile`:

```ts
import type { ConfigFactory } from '@chubbyts/chubbyts-dic-config/dist/dic-config';
import { createContainerByConfigFactory } from '@chubbyts/chubbyts-dic-config/dist/dic-config';
import type { StaticFileConfig } from '@chubbyts/chubbyts-undici-static-file/dist/service-factory';
import { staticFileHandlerServiceFactory } from '@chubbyts/chubbyts-undici-static-file/dist/service-factory';
import type { Handler } from '@chubbyts/chubbyts-undici-server/dist/server';

const container = createContainerByConfigFactory({
  chubbyts: {
    staticFile: {
      publicDirectory: '/path/to/public/directory', // required
      // hashAlgorithm: 'md5',
    } satisfies StaticFileConfig,
  },
  dependencies: {
    factories: new Map<string, ConfigFactory>([
      ['staticFileHandler', staticFileHandlerServiceFactory()],
    ]),
  },
})();

const staticFileHandler = container.get<Handler>('staticFileHandler');
```

The `staticFileHandlerServiceFactory` uses the service `staticFileMimeTypes` of the container if registered, and creates it through the shipped `mimeTypesServiceFactory` (the bundled mime types) otherwise. Register it under its name to replace the mime types (e.g. a reduced or extended `Map`) or to share them with other services.

#### With names

To serve different directories, the same factories can be registered multiple times with a name: the config is then read from `config.chubbyts.staticFile.<name>` and the name gets appended to each service id (`staticFileHandlerassets`, `staticFileMimeTypesassets`, ...).

```ts
const container = createContainerByConfigFactory({
  chubbyts: {
    staticFile: {
      assets: { publicDirectory: '/path/to/assets' },
      uploads: { publicDirectory: '/path/to/uploads', hashAlgorithm: 'sha1' },
    } satisfies Record<string, StaticFileConfig>,
  },
  dependencies: {
    factories: new Map<string, ConfigFactory>([
      ['staticFileHandlerassets', staticFileHandlerServiceFactory('assets')],
      ['staticFileHandleruploads', staticFileHandlerServiceFactory('uploads')],
    ]),
  },
})();

const assetsHandler = container.get<Handler>('staticFileHandlerassets');
const uploadsHandler = container.get<Handler>('staticFileHandleruploads');
```

## Copyright

2026 Dominik Zogg

[1]: https://www.npmjs.com/package/@chubbyts/chubbyts-undici-static-file
[2]: https://www.npmjs.com/package/@chubbyts/chubbyts-http-error
[3]: https://www.npmjs.com/package/@chubbyts/chubbyts-undici-server
[4]: https://www.npmjs.com/package/@chubbyts/chubbyts-dic-types
[5]: https://www.npmjs.com/package/@chubbyts/chubbyts-dic-config
[6]: https://www.npmjs.com/package/@chubbyts/chubbyts-dic-config-factory
