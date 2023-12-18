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

import {DateTime} from 'luxon';
import {
  FIELD_INFO,
  FieldType,
  CronField,
  CronExpr,
  CronExprs,
  parse,
  ParseOptions,
} from '@datasert/cronjs-parser/dist/parser';

export interface Func<I, O> {
  // eslint-disable-next-line no-unused-vars
  (input: I): O;
}

export interface MatchOptions extends ParseOptions {
  timezone?: string;
  startAt?: string;
  endAt?: string;
  matchCount?: number;
  formatInTimezone?: boolean;
  maxLoopCount?: number;
  matchValidator?: Func<string, boolean>;
}

const MAX_LOOP_COUNT = 100_000;
const DAY_SUN = 0;
const DAY_MON = 1;
const DAY_FRI = 5;
const DAY_SAT = 6;

const TZ_UTC = 'Etc/UTC';

const FIELDS: FieldType[] = ['second', 'minute', 'hour', 'day_of_month', 'month', 'year', 'day_of_week'];
const FIELDS_REVERSE = FIELDS.reverse() as FieldType[];

const FIELDS_SANS_DAY: FieldType[] = ['second', 'minute', 'hour', 'month', 'year'];
const FIELDS_SANS_DAY_REVERSE: FieldType[] = FIELDS_SANS_DAY.reverse();

