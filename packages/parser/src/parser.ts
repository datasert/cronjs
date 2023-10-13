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
// FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

export interface PlainObject<T> {
  [key: string]: T;
}

export interface ParseOptions {
  hasSeconds?: boolean;
}

export interface CronRange {
  from: number;
  to: number;
}

export interface CronStep {
  from: number;
  to: number;
  step: number;
}

export interface CronNth {
  day_of_week: number;
  instance: number;
}

export interface CronField {
  all?: boolean;
  omit?: boolean;
  ranges?: CronRange[];
  steps?: CronStep[];
  nthDays?: CronNth[];
  values?: number[];
  lastDay?: boolean;
  lastDays?: number[];
  lastWeekday?: boolean;
  nearestWeekdays?: number[];
}

export type CronExpr = Record<FieldType, CronField>;

export interface CronExprs {
  pattern: string;
  expressions: CronExpr[];
}

const VAL_L = 'l';
const VAL_W = 'w';
const VAL_LW = 'lw';
const VAL_Q = '?';
const VAL_HASH = '#';
const VAL_STAR = '*';
const VAL_DASH = '-';
const VAL_SLASH = '/';

const PREDEFINED_EXPRS: PlainObject<string> = {
  '@yearly': '0 0 1 1 ?',
  '@monthly': '0 0 1 * ?',
  '@weekly': '0 0 ? * 0',
  '@daily': '0 0 * * ?',
  '@hourly': '0 * * * ?',
};

export interface FieldInfo {
  min: number;
  max: number;
  alias?: PlainObject<number>;
}

