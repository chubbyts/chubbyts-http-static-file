# chubbyts-http-static-file

[![CI](https://github.com/chubbyts/chubbyts-http-static-file/workflows/CI/badge.svg?branch=master)](https://github.com/chubbyts/chubbyts-http-static-file/actions?query=workflow%3ACI)
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

A minimal static file handler for chubbyts-http-types.

## Requirements

 * node: 18
 * [@chubbyts/chubbyts-http-error][2]: ^2.4.1
 * [@chubbyts/chubbyts-http-types][3]: ^1.3.1

## Installation

Through [NPM](https://www.npmjs.com) as [@chubbyts/chubbyts-http-static-file][1].

```ts
npm i @chubbyts/chubbyts-http-static-file@^2.1.1
```

## Usage

```ts
import { createStaticFileHandler } from '@chubbyts/chubbyts-http-static-file/dist/handler';
import type { ResponseFactory, StreamFromFileFactory } from '@chubbyts/chubbyts-http-types/dist/message-factory';
import { createGetRoute } from '@chubbyts/chubbyts-framework/dist/router/route';

const responseFactory: ResponseFactory = ...;
const streamFromFileFactory: StreamFromFileFactory = ...;

const handler = createStaticFileHandler(
  responseFactory,
  streamFromFileFactory,
  '/path/to/public/directory',
  (await import('../src/mimetypes')).default, // typescript / ecmascript module
  // require('../src/mimetypes').default, // commonjs (cjs)
);

// for example as a fallback route matching everything
const route = createGetRoute({
  path: '/(.*)',
  name: 'static_file',
  handler,
});
```

## Copyright

2025 Dominik Zogg

[1]: https://www.npmjs.com/package/@chubbyts/chubbyts-http-static-file
[2]: https://www.npmjs.com/package/@chubbyts/chubbyts-http-error
[3]: https://www.npmjs.com/package/@chubbyts/chubbyts-http-types