// from https://stackoverflow.com/questions/4459928/how-to-deep-clone-in-javascript/
function deepClone(obj: any) {
  if (!obj) {
    return obj;
  }

  let v;
  const bObject: any = Array.isArray(obj) ? [] : {};
  for (const k in obj) {
    v = obj[k];
    bObject[k] = typeof v === 'object' ? deepClone(v) : v;
  }

  return bObject;
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

function sort(values: number[]): number[] {
  values.sort((a, b) => a - b);
  return values;
}

function getWeekDay(time: DateTime) {
  const weekday = time.weekday;
  return weekday === 7 ? 0 : weekday;
}

function getValues(from: number, to: number, step: number) {
  const values: number[] = [];

  if (step == 0) {
    values.push(from);
  } else {
    for (let i = from; i <= to; i += step) {
      values.push(i);
    }
  }

  return values;
}

function isBlank(values?: any[]) {
  return !values || values.length === 0;
}

function expandFields(exprs: CronExprs, field: FieldType, startYear: number): number[] {
  const values: number[] = [];
  exprs.expressions.forEach((expr: CronExpr) => {
    values.push(...expandField(expr, field, startYear));
  });

  return values.length === 0 ? values : sort(dedupe(values));
}

function expandField(expr: CronExpr, field: FieldType, startYear: number): number[] {
  const exprField = expr[field];
  if (exprField.omit) {
    return field === 'second' ? [0] : [];
  }

  if (field === 'day_of_week') {
    const info = FIELD_INFO.day_of_month;
    return getValues(info.min, info.max, 1);
  }

  const info = FIELD_INFO[field];
  const all =
    exprField.all ||
    exprField.lastDay ||
    exprField.lastWeekday ||
    !isBlank(exprField.lastDays) ||
    !isBlank(exprField.nearestWeekdays) ||
    !isBlank(exprField.nthDays);

  const values = [...(exprField.values || [])];

  if (all) {
    const from = field == 'year' ? startYear : info.min;
    values.push(...getValues(from, info.max, 1));
    return values;
  }

  if (exprField.ranges) {
    exprField.ranges.forEach((range) => {
      values.push(...getValues(range.from, range.to, 1));
    });
  }

  if (exprField.steps) {
    exprField.steps.forEach((step) => {
      values.push(...getValues(step.from, step.to, step.step));
    });
  }

  if (exprField.steps) {
    exprField.steps.forEach((step) => {
      values.push(...getValues(step.from, step.to, step.step));
    });
  }

  return values;
}

function mergeExprs(exprs: CronExprs, startYear: number): CronExpr {
  const mergedExpr: Partial<Record<FieldType, CronField>> = {};
  for (const field of FIELDS_REVERSE) {
    if (field === 'day_of_week' || field === 'day_of_month') {
      continue;
    }

    mergedExpr[field] = {
      values: expandFields(exprs, field, startYear),
    };
  }

  mergedExpr.day_of_month = {
    values: sort(
      dedupe([...expandFields(exprs, 'day_of_month', startYear), ...expandFields(exprs, 'day_of_week', startYear)])
    ),
  };

  return mergedExpr as CronExpr;
}

function simplifyField(expr: CronExpr, field: FieldType) {
  const exprField = expr[field];
  if (exprField.steps) {
    exprField.values = exprField.values || [];

    exprField.steps.forEach((step) => {
      exprField.values!!.push(...getValues(step.from, step.to, step.step));
    });

    delete exprField.steps;
  }
}

function simplifyExprs(exprs: CronExprs): CronExprs {
  for (const expr of exprs.expressions) {
    // Some intricate scenarios pertaining to day of month and day of week
    // https://unix.stackexchange.com/questions/602328/are-the-day-of-month-and-day-of-week-crontab-fields-mutually-exclusive

    // If either the month or day of month is specified as an element or list, but the day of week is an <asterisk>,
    // the month and day of month fields shall specify the days that match.
    if (!expr.day_of_month.omit && !expr.day_of_week.omit) {
      if (!expr.day_of_month.all && expr.day_of_week.all) {
        delete expr.day_of_week.all;
        expr.day_of_week.omit = true;
      }

      // If both month and day of month are specified as an <asterisk>, but day of week is an element or list,
      // then only the specified days of the week match.
      if (expr.day_of_month.all && !expr.day_of_week.all && !expr.day_of_week.omit) {
        delete expr.day_of_month.all;
        expr.day_of_month.omit = true;
      }
    }

    for (const field of FIELDS_REVERSE) {
      simplifyField(expr, field);
    }
  }

  return exprs;
}

function setTime(time: DateTime, values: object): DateTime {
  return time.set(values);
}

function* getTimeSeries(exprs: CronExprs, startTime: DateTime) {
  const mergedExpr = mergeExprs(exprs, startTime.year);
  const startMillis = startTime.toMillis();

  let newTime = startTime;
  let startTimeReached = false;

  for (const year of mergedExpr.year.values!!) {
    if (year < startTime.year) {
      continue;
    }

    newTime = setTime(newTime, {year});

    for (const month of mergedExpr.month.values!!) {
      if (year === startTime.year && month < startTime.month) {
        continue;
      }

      newTime = setTime(newTime, {month});

      for (const day of mergedExpr.day_of_month.values!!) {
        if (year === startTime.year && month === startTime.month && day < startTime.day) {
          continue;
        }

        if (day > newTime.daysInMonth) {
          continue;
        }

        newTime = setTime(newTime, {day});

        for (const hour of mergedExpr.hour.values!!) {
          if (year === startTime.year && month === startTime.month && day === startTime.day && hour < startTime.hour) {
            continue;
          }

          newTime = setTime(newTime, {hour});

          for (const minute of mergedExpr.minute.values!!) {
            newTime = setTime(newTime, {minute});

            for (const second of mergedExpr.second.values!!) {
              newTime = setTime(newTime, {second});

              if (!startTimeReached) {
                if (newTime.toMillis() >= startMillis) {
                  startTimeReached = true;
                }
              }

              if (startTimeReached) {
                // console.log(`##### yielding time ${newTime.toISO()}`);
                yield newTime;
              }
            }
          }
        }
      }
    }
  }

  return undefined;
}

function getLastDay(time: DateTime, day?: number) {
  let endOfMonth = time.endOf('month');
  const lastDay = endOfMonth.day;
  if (day === undefined) {
    return lastDay;
  }

  while (getWeekDay(endOfMonth) !== day) {
    endOfMonth = endOfMonth.plus({day: -1});
  }

  return endOfMonth.day;
}

function getLastWeekDay(time: DateTime) {
  const endOfMonth = time.endOf('month');
  const lastDay = getWeekDay(endOfMonth);
  if (lastDay >= DAY_MON && lastDay <= DAY_FRI) {
    return endOfMonth.day;
  }

  return getLastDay(time, DAY_FRI);
}

/**
 * Returns all days of particular type in the month. For ex., returns all mondays or fridays etc
 */
function getDaysOfType(time: DateTime, day: number) {
  const days: number[] = [];
  for (let i = 1; i < 31; i++) {
    const newTime = time.set({day: i});
    if (newTime.month != time.month) {
      // means it split over to next month
      break;
    }

    if (getWeekDay(newTime) === day) {
      days.push(newTime.day);
    }
  }

  return days;
}

function isWeekday(time: DateTime) {
  const lastDay = getWeekDay(time);
  return lastDay >= DAY_MON && lastDay <= DAY_FRI;
}

function isDay(time: DateTime, day: number) {
  return getWeekDay(time) === day;
}

function setDayWithinMonth(time: DateTime, day: number) {
  if (time.daysInMonth < day) {
    day = time.daysInMonth;
  }

  return time.set({day});
}

function isNearestWeekDay(evalTime: DateTime, day: number) {
  if (!isWeekday(evalTime)) {
    return false;
  }

  const dayTime = setDayWithinMonth(evalTime, day);

  // if time matches the day, then it is perfect match.
  if (evalTime.day === dayTime.day) {
    return true;
  }

  // if eval time is friday and day is sat, then it is match.
  if (isDay(dayTime, DAY_SAT)) {
    // if sat is first of month, then monday is the match
    if (dayTime.day === 1) {
      return evalTime.day === 3;
    }

    // otherwise friday is match
    return dayTime.day - 1 == evalTime.day;
  }

  if (isDay(dayTime, DAY_SUN)) {
    // if sunday is last day of month, then two days minus sunday is match
    if (dayTime.day === evalTime.daysInMonth) {
      return evalTime.day === evalTime.daysInMonth - 2;
    }

    return dayTime.day + 1 == evalTime.day;
  }

  return false;
}

function isInRange(from: number, to: number, value: number) {
  return value >= from && value <= to;
}

function isFieldMatches(expr: CronExpr, field: FieldType, timeValue: number): boolean {
  const value = expr[field];

  if (!value || value.all) {
    return true;
  }

  if (value.omit) {
    // if the second field is omitted, then ignore seconds
    return field === 'second';
  }

  if (value.values && value.values.includes(timeValue)) {
    return true;
  }

  if (value.ranges && value.ranges.find((range) => isInRange(range.from, range.to, timeValue))) {
    return true;
  }

  return false;
}

function isDayOfMonthMatches(expr: CronExpr, field: FieldType, time: DateTime) {
  const info = expr[field];

  if (info.omit) {
    return false;
  }

  // Last week day of month
  if (info.lastWeekday && time.day === getLastWeekDay(time)) {
    return true;
  }

  // last day of month
  if (info.lastDay && time.day === getLastDay(time)) {
    return true;
  }

  if (
    !isBlank(info.nearestWeekdays) &&
    info.nearestWeekdays!!.find((day) => isNearestWeekDay(time, day)) !== undefined
  ) {
    return true;
  }

  // Finally, we will do the usual values check
  return isFieldMatches(expr, field, time.day);
}

function isDayOfWeekMatches(expr: CronExpr, field: FieldType, time: DateTime) {
  const info = expr[field];
  if (info.omit) {
    return false;
  }

  if (info.lastDay && getWeekDay(time) === DAY_SAT) {
    return true;
  }

  if (!isBlank(info.lastDays) && info.lastDays!!.find((day) => time.day === getLastDay(time, day)) !== undefined) {
    // Last day of kind
    return true;
  }

  // nth day
  if (!isBlank(info.nthDays)) {
    if (
      info.nthDays!!.find((nthDay) => {
        const days = getDaysOfType(time, nthDay.day_of_week);
        return days.length >= nthDay.instance && days[nthDay.instance - 1] === time.day;
      }) !== undefined
    ) {
      return true;
    }
  }

  // Finally, we will do the usual values check
  return isFieldMatches(expr, field, getWeekDay(time));
}

function isExprMatches(expr: CronExpr, startTime: DateTime) {
  for (const field of FIELDS_SANS_DAY_REVERSE) {
    if (!isFieldMatches(expr, field, (startTime as any)[field])) {
      return false;
    }
  }

  // Now all easy parts of the date matches, now is the time to evaluate complicated day field
  return isDayOfMonthMatches(expr, 'day_of_month', startTime) || isDayOfWeekMatches(expr, 'day_of_week', startTime);
}

function isExprsMatches(exprs: CronExprs, time: DateTime): boolean {
  return exprs.expressions.find((expr: CronExpr) => isExprMatches(expr, time)) !== undefined;
}

function getOutputTime(newTime: DateTime, options: MatchOptions) {
  if (options.formatInTimezone) {
    return newTime.toISO({suppressMilliseconds: true});
  } else {
    return `${newTime.setZone(TZ_UTC).toISO({suppressMilliseconds: true, includeOffset: false})}Z`;
  }
}

/**
 * Evaluates the parsed cron expression and returns the run times.
 * Note that it is assumed that cron expression is parsed using @datasert/cron-parser. Otherwise the results
 * are undefined.
 */
export function getFutureMatches(expr: CronExprs | string, options: MatchOptions = {}): string[] {
  const dtoptions = {zone: options.timezone || TZ_UTC};

  // If input contains millisecond, it used to use that find future matches which can lead to millisecond rounding
  // errors. So by setting ms to 0, we can avoid it.
  const startTime = DateTime.fromISO(options.startAt ? options.startAt : new Date().toISOString(), dtoptions).set({
    millisecond: 0,
  });

  const endTime = options.endAt ? DateTime.fromISO(options.endAt, dtoptions) : undefined;
  const count = options.matchCount || 5;
  const nextTimes: string[] = [];
  const cronExprs = simplifyExprs(typeof expr === 'string' ? parse(expr, options) : deepClone(expr));
  const timeSeries = getTimeSeries(cronExprs, startTime);

  const maxLoopCount = options.maxLoopCount || MAX_LOOP_COUNT;
  let loopCount = 0;
  while (loopCount < maxLoopCount) {
    loopCount++;

    const newTime = timeSeries.next().value;
    if (!newTime || (endTime && newTime.toMillis() >= endTime.toMillis())) {
      break;
    }

    if (newTime.toMillis() < startTime.toMillis()) {
      continue;
    }

    // console.log('####### checking time', newTime.toISO());
    if (isExprsMatches(cronExprs, newTime)) {
      const time = getOutputTime(newTime, options);
      const matchOk = options.matchValidator ? options.matchValidator(time) : true;
      if (matchOk) {
        nextTimes.push(time);
      }
    }

    if (nextTimes.length >= count) {
      break;
    }
  }

  return nextTimes;
}

export function isTimeMatches(exprs: CronExprs | string, time: string, timezone?: string): boolean {
  const cronExprs = simplifyExprs(typeof exprs === 'string' ? parse(exprs) : deepClone(exprs));
  const startTime = DateTime.fromISO(time, {zone: timezone || TZ_UTC});
  return isExprsMatches(cronExprs, startTime);
}