export type FieldType = 'second' | 'minute' | 'hour' | 'month' | 'day_of_month' | 'day_of_week' | 'year';
export const FIELD_INFO: Record<FieldType, FieldInfo> = {
  second: {min: 0, max: 59},
  minute: {min: 0, max: 59},
  hour: {min: 0, max: 23},
  day_of_month: {min: 1, max: 31},
  month: {
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
  day_of_week: {
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
  year: {min: 1970, max: 2099},
};
const FIELDS: FieldType[] = ['second', 'minute', 'hour', 'day_of_month', 'month', 'day_of_week', 'year'];

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

function splitAndCleanup(input: string, sep: string) {
  return dedupe(
    input
      .split(sep)
      .map((part) => part.trim())
      .filter((part) => part)
  );
}

function invalidExpr(expr: string, msg: string) {
  return new Error(`Invalid cron expression [${expr}]. ${msg}`);
}

function parseField(expr: string, field: FieldType, value: string): CronField {
  value = value.toLowerCase().trim();

  if (value === VAL_STAR) {
    return {all: true};
  }

  if (value === VAL_Q) {
    return parseQ(expr, field, value);
  }

  const parts: string[] = splitAndCleanup(value, ',');
  const parsed: CronField = {};

  for (const part of parts) {
    if (!part) {
      continue;
    }

    if (part.indexOf(VAL_SLASH) >= 0) {
      parsed.steps = parsed.steps || [];
      parsed.steps.push(parseStepRange(expr, field, part));
    } else if (part.indexOf(VAL_DASH) >= 0) {
      parsed.ranges = parsed.ranges || [];
      parsed.ranges.push(parseRange(expr, field, part));
    } else if (part.indexOf(VAL_HASH) >= 0) {
      parsed.nthDays = parsed.nthDays || [];
      parsed.nthDays.push(parseNth(expr, field, part));
    } else if (part === VAL_L) {
      parsed.lastDay = parseL(expr, field, part);
    } else if (part === VAL_LW) {
      parsed.lastWeekday = parseLW(expr, field, part);
    } else if (field === 'day_of_month' && part.indexOf(VAL_W) >= 0) {
      parsed.nearestWeekdays = parsed.nearestWeekdays || [];
      parsed.nearestWeekdays.push(parseNearestWeekday(expr, field, part));
    } else if (field === 'day_of_week' && part.endsWith(VAL_L)) {
      parsed.lastDays = parsed.lastDays || [];
      parsed.lastDays.push(parseLastDays(expr, field, part));
    } else {
      parsed.values = parsed.values || [];
      parsed.values.push(parseValue(expr, field, part));
    }
  }

  if (parsed.values) {
    parsed.values = dedupe(parsed.values);
  }

  return parsed;
}

function parseL(expr: string, field: FieldType, value: string): boolean {
  if (field === 'day_of_week' || field === 'day_of_month') {
    return true;
  }

  throw invalidExpr(
    expr,
    `Invalid value for [${value}] for field [${field}]. It can be used only for [day_of_month or day_of_week] fields.`
  );
}

function parseQ(expr: string, field: FieldType, value: string): CronField {
  if (field === 'day_of_week' || field === 'day_of_month') {
    return {omit: true};
  }

  throw invalidExpr(
    expr,
    `Invalid Value [${value}] for field [${field}]. It can be specified only for [day_of_month or day_of_week] fields.`
  );
}

function parseLW(expr: string, field: FieldType, value: string): boolean {
  if (field === 'day_of_month') {
    return true;
  }

  throw invalidExpr(
    expr,
    `Invalid value for [${value}] for field [${field}]. It can be used only for [day_of_month] fields.`
  );
}

function parseValue(expr: string, field: FieldType, value: string): number {
  const num = parseNumber(expr, field, value);
  const info = FIELD_INFO[field];
  if (num < info.min) {
    throw invalidExpr(
      expr,
      `Value [${value}] out of range for field [${field}]. It must be greater than or equals to [${info.min}].`
    );
  }

  if (info.max && num > info.max) {
    throw invalidExpr(
      expr,
      `Value [${value}] out of range for field [${field}]. It must be less than or equals to [${info.max}].`
    );
  }

  return num;
}

function parseStepRange(expr: string, field: FieldType, value: string): CronStep {
  const parts = value.split(VAL_SLASH);
  if (parts.length != 2) {
    throw invalidExpr(
      expr,
      `Invalid step range [${value}] for field [${field}]. Expected exactly 2 values separated by a / but got [${parts.length}] values.`
    );
  }

  const info = FIELD_INFO[field];
  const fromParts = parts[0].indexOf(VAL_DASH) >= 0 ? parts[0].split(VAL_DASH) : [parts[0]];
  const from = fromParts[0] === VAL_STAR ? info.min : parseNumber(expr, field, unalias(field, fromParts[0]));
  const to = fromParts.length > 1 ? parseNumber(expr, field, unalias(field, fromParts[1])) : info.max;
  const step = parseNumber(expr, field, unalias(field, parts[1]));

  if (from < info.min) {
    throw invalidExpr(
      expr,
      `Invalid step range [${value}] for field [${field}]. From value [${from}] out of range. It must be greater than or equals to [${info.min}]`
    );
  }

  if (to > info.max) {
    throw invalidExpr(
      expr,
      `Invalid step range [${value}] for field [${field}]. To value [${to}] out of range. It must be less than or equals to [${info.max}]`
    );
  }

  if (step > info.max) {
    throw invalidExpr(
      expr,
      `Invalid step range [${value}] for field [${field}]. Step value [${value}] out of range. It must be less than or equals to [${info.max}]`
    );
  }

  return {from, to, step};
}

function parseNth(expr: string, field: FieldType, value: string): CronNth {
  if (field !== 'day_of_week') {
    throw invalidExpr(
      expr,
      `Invalid value [${value}] for field [${field}]. Nth day can be used only in [day_of_week] field.`
    );
  }

  const parts = value.split(VAL_HASH);
  if (parts.length !== 2) {
    throw invalidExpr(
      expr,
      `Invalid nth day value [${value}] for field [${field}]. It must be in [day_of_week#instance] format.`
    );
  }

  const day_of_week = parseNumber(expr, field, parts[0]);
  const instance = parseNumber(expr, undefined, parts[1]);

  if (instance < 1 || instance > 5) {
    throw invalidExpr(
      expr,
      `Invalid Day of Week instance value [${instance}] for field [${field}]. It must be between 1 and 5.`
    );
  }

  return {
    day_of_week,
    instance: instance,
  };
}

function parseNearestWeekday(expr: string, field: FieldType, value: string): number {
  if (field !== 'day_of_month') {
    throw invalidExpr(
      expr,
      `Invalid value [${value}] for field [${field}]. Nearest weekday can be used only in [day_of_month] field.`
    );
  }

  return parseNumber(expr, field, value.split(VAL_W)[0]);
}

function parseLastDays(expr: string, field: FieldType, value: string): number {
  return parseNumber(expr, field, value.split(VAL_L)[0]);
}

function parseRange(expr: string, field: FieldType, value: string) {
  const parts = value.split(VAL_DASH);

  if (parts.length != 2) {
    throw invalidExpr(
      expr,
      `Invalid range [${value}] for field [${field}]. Range should have two values separated by a - but got [${parts.length}] values.`
    );
  }

  const from = parseNumber(expr, field, unalias(field, parts[0]));
  let to = parseNumber(expr, field, unalias(field, parts[1]));

  // For day of week, sun will act as 0 or 7 depending on if it is in from or to
  if (field == 'day_of_week') {
    if (to === 0) {
      to = 7;
    }
  }

  if (from >= to) {
    throw invalidExpr(expr, `Invalid range [${value}] for field [${field}]. From value must be less than to value.`);
  }

  const info = FIELD_INFO[field];

  if (from < info.min || to > info.max) {
    throw invalidExpr(
      expr,
      `Invalid range [${value}] for field [${field}]. From or to value is out of allowed min/max values. Allowed values are between [${info.min}-${info.max}].`
    );
  }

  return {from, to};
}

function parseNumber(expr: string, field: FieldType | undefined, value: string) {
  const num = parseInt(unalias(field, value), 10);
  if (Number.isNaN(num)) {
    throw invalidExpr(expr, `Invalid numeric value [${value}] in field [${field}].`);
  }
  return num;
}

function unalias(field: FieldType | undefined, value: string) {
  if (!field) {
    return value;
  }

  const info = FIELD_INFO[field];
  const unaliased = (info.alias || {})[value];
  return unaliased === undefined ? value : unaliased.toString();
}

function parseExpr(expr: string, options: ParseOptions) {
  if (!expr) {
    throw new Error(`Cron expression cannot be blank`);
  }

  let exprInternal = expr;

  let hasSeconds = options.hasSeconds;
  if (PREDEFINED_EXPRS[exprInternal]) {
    exprInternal = PREDEFINED_EXPRS[expr];
    hasSeconds = false;
  }

  const minFields = hasSeconds ? 5 : 4;
  const maxFields = hasSeconds ? 7 : 6;

  const parts = exprInternal
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part);

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
    parts.push(VAL_Q);
  }

  // If year is not specified, then default to *
  if (parts.length === 6) {
    parts.push(VAL_STAR);
  }

  const fieldParts: PlainObject<string> = {};
  for (let i = 0; i < FIELDS.length; i++) {
    fieldParts[FIELDS[i]] = parts[i];
  }

  const parsed: CronExpr = {} as CronExpr;
  for (const field of FIELDS) {
    if (field === 'second' && !hasSeconds) {
      parsed[field] = {omit: true};
    } else {
      (parsed as any)[field] = parseField(expr, field, fieldParts[field]);
    }
  }

  return parsed;
}

export function parse(exprs: string, options: ParseOptions = {}) {
  if (!exprs) {
    throw new Error(`Cron expression cannot be blank`);
  }

  options.hasSeconds = isTrue(options.hasSeconds);
  const resp: CronExprs = {
    pattern: exprs,
    expressions: splitAndCleanup(exprs, '|').map((expr) => parseExpr(expr, options)),
  };

  return resp;
}
