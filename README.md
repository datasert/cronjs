## Overview

`cronjs` is set of Javascript modules which help with parsing, validating and evaluating cron expressions with support
for special flags (L, W, # and ?). This can be used in both Node and Browser and is written in Typescript.

Note that at this time the library does not have describer and scheduler, but we would like to add those features in.

This is a mono-repo with multiple published packages. To manage mono-repo, we
use [Yarn Workspaces](https://classic.yarnpkg.com/en/docs/workspaces/) along with [Lerna](https://lerna.js.org/).

It consists of the following packages:

- Parser

  This package helps parse the cron expression and produce a compiled cron expression object. As part of parsing, it
  validates the expressions and throws errors with meaningful messages.

- Matcher

  This package helps evaluate the parsed cron expression and find the matching times. It allows matching future matches,
  if a time matches the cron, past time matches (tbi)

## Cron Expressions

Cron expressions consist of various fields representing time units in fixed positions separated by spaces.

Field positions and its corresponding properties are defined as follows.

|              | second    | minute    | hour      | day of month    | month     | day of week     | year        |
| ------------ | --------- | --------- | --------- | --------------- | --------- | --------------- | ----------- |
| Required     |           | Yes       | Yes       | Yes             | Yes       | Yes             |             |
| Values Range | `0-59`    | `0-59`    | `0-23`    | `1-31`          | `1-12`    | `0-7`           | `1970-3000` |
| Flags        | `, - * /` | `, - * /` | `, - * /` | `, - * / ? L W` | `, - * /` | `, - * / ? L #` | `, - * /`   |
| Alias        |           |           |           |                 | jan-dec   | sun-sat         |             |

Cron expressions indicate time units which all should match for a time to match that expression. Given time matches
cron expression if and only if
`second + minute + day (day of week or day of month) + month + year` time unit matches. Note that we have two fields
for day (day of week and day of month). So at least one of them should match the time.
Each field allows common conventions to specify more than one value using various flags (as indicated in table above).
In that case, any value in the field matches the time, then that time unit condition is met.

All fields allow the following value types.

- `*`

  Asterisk indicates all values of that field.

- integer

  You can specify an integer indicating the time unit with in the allowed range. The allowed range for each field varies
  and is documented in the above table.

- range as `{lower}-{higher}`

  Range specifies series of values with in the range boundary. Ranges are inclusive.

  For example:

  ```
  0-4 => 0,1,2,3,4
  0-1 => 0,1
  ```

- steps as `{range | integer}/{integer}`

  Step is used to indicate the steps of values from given value to end of allowed range of within given range. If value
  is `*` then it is treated as lowest value of field range.

  For example (for hour):

  ```
  0/2    => 0,2,4,6,8...22
  */2    => (same as 0/2)
  10/3   => 10,13,16,19,22
  9/5    => 9,14,19
  1-10/5 => 1,6
  ```

- multiple values separated by comma as `{value1},{value2}...`

  Comma is used to separate multiple integers, ranges, and steps. They can also be mixed and matched. This can be used
  in all fields, but some fields have restrictions when special char is used.

  For example (for hour):

  ```
  1,2            => 1,2
  1-3,5-8        => 1,2,3,5,6,7,8
  1,2,5-8        => 1,2,5,6,7,8
  1-5/2,10-12,15 => 1,3,5,10,11,12,15
  ```

**Day field**

Day field is a very special among all other time unit fields. Because this is the only field that is not predictable.
For example, Jan is always the first month of the year. But Monday is not always the first day of the month. Hence, it
has special flags to deal with it and is as follows.

- day of month

  - `?` indicates omit this field. This can be used to match day solely based on the day of month. Note that you
    cannot specify ? for both fields and `?` cannot be combined with any other values.
  - `L` indicates last day of month. It matches the last day of the month in given time.
  - `{day integer}W` indicates week day (business day) closest to given day within the given month.

    For example:

    ```
    3W  => Weekday closest to 3rd of month. If 3rd if Sun then it matches 4th. If 3rd is Sat, it matches 2nd.
    ```

  - `LW` indicates last week day of month

- day of the week

  - `?` indicates omit this field. This can be used to match day solely based on the day of month. Note that you
    cannot specify ? for both fields and `?` cannot be combined with any other values.
  - `L` indicates last day of week. When it is used by itself, it always means `sat`.
  - `day_of_weekL` indicates last day of week of that type. For example `1L` last Monday of month.
  - `weekday#day_of_month` nth day of month. Number before `#` indicates weekday (sun-sat) and number after `#`
    indicates day of month.

    For example:

    ```
    1#2 => second monday
    2#2 => second tuesday
    3#2 => second wednesday
    ```

If you specify both `day of month` and `day of week` fields, then how it is interpreted according to
[POSIX](https://pubs.opengroup.org/onlinepubs/9699919799.2018edition/utilities/crontab.html) rules. Also see this
[Stackoverflow thread](https://unix.stackexchange.com/questions/602328/are-the-day-of-month-and-day-of-week-crontab-fields-mutually-exclusive)
for more info.

- If `day of month` and `day of week` are `*`, then every day will be matched

- If `day of month` is an element or list, but the `day of week` is `*`, then `day of month` is used
  and `day of week` is omitted

- If `day of month` is `*`, but `day of week` is an element or list, then `day of month` is omitted
  and `day of week` is used

- Finally, if both `day of month` and `day of week` is an element or list, then both will be considered and
  any day matching either `day of month`, or `the day of week`, shall be matched.

**Aliases**

Day of week and month allows values to be specified using alias instead of numbers. Aliases are case-insensitive. Alias
for Month is `jan-dec` and for day of week `sun-sat`

**Examples**

Here are some examples of cron expressions (without a second and year)

```
0 13 * * ?         => every day at 1 PM.
0 22 ? * 6L        => last Friday of every month at 10 PM.
0 10 ? * MON-FRI   => Monday through Friday at 10 AM.
0 20 * * ? 2010    => every day at 8 PM during the year 2010.
```

## Parser

Parser helps parse the cron expression and produces a compiled cron expression object. As part of parsing, it validates
the expressions and throws errors with meaningful messages.

Some noteworthy things about this parser.

- Supports parsing all aspects of cron expressions as explained above
- Parses to a plain javascript object which can be externally consumed or saved for reuse
- Supports multi-cron expressions using `|` separator
- Zero external dependencies
- Pretty fast (1000 parses per second)

### Usage

Add parser package to your project.

```
yarn add @datasert/cronjs-parser

or

npm add @datasert/cronjs-parser --save-dev
```

Import into your code

```javascript
import {parse} from '@datasert/cronjs-parser';
```

And call it with an expression.

```javascript
const parsedExpr = parse('0 10 ? * MON-FRI');
```

You can pass optional second parameter with options object with following options.

| Field      | Type    | Default Value | Description                                                              |
| ---------- | ------- | ------------- | ------------------------------------------------------------------------ |
| hasSeconds | boolean | false         | If your cron expression has seconds, indicate it the by specifying true. |

For example, parsing cron expression with seconds.

```javascript
const parsedExpr = parse('0 0 10 ? * MON-FRI', {hasSeconds: true});
```

If there are any errors, then it will throw a javascript Error with a message indicating what is wrong. If `parse`
method returns successfully, then your cron expression is fine.

## Matcher

Matcher finds the times matching the cron expressions. It can be used to match future matches, and if time matches a
cron expression.

Some noteworthy things about this matcher.

- Supports parsing all aspects of cron expressions as explained above
- Supports multi-cron expressions using `|` separator
- Single dependency on `luxon`

### Setup

Add matcher package to your project.

```
yarn add @datasert/cronjs-matcher

or

npm add @datasert/cronjs-matcher --save
```

Import into your code

```javascript
import * as cronjsMatcher from '@datasert/cronjs-matcher';
```

Below are various matcher methods.

### APIs

#### `getFutureMatches(expr: CronExprs | string, options?: MatchOptions)`

This method is used to find future matches starting from given datetime (inclusive). By default, it returns up to 5
matches. If you want more or less, you can specify the count using options.

```javascript
const futureMatches = cronjsMatcher.getFutureMatches('0/2 * * *', {startAt: '2020-01-01T00:00:00Z'});
console.log(futureMatches);
```

prints:

```shell
[
'2020-01-01T00:00:00Z',
'2020-01-01T00:12:00Z',
'2020-01-01T00:24:00Z',
'2020-01-01T00:36:00Z',
'2020-01-01T00:48:00Z',
]
```

Second argument is `MatchOptions` with any of the following fields.

| Field            | Type                      | Default Value | Description                                                                                                                           |
| ---------------- | ------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| timezone         | string                    | Etc/UTC       | Indicates the timezone of the cron expression                                                                                         |
| startAt          | string                    | Current Time  | The date/time in ISO8601 format to where to start the matching from (inclusive)                                                       |
| endAt            | string                    |               | The last date time (exclusive) to match                                                                                               |
| matchCount       | number                    | 5             | Number of matches to return                                                                                                           |
| formatInTimezone | boolean                   | false         | If set to true, then returned time strings will be formatted in the given timezone. Otherwise, they will be formatted in UTC timezone |
| maxLoopCount     | number                    | 10,000        | Max number of time matches to compute. This is kind of safe guard boundary                                                            |
| matchValidator   | Function<string, boolean> |               | Function which validates if a particular match is valid. This can be used to skip some matches based on business logic.               |

#### `isTimeMatches(expr: CronExprs | string, time: string, timezone?: string)`

This method allows you to compare if given time is matched by given cron expressions.

```javascript
console.log(cronjsMatcher.isTimeMatches('0 0 l * ?', '2020-02-28T00:00:00Z'));
console.log(cronjsMatcher.isTimeMatches('0 0 l * ?', '2020-02-29T00:00:00Z'));
```

prints:

```shell
false
true
```

Second argument is `MatchOptions` with any of the following fields (see above for more details on MatchOptions)
