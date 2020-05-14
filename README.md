## Overview

`cronjs` is set of Javascript modules which helps with parsing, validating and evaluating cron expressions with support for special flags (L, W, # and ?). This can be used in both Node and Browser and is written in Typescript.

Note that at this time library does not have describer and scheduler but we would like to add those features in.

This is a mono-repo with multiple published packages. To manage mono-repo, we use [Yarn Workspaces](https://classic.yarnpkg.com/en/docs/workspaces/) along with [Lerna](https://lerna.js.org/).

It consists of following packages:

- Parser

  This package helps parse the cron expression and produces compiled cron expression object. As part of parsing, it validates the expressions and throws errors with meaningful messages.

- Evaluator

  This package helps evaluate the parsed cron expression and find the matching times. It allows to match future matches, if a time matches the cron, past time matches (tbi)

## Cron Expressions

Cron expressions consists of various fields representing time units in fixed positions separated by spaces.

Field positions are as follows.

```
1 2 3 4 5 6 7
┬ ┬ ┬ ┬ ┬ ┬ ┬
│ │ │ │ │ │ └── year (optional)
│ │ │ │ │ └──── day of week
│ │ │ │ └────── month
│ │ │ └──────── day of month
│ │ └────────── hour
│ └──────────── minute
└────────────── second (optional)
```

Cron expressions indicates time units which all should match for a time to match that expression. Given time matches cron expression if and only if
`second + minute + day (day of week or day of month) + month + year` time units matches. Note that we have two fields for day (day of week and day of month). So at least one of them should match the time.
Each field allows common conventions to specify more than one value using below described conventions. In that case, any value in the field matches the time, then that time unit condition is met.

Following table details more information about each field.

| Field        | Required | Values Range | Wildcards      | Alias   |
| ------------ | -------- | ------------ | -------------- | ------- |
| second       |          | 0-59         | , - \* /       |         |
| minute       | Yes      | 0-59         | , - \* /       |         |
| hour         | Yes      | 0-59         | , - \* /       |         |
| day of month | Yes      | 1-31         | , - \* / ? L W |         |
| month        | Yes      | 1-12         | , - \* /       | jan-dec |
| day of week  | Yes      | 0-7          | , - \* / ? L # | sun-sat |
| year         |          | 1970-3000    | , - \* /       |         |

All fields allow following value types.

- `*`

  Asterisk indicates all values of that field.

- integer

  You can specify an integer indicating the time unit with in the allowed range. Allowed range for each field varies and is documented below.

- range as `{lower}-{higher}`

  Range specifies series of values with in the range boundary. Ranges are inclusive.

  For example:

  ```
  0-4 => 0,1,2,3,4
  0-1 => 0,1
  ```

- steps as `{range | integer}/{integer}`

  Step is used to indicate the steps of values from given value to end of allowed range of within given range. If value is `*` then it is treated as lowest value of field range.

  For example (for hour):

  ```
  0/2    => 0,2,4,6,8...22
  */2    => (same as 0/2)
  10/3   => 10,13,16,19,22
  9/5    => 9,14,19
  1-10/5 => 1,6
  ```

- multiple values separated by comma as `{value1},{value2}...`

  Comma is used to separated multiple integers, ranges and steps. They can also be mix and matched. This can be used in all fields but some fields have restrictions when special char is used.

  For example (for hour):

  ```
  1,2            => 1,2
  1-3,5-8        => 1,2,3,5,6,7,8
  1,2,5-8        => 1,2,5,6,7,8
  1-5/2,10-12,15 => 1,3,5,10,11,12,15
  ```

**Day field**

Day field is very special among all other time unit fields. Because this is the only field which is not predictable.
For example., Jan is always first of month. But Monday is not always first of month. Hence it has special chars to deal with it and is as follows.

- day of month

  - `?` indicates omit this field. This can be used to match day solely based on the day of month. Note that you cannot specify ? for both fields and `?` cannot be combined with any other values.
  - `L` indicates last day of month. It matches last day of month in given time.
  - `{day integer}W` indicates week day (business day) closest to given day within the given month.

    For example:

    ```
    3W  => Weekday closest to 3rd of month. If 3rd if Sun then it matches 4th. If 3rd is Sat, it matches 2nd.
    ```

  - `LW` indicates last week day of month

- day of week

  - `?` indicates omit this field. This can be used to match day solely based on the day of month. Note that you cannot specify ? for both fields and `?` cannot be combined with any other values.
  - `L` indicates last day of week. When it is used by itself, it always means `sat`.
  - `day_of_weekL` indicates last day of week of that type. For example `1L` last Monday of month.
  - `weekday#day_of_month` nth day of month. Number before `#` indicates weekday (sun-sat) and number after `#` indicates day of month.

    For example:

    ```
    1#2 => second monday
    2#2 => second tuesday
    3#2 => second wednesday
    ```

**Aliases**

Day of week and month allows values to be specified using alias insetad of numbers. Aliases are case insensitive. Alias for Month is `jan-dec` and for day of week `sun-sat`

**Examples**

Here are some examples of cron expressions (without second and year)

```
0 13 * * ?         => every day at 1 PM.
0 22 ? * 6L        => last Friday of every month at 10 PM.
0 10 ? * MON-FRI   => Monday through Friday at 10 AM.
0 20 * * ? 2010    => every day at 8 PM during the year 2010.
```

## Parser

Parser helps parse the cron expression and produces compiled cron expression object. As part of parsing, it validates the expressions and throws errors with meaningful messages.

Some noteworthy things about this parser.

- Supports parsing all aspects of cron expressions as explained above
- Parses to a plain javascript object which can be externally consumed or saved for reuse
- Zero external dependencies
- Pretty fast

### Usage

Add parser package to your project.

```
yarn add @datasert/cronjs-parser

or

npm add @datasert/cronjs-parser --save-dev
```

Import into your code

```javascript
import {parse} from `@datasert/cronjs-parser`
```

And call it with an expression.

```javascript
const parsedExpr = parse('0 10 ? * MON-FRI');
```

You can pass optional second parameter with options object with following options.

| Field      | Type    | Default Value | Description                                                              |
| ---------- | ------- | ------------- | ------------------------------------------------------------------------ |
| hasSeconds | boolean | false         | If your cron expression has seconds, indicate it the by specifying true. |

For example parsing cron expression with seconds.

```javascript
const parsedExpr = parse('0 0 10 ? * MON-FRI', {hasSeconds: true});
```

If there are any errors, then it will throw an javascript Error with message indicating what is wrong. If `parse` method returns successfully,
then your cron expression is fine.

## Evaluator

### Usage
