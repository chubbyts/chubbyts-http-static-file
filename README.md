# chubbyts-static-file

[![CI](https://github.com/chubbyts/chubbyts-static-file/workflows/CI/badge.svg?branch=master)](https://github.com/chubbyts/chubbyts-static-file/actions?query=workflow%3ACI)
[![Coverage Status](https://coveralls.io/repos/github/chubbyts/chubbyts-static-file/badge.svg?branch=master)](https://coveralls.io/github/chubbyts/chubbyts-static-file?branch=master)
[![Infection MSI](https://badge.stryker-mutator.io/github.com/chubbyts/chubbyts-static-file/master)](https://dashboard.stryker-mutator.io/reports/github.com/chubbyts/chubbyts-static-file/master)
[![npm-version](https://img.shields.io/npm/v/@chubbyts/chubbyts-static-file.svg)](https://www.npmjs.com/package/@chubbyts/chubbyts-static-file)

[![bugs](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-static-file&metric=bugs)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-static-file)
[![code_smells](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-static-file&metric=code_smells)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-static-file)
[![coverage](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-static-file&metric=coverage)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-static-file)
[![duplicated_lines_density](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-static-file&metric=duplicated_lines_density)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-static-file)
[![ncloc](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-static-file&metric=ncloc)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-static-file)
[![sqale_rating](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-static-file&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-static-file)
[![alert_status](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-static-file&metric=alert_status)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-static-file)
[![reliability_rating](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-static-file&metric=reliability_rating)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-static-file)
[![security_rating](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-static-file&metric=security_rating)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-static-file)
[![sqale_index](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-static-file&metric=sqale_index)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-static-file)
[![vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=chubbyts_chubbyts-static-file&metric=vulnerabilities)](https://sonarcloud.io/dashboard?id=chubbyts_chubbyts-static-file)

## Description

A minimal static file middleware for chubbyts-http-types.

## Requirements

 * node: 14
 * [@chubbyts/chubbyts-http-types][2]: ^1.0.1

## Installation

Through [NPM](https://www.npmjs.com) as [@chubbyts/chubbyts-static-file][1].

```ts
npm i @chubbyts/chubbyts-static-file@^1.0.0
```

## Usage

```ts
import { createStaticFileMiddleware } from '@chubbyts/chubbyts-static-file/dist/middleware';
import type { ResponseFactory, StreamFromFileFactory } from '@chubbyts/chubbyts-http-types/dist/message-factory';

const responseFactory: ResponseFactory = ...;
const streamFromFileFactory: StreamFromFileFactory = ...;

const middleware = createStaticFileMiddleware(responseFactory, streamFromFileFactory, '/public');
```

## Copyright

2023 Dominik Zogg

[1]: https://www.npmjs.com/package/@chubbyts/chubbyts-static-file
[2]: https://www.npmjs.com/package/@chubbyts/chubbyts-http-types
