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
import {CronExpr, CronExprs, CronField, PlainObject, parse} from '@datasert/cronjs-parser';

export interface MatchOptions {
  timezone?: string;
  startAt?: string;
  endAt?: string;
  matchCount?: number;
  formatInTimezone?: boolean;
  maxLoopCount?: number;
}

interface FieldInfo {
  min: number;
  max: number;
}

const MAX_LOOP_COUNT = 10_000;
const FLD_SECOND = 'second';
const FLD_MINUTE = 'minute';
const FLD_HOUR = 'hour';
const FLD_DAY_OF_MONTH = 'day_of_month';
const FLD_MONTH = 'month';
const FLD_DAY_OF_WEEK = 'day_of_week';
const FLD_YEAR = 'year';
const DAY_SUN = 0;
const DAY_MON = 1;
const DAY_FRI = 5;
const DAY_SAT = 6;

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
  },
  [FLD_DAY_OF_WEEK]: {
    min: 0,
    max: 6,
  },
  [FLD_YEAR]: {
    min: 1970,
    max: 2099,
  },
};

const TZ_UTC = 'Etc/UTC';
const FIELDS = [FLD_SECOND, FLD_MINUTE, FLD_HOUR, FLD_DAY_OF_MONTH, FLD_MONTH, FLD_YEAR, FLD_DAY_OF_WEEK].reverse();
const FIELDS_SANS_DAY_REVERSE = [FLD_SECOND, FLD_MINUTE, FLD_HOUR, FLD_MONTH, FLD_YEAR].reverse();

// from https://stackoverflow.com/questions/4459928/how-to-deep-clone-in-javascript/
function deepClone(obj: any) {
  if (!obj) {
    return obj;
  }

  let v;
  let bObject: any = Array.isArray(obj) ? [] : {};
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
  for (let i = from; i <= to; i += step) {
    values.push(i);
  }

  return values;
}

function isBlank(values?: any[]) {
  return !values || values.length === 0;
}

function expandFields(exprs: CronExprs, field: string): number[] {
  const values: number[] = [];
  exprs.expressions.forEach((expr: CronExpr) => {
    values.push(...expandField(expr, field));
  });

  return values.length === 0 ? values : sort(dedupe(values));
}

function expandField(expr: CronExpr, field: string): number[] {
  const exprField = expr[field];
  if (exprField.omit) {
    return field === FLD_SECOND ? [0] : [];
  }

  if (field === FLD_DAY_OF_WEEK) {
    const info = FIELD_INFO[FLD_DAY_OF_MONTH];
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
    const from = field == FLD_YEAR ? new Date().getFullYear() : info.min;
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

function mergeExprs(exprs: CronExprs): CronExpr {
  const mergedExpr: PlainObject<CronField> = {};
  for (const field of FIELDS) {
    if (field === FLD_DAY_OF_WEEK || field === FLD_DAY_OF_MONTH) {
      continue;
    }

    mergedExpr[field] = {
      values: expandFields(exprs, field),
    };
  }

  mergedExpr[FLD_DAY_OF_MONTH] = {
    values: sort(dedupe([...expandFields(exprs, FLD_DAY_OF_MONTH), ...expandFields(exprs, FLD_DAY_OF_WEEK)])),
  };

  return mergedExpr;
}

function simplifyField(expr: CronExpr, field: string) {
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
    for (const field of FIELDS) {
      simplifyField(expr, field);
    }
  }

  return exprs;
}

function setTime(time: DateTime, values: object): DateTime {
  return time.set(values);
}

function* getTimeSeries(exprs: CronExprs, startTime: DateTime) {
  const mergedExpr = mergeExprs(exprs);
  const startMillis = startTime.toMillis();

  let newTime = startTime;
  let startTimeReached = false;

  for (let year of mergedExpr[FLD_YEAR].values!!) {
    if (year < startTime.year) {
      continue;
    }

    newTime = setTime(newTime, {year});

    for (let month of mergedExpr[FLD_MONTH].values!!) {
      if (year === startTime.year && month < startTime.month) {
        continue;
      }

      newTime = setTime(newTime, {month});

      for (let day of mergedExpr[FLD_DAY_OF_MONTH].values!!) {
        if (year === startTime.year && month === startTime.month && day < startTime.day) {
          continue;
        }

        if (day > newTime.daysInMonth) {
          continue;
        }

        newTime = setTime(newTime, {day});

        for (let hour of mergedExpr[FLD_HOUR].values!!) {
          if (year === startTime.year && month === startTime.month && day === startTime.day && hour < startTime.hour) {
            continue;
          }

          newTime = setTime(newTime, {hour});

          for (let minute of mergedExpr[FLD_MINUTE].values!!) {
            newTime = setTime(newTime, {minute});

            for (let second of mergedExpr[FLD_SECOND].values!!) {
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
  let endOfMonth = time.endOf('month');
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

function isFieldMatches(expr: CronExpr, field: string, timeValue: number): boolean {
  const value = expr[field];

  if (!value || value.all) {
    return true;
  }

  if (value.omit) {
    // omit in second matches only if second is zero.
    if (field === FLD_SECOND) {
      return timeValue === 0;
    } else {
      return false;
    }
  }

  if (value.values && value.values.includes(timeValue)) {
    return true;
  }

  if (value.ranges && value.ranges.find((range) => isInRange(range.from, range.to, timeValue))) {
    return true;
  }

  return false;
}

function isDayOfMonthMatches(expr: CronExpr, field: string, time: DateTime) {
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

  // finally we will do usual values check
  return isFieldMatches(expr, field, time.day);
}

function isDayOfWeekMatches(expr: CronExpr, field: string, time: DateTime) {
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
        return days.length > nthDay.instance && days[nthDay.instance - 1] === time.day;
      }) !== undefined
    ) {
      return true;
    }
  }

  // finally we will do usual values check
  return isFieldMatches(expr, field, getWeekDay(time));
}

function isExprMatches(expr: CronExpr, startTime: DateTime) {
  for (const field of FIELDS_SANS_DAY_REVERSE) {
    // @ts-ignore
    if (!isFieldMatches(expr, field, startTime[field])) {
      return false;
    }
  }

  // Now all all easy part of the date matches, now is the time to evaluate complicated day field
  return isDayOfMonthMatches(expr, FLD_DAY_OF_MONTH, startTime) || isDayOfWeekMatches(expr, FLD_DAY_OF_WEEK, startTime);
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
  const startTime = DateTime.fromISO(options.startAt ? options.startAt : new Date().toISOString(), dtoptions);
  const endTime = options.endAt ? DateTime.fromISO(options.endAt, dtoptions) : undefined;
  const count = options.matchCount || 5;
  const nextTimes: string[] = [];
  const cronExprs = simplifyExprs(typeof expr === 'string' ? parse(expr) : deepClone(expr));
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
      nextTimes.push(getOutputTime(newTime, options));
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
