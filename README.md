# Overview

Cronjs is Javascript cron expression parser, validator, evaluator and describer (tbi) with support for special flags (L, W, # and ?) for Node and Browser written in Typescript.

Note that this library is not a scheduler. It doesn't invoke your function or callback at particular time when cron job supposed to run but library to parse, validate, describe and evaluate cron expressions. You can use this library to implement cron scheduler/executor.

**Note:** tbi = to be implemented

Library consists of 3 packages:

### Parser (`@datasert/cronjs-parsrer`)

This package helps parse the cron expression and produces compiled cron expression object. As part of parsing, it validates the expressions and throws errors with meaningful messages.

### Describer (tbi) (`@datasert/cronjs-describer`)

This package helps describe a cron expression. It uses the compiled cron object from parser packages and emits human understandable description of given cron expression.

### Evaluator (`@datasert/cronjs-evaluator`)

This package helps evaluate the parsed cron expression and find the matching times. It allows to match future matches, if a time matches the cron, past time matches (tbi)

# Parser

This package helps parse the cron expression and produces compiled cron expression object. As part of parsing, it validates the expressions and throws errors with meaningful messages.

## Cron Spec

Parser features

- Support for second
- Optional year
- Support for special flags (`? L W #`)
- Parses to persistable plain object which can be externally consumed
- No external dependencies
- Pretty well unit test covered
