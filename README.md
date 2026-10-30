# chubbyts-http-static-file

[![CI](https://github.com/chubbyts/chubbyts-http-static-file/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/chubbyts/chubbyts-http-static-file/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/chubbyts/chubbyts-http-static-file/badge.svg?branch=master)](https://coveralls.io/github/chubbyts/chubbyts-http-static-file?branch=master)
[![Mutation testing badge](https://img.shields.io/endpoint?style=flat&url=https%3A%2F%2Fbadge-api.stryker-mutator.io%2Fgithub.com%2Fchubbyts%2Fchubbyts-http-static-file%2Fmaster)](https://dashboard.stryker-mutator.io/reports/github.com/chubbyts/chubbyts-http-static-file/master)
[![npm-version](https://img.shields.io/npm/v/@chubbyts/chubbyts-http-static-file.svg)](https://www.npmjs.com/package/@chubbyts/chubbyts-http-static-file)

[![bugs](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-http-static-file&metric=bugs)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-http-static-file)
[![code_smells](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-http-static-file&metric=code_smells)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-http-static-file)
[![coverage](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-http-static-file&metric=coverage)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-http-static-file)
[![duplicated_lines_density](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-http-static-file&metric=duplicated_lines_density)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-http-static-file)
[![ncloc](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-http-static-file&metric=ncloc)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-http-static-file)
[![sqale_rating](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-http-static-file&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-http-static-file)
[![alert_status](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-http-static-file&metric=alert_status)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-http-static-file)
[![reliability_rating](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-http-static-file&metric=reliability_rating)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-http-static-file)
[![security_rating](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-http-static-file&metric=security_rating)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-http-static-file)
[![sqale_index](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-http-static-file&metric=sqale_index)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-http-static-file)
[![vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-http-static-file&metric=vulnerabilities)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-http-static-file)

## Description

A minimal static file handler for [@chubbyts/chubbyts-http-types][3].

It works with any implementation of the types (e.g. [@chubbyts/chubbyts-http][7]): the request headers get read and
the responses get created and changed through the injected response factory and helpers only.

## Requirements

 * node: 22
 * [@chubbyts/chubbyts-dic-config-factory][6]: ^1.0.1
 * [@chubbyts/chubbyts-dic-types][4]: ^2.3.1
 * [@chubbyts/chubbyts-http-error][2]: ^3.5.1
 * [@chubbyts/chubbyts-http-types][3]: ^4.0.0

## Installation

Through [NPM](https://www.npmjs.com) as [@chubbyts/chubbyts-http-static-file][1].

```ts
npm i @chubbyts/chubbyts-http-static-file@^4.0.0
```

## Usage

```ts
import { createResponseFactory, createServerRequestFactory } from '@chubbyts/chubbyts-http/message-factory';
import { createResponseHelpers } from '@chubbyts/chubbyts-http/message-helper';
import { createStaticFileHandler } from '@chubbyts/chubbyts-http-static-file/handler';
import mimeTypes from '@chubbyts/chubbyts-http-static-file/mimetypes';

const serverRequestFactory = createServerRequestFactory();
const responseFactory = createResponseFactory();
const responseHelpers = createResponseHelpers();

const handler = createStaticFileHandler(
  responseFactory,
  responseHelpers,
  '/path/to/public/directory',
  mimeTypes,
  // 'md5',
);

(async () => {
  const serverRequest = serverRequestFactory('GET', 'https://example.com/images/logo.png');
  const response = await handler(serverRequest);
})();
```

Only `GET` and `HEAD` requests are allowed (otherwise a `405` http error with an `allow` header gets thrown), the file
gets resolved by the (percent decoded) path of the uri within the public directory (otherwise, also for symlinks
pointing outside of it, a `404` http error gets thrown). Errors not meaning a missing or inaccessible file (e.g. `EMFILE`
or `EIO`) get rethrown as they are, as well as the abort reason of the request signal. The response contains the
`content-length`, `content-type`, `etag` (the hash of the file) and `x-content-type-options: nosniff` headers, a
request with a matching `if-none-match` header gets a `304` without body. The body gets destroyed (and the file closed)
when the request signal gets aborted.

The handler is minimal by intention: there is no support for `range`, `last-modified` / `if-modified-since` or
`cache-control`, and the file gets hashed on each request (the cost grows with the file size).

### Security

 * All files within the public directory get served, dotfiles (e.g. `.env` or `.git`) included.
 * The `content-type` is derived from the extension, so uploaded `.html` or `.svg` files run scripts within the origin
   of the application: serve user uploads from a separate origin or set `content-disposition: attachment` and a
   restrictive `content-security-policy` through a middleware.
 * The containment is checked on the resolved path, a symlink swapped in as the last component gets rejected when
   opening the file. Untrusted parties must not be able to create symlinks or directories within the public directory.

### Service factories (chubbyts-dic-config)

The package ships service factories (abstract factories built on [chubbyts-dic-config-factory][6]) for a [chubbyts-dic-config][5] (or any [chubbyts-dic-types][4] compatible) container within `@chubbyts/chubbyts-http-static-file/service-factory`, configured through `config.chubbyts.staticFile`. The implementation of the types gets read from the services `responseFactory` and `responseHelpers`, which have to be registered:

```ts
import type { ConfigFactory } from '@chubbyts/chubbyts-dic-config/dist/dic-config';
import { createContainerByConfigFactory } from '@chubbyts/chubbyts-dic-config/dist/dic-config';
import { createResponseFactory } from '@chubbyts/chubbyts-http/message-factory';
import { createResponseHelpers } from '@chubbyts/chubbyts-http/message-helper';
import type { StaticFileConfig } from '@chubbyts/chubbyts-http-static-file/service-factory';
import { staticFileHandlerServiceFactory } from '@chubbyts/chubbyts-http-static-file/service-factory';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';

const container = createContainerByConfigFactory({
  chubbyts: {
    staticFile: {
      publicDirectory: '/path/to/public/directory', // required
      // hashAlgorithm: 'md5',
    } satisfies StaticFileConfig,
  },
  dependencies: {
    factories: new Map<string, ConfigFactory>([
      ['responseFactory', () => createResponseFactory()],
      ['responseHelpers', () => createResponseHelpers()],
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
      // responseFactory and responseHelpers like above
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

[1]: https://www.npmjs.com/package/@chubbyts/chubbyts-http-static-file
[2]: https://www.npmjs.com/package/@chubbyts/chubbyts-http-error
[3]: https://www.npmjs.com/package/@chubbyts/chubbyts-http-types
[4]: https://www.npmjs.com/package/@chubbyts/chubbyts-dic-types
[5]: https://www.npmjs.com/package/@chubbyts/chubbyts-dic-config
[6]: https://www.npmjs.com/package/@chubbyts/chubbyts-dic-config-factory
[7]: https://www.npmjs.com/package/@chubbyts/chubbyts-http
