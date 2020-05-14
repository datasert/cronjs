## Overview

`cronjs` is set of Javascript modules which helps with parsing, validating and evaluating cron expressions with support for special flags (L, W, # and ?). This can be used in both Node and Browser and is written in Typescript.

Note that at this time library does not have describer and scheduler but we would like to add those features in.

This is a mono-repo with multiple published packages. To manage mono-repo, we use [Yarn Workspaces](https://classic.yarnpkg.com/en/docs/workspaces/) along with [Lerna](https://lerna.js.org/).

It consists of following packages:

### Parser (`@datasert/cronjs-parser`)

This package helps parse the cron expression and produces compiled cron expression object. As part of parsing, it validates the expressions and throws errors with meaningful messages.

### Evaluator (`@datasert/cronjs-evaluator`)

This package helps evaluate the parsed cron expression and find the matching times. It allows to match future matches, if a time matches the cron, past time matches (tbi)

## Parser

This package helps parse the cron expression and produces compiled cron expression object. As part of parsing, it validates the expressions and throws errors with meaningful messages.

### Features

It supports usual suspects of cron like steps, ranges along with following note worthy ones.

- Support for second
- Optional year
- Support for special flags (`? L W #`)
- Parses to persistable plain object which can be externally consumed or saved for reuse
- No external dependencies

### Cron Spec
