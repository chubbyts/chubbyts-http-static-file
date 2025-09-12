# chubbyts-undici-static-file

[![CI](https://github.com/chubbyts/chubbyts-undici-static-file/workflows/CI/badge.svg?branch=master)](https://github.com/chubbyts/chubbyts-undici-static-file/actions?query=workflow%3ACI)
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

 * node: 20
 * [@chubbyts/chubbyts-http-error][2]: ^3.0.1
 * [@chubbyts/chubbyts-undici-server][3]: ^1.0.0

## Installation

Through [NPM](https://www.npmjs.com) as [@chubbyts/chubbyts-undici-static-file][1].

```ts
npm i @chubbyts/chubbyts-undici-static-file@^1.0.0
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

## Copyright

2025 Dominik Zogg

[1]: https://www.npmjs.com/package/@chubbyts/chubbyts-undici-static-file
[2]: https://www.npmjs.com/package/@chubbyts/chubbyts-http-error
[3]: https://www.npmjs.com/package/@chubbyts/chubbyts-undici-server
