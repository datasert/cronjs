// MIT License
//
// Copyright (c) 2020 Datasert Inc
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

function isTrue(val: any) {
  return val && val.toString() === 'true';
}

function dedupe(inArray: any[], keySupplier = (it: any) => it) {
  const seen = new Set();
  const deduped: any[] = [];

  inArray.forEach((x: any) => {
    const keyValue = keySupplier(x);
    if (!seen.has(keyValue)) {
      seen.add(keyValue);
      deduped.push(x);
    }
  });

  return deduped;
}

export interface PlainObject<T> {
  [key: string]: T;
}

export interface ParseOptions {
  hasSeconds?: boolean;
}

export interface CronField {
  values?: number[];
  all?: boolean;
  last?: boolean;
  weekday?: boolean;
  nth?: number;
  omit?: boolean;
}

export interface CronExpr extends PlainObject<CronField> {}

const VAL_L = 'l';
const VAL_Q = '?';
const VAL_H = '#';
const VAL_W = 'w';
const VAL_S = '*';

const PREDEFINED_EXPRS: PlainObject<string> = {
  '@yearly': '0 0 1 1 ?',
  '@monthly': '0 0 1 * ?',
  '@weekly': '0 0 ? * 0',
  '@daily': '0 0 * * ?',
  '@hourly': '0 * * * ?',
};

const FLD_SECOND = 'second';
const FLD_MINUTE = 'minute';
const FLD_HOUR = 'hour';
const FLD_DAY_OF_MONTH = 'day_of_month';
const FLD_MONTH = 'month';
const FLD_DAY_OF_WEEK = 'day_of_week';
const FLD_YEAR = 'year';

const FIELDS_LIST = [FLD_SECOND, FLD_MINUTE, FLD_HOUR, FLD_DAY_OF_MONTH, FLD_MONTH, FLD_DAY_OF_WEEK, FLD_YEAR];

interface FieldInfo {
  min: number;
  max: number;
  alias?: PlainObject<number>;
}

const FIELD_INFO: PlainObject<FieldInfo> = {
  [FLD_SECOND]: {
    min: 0,
    max: 59,
  },
  [FLD_MINUTE]: {
    min: 0,
    max: 59,
  },
  [FLD_HOUR]: {
    min: 0,
    max: 23,
  },
  [FLD_DAY_OF_MONTH]: {
    min: 1,
    max: 31,
  },
  [FLD_MONTH]: {
    min: 1,
    max: 12,
    alias: {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12,
    },
  },
  [FLD_DAY_OF_WEEK]: {
    min: 0,
    max: 7,
    alias: {
      7: 0,
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
    },
  },
  [FLD_YEAR]: {
    min: 1970,
    max: 3000,
  },
};

function invalidExpr(expr: string, msg: string) {
  return new Error(`Invalid cron expression [${expr}]. ${msg}`);
}

function parseField(expr: string, field: string, value: string): CronField {
  value = value.toLowerCase();

  if (value === VAL_S) {
    return {all: true};
  }

  if (field === FLD_DAY_OF_MONTH) {
    return parseDayOfMonth(expr, field, value);
  }

  if (field === FLD_DAY_OF_WEEK) {
    return parseDayOfWeek(expr, field, value);
  }

  return {
    values: parseValue(expr, field, value),
  };
}

function parseValue(expr: string, field: string, value: string): number[] | undefined {
  if (!value) {
    return undefined;
  }

  const values = dedupe(value.split(',').flatMap((part) => expandValue(expr, field, part))).sort((a, b) => a - b);
  const info = FIELD_INFO[field];

  if (values.length > 0) {
    if (values[0] < info.min) {
      throw invalidExpr(
        expr,
        `Value [${value}] out of range for field [${field}]. It must be greater than or equals to [${info.min}].`
      );
    }
  }

  if (info.max && values.length > 0) {
    if (values[values.length - 1] > info.max) {
      throw invalidExpr(
        expr,
        `Value [${value}] out of range for field [${field}]. It must be less than or equals to [${info.max}].`
      );
    }
  }

  return values;
}

function parseDayOfWeek(expr: string, field: string, value: string): CronField {
  if (value === VAL_Q) {
    return {omit: true};
  }

  let values: number[] | undefined = undefined;
  let last = false;
  let weekday = false;
  let nth: number | undefined = undefined;

  if (value === VAL_L) {
    return {values: [7]};
  }

  if (value.indexOf(VAL_L) >= 0) {
    last = true;
    value = value.replace(VAL_L, '');
  }

  if (value === VAL_W) {
    weekday = true;
    value = value.replace(VAL_W, '');
  }

  if (value.indexOf(VAL_H) >= 0) {
    const parts = value.split(VAL_H);
    if (parts.length !== 2) {
      throw invalidExpr(
        expr,
        `Invalid nth day value [${value}] for field [${field}]. It must be in the format weekday#day_of_month`
      );
    }
    values = parseValue(expr, field, parts[0]);
    nth = parseNumber(expr, field, parts[1]);

    if (nth < 1 || nth > 5) {
      throw invalidExpr(
        expr,
        `Invalid nth day of month value [${value}] for field [${field}]. It must be between 1 and 5`
      );
    }
  } else if (value) {
    values = parseValue(expr, field, value);
  }

  return createFieldValue(values, last, weekday, nth);
}

function parseDayOfMonth(expr: string, field: string, value: string): CronField {
  if (value === VAL_Q) {
    return {omit: true};
  }

  let values: number[] | undefined = undefined;
  let last = false;
  let weekday = false;

  if (value.indexOf(VAL_L) >= 0) {
    last = true;
    value = value.replace(VAL_L, '');
  }

  if (value.indexOf(VAL_W) >= 0) {
    weekday = true;
    value = value.replace(VAL_W, '');
  }

  if (last && value) {
    throw invalidExpr(
      expr,
      `Invalid L value [${value}] for field [${field}]. It can only be used standalone or combined with W.`
    );
  }

  if (value) {
    values = parseValue(expr, field, value);
  }

  return createFieldValue(values, last, weekday);
}

function expandValue(expr: string, field: string, value: string) {
  if (value.indexOf('/') >= 0) {
    return parseStepRange(expr, field, value);
  }

  if (value.indexOf('-') >= 0) {
    return parseRange(expr, field, value);
  }

  return [parseNumber(expr, field, unalias(field, value))];
}

function parseStepRange(expr: string, field: string, value: string) {
  const parts = value.split('/');
  if (parts.length != 2) {
    throw invalidExpr(
      expr,
      `Invalid step range [${value}] for field [${field}]. Expected exactly 2 values separated by a / but got [${parts.length}] values.`
    );
  }

  const info = FIELD_INFO[field];
  const fromParts = parts[0].indexOf('-') >= 0 ? parts[0].split('-') : [parts[0]];
  const from = parseNumber(expr, field, unalias(field, fromParts[0] === VAL_S ? info.min.toString() : fromParts[0]));
  const to = parseNumber(expr, field, unalias(field, fromParts.length > 1 ? fromParts[1] : info.max.toString()));
  const step = parseNumber(expr, field, unalias(field, parts[1]));

  if (from < info.min) {
    throw invalidExpr(
      expr,
      `Invalid step range [${value}] for field [${field}]. From value out of range. It must be greater than or equals to [${info.min}]`
    );
  }

  if (to > info.max) {
    throw invalidExpr(
      expr,
      `Invalid step range [${value}] for field [${field}]. To value out of range. It must be less than or equals to [${info.max}]`
    );
  }

  return getValues(from, to, step);
}

function parseRange(expr: string, field: string, value: string) {
  const parts = value.split('-');
  if (parts.length != 2) {
    throw invalidExpr(
      expr,
      `Invalid range [${value}] for field [${field}]. Expected exactly 2 values separated by a - but got [${parts.length}] values.`
    );
  }

  const from = parseNumber(expr, field, unalias(field, parts[0]));
  const to = parseNumber(expr, field, unalias(field, parts[1]));
  const info = FIELD_INFO[field];

  if (from >= to) {
    throw invalidExpr(expr, `Invalid range [${value}] for field [${field}]. From value must be less than to value.`);
  }

  if (from < info.min || to > info.max) {
    throw invalidExpr(
      expr,
      `Value [${value}] out of range for field [${field}]. It must be in range [${info.min}-${info.max}].`
    );
  }

  return getValues(from, to);
}

function parseNumber(expr: string, field: string, value: string) {
  try {
    const num = parseInt(value, 10);
    if (Number.isNaN(num)) {
      throw invalidExpr(expr, `Invalid numeric value [${value}] in field [${field}].`);
    }
    return num;
  } catch (e) {
    throw invalidExpr(expr, `Invalid numeric value [${value}] in field [${field}].`);
  }
}

function getValues(from: number, to: number, skip: number = 1) {
  const values: number[] = [];
  for (let i = from; i <= to; i += skip) {
    values.push(i);
  }

  return values;
}

function unalias(field: string, value: string) {
  const info = FIELD_INFO[field];
  const unaliased = (info.alias || {})[value];
  return unaliased === undefined ? value : unaliased.toString();
}

function createFieldValue(
  values: number[] | undefined,
  last?: boolean | undefined,
  weekday?: boolean | undefined,
  nth?: number | undefined
) {
  const resp: CronField = {};

  if (values) {
    resp.values = values;
  }

  if (last) {
    resp.last = true;
  }

  if (weekday) {
    resp.weekday = true;
  }

  if (nth) {
    resp.nth = nth;
  }

  return resp;
}

export function parse(expr: string, options: ParseOptions = {}) {
  if (!expr) {
    throw new Error(`Cron expression cannot be blank`);
  }

  let hasSeconds = isTrue(options.hasSeconds);
  let exprInternal = expr;

  if (PREDEFINED_EXPRS[exprInternal]) {
    exprInternal = PREDEFINED_EXPRS[expr];
    hasSeconds = false;
  }

  const minFields = hasSeconds ? 5 : 4;
  const maxFields = hasSeconds ? 7 : 6;

  const parts = exprInternal
    .trim()
    .split(/\s+/)
    .map((part) => part.trim());
  if (parts.length < minFields || parts.length > maxFields) {
    throw new Error(
      `Invalid cron expression [${expr}]. Expected [${minFields} to ${maxFields}] fields but found [${parts.length}] fields.`
    );
  }

  // If seconds is not specified, then defaults to 0th sec
  if (!hasSeconds) {
    parts.unshift('0');
  }

  // If day of week is not specified, will default to ?
  if (parts.length === 5) {
    parts.push('?');
  }

  // If year is not specified, then default to *
  if (parts.length === 6) {
    parts.push(VAL_S);
  }

  const fieldParts: PlainObject<string> = {};
  for (let i = 0; i < FIELDS_LIST.length; i++) {
    fieldParts[FIELDS_LIST[i]] = parts[i];
  }

  if (fieldParts[FLD_DAY_OF_MONTH] === VAL_Q && fieldParts[FLD_DAY_OF_WEEK] === VAL_Q) {
    throw invalidExpr(
      expr,
      `Valid non-omit [?] value must be specified for [${FLD_DAY_OF_MONTH}] or [${FLD_DAY_OF_WEEK}] fields.`
    );
  }

  const parsed: CronExpr = {};
  for (const field of FIELDS_LIST) {
    parsed[field] = parseField(expr, field, fieldParts[field]);
  }

  return parsed;
}
