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
import {CronExpr, CronField, PlainObject} from '@datasert/cron-parser';

export interface EvalOptions {
  timezone?: string;
  startAt?: string;
  endAt?: string;
  count?: number;
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
const FIELDS_SANS_DAY_LIST_REVERSE = [FLD_SECOND, FLD_MINUTE, FLD_HOUR, FLD_MONTH, FLD_YEAR].reverse();

function getWeekDay(time: DateTime) {
  const weekday = time.weekday;
  return weekday === 7 ? 0 : weekday;
}

function expandField(eexpr: CronExpr, field: string) {
  const exprField = eexpr[field];

  if (exprField.all) {
    exprField.values = [];
    const info = FIELD_INFO[field];
    const from = field == FLD_YEAR ? new Date().getFullYear() : info.min;
    for (let i = from; i <= info.max; i++) {
      exprField.values.push(i);
    }
  } else {
    exprField.values = exprField.values || [];
  }
}

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

function expandExpr(expr: CronExpr) {
  const eexpr = deepClone(expr);
  for (const field of FIELDS) {
    if (field === FLD_DAY_OF_WEEK || field === FLD_DAY_OF_MONTH) {
      continue;
    }

    expandField(eexpr, field);
  }

  // if day of week omitted and day of month has no flags, then will expand according to month values
  const dayOfMonth = eexpr[FLD_DAY_OF_MONTH];
  const dayOfWeek = eexpr[FLD_DAY_OF_WEEK];

  if (dayOfMonth.all || dayOfMonth.last || dayOfMonth.weekday || !dayOfWeek.omit) {
    dayOfMonth.all = true;
  }

  expandField(eexpr, FLD_DAY_OF_MONTH);

  return eexpr;
}

function setTime(time: DateTime, values: object): DateTime {
  return time.set(values);
}

function* getTimeSeries(expr: CronExpr, startTime: DateTime) {
  const newExpr = expandExpr(expr);
  const startMillis = startTime.toMillis();

  let newTime = startTime;
  let startTimeReached = false;

  for (let year of newExpr[FLD_YEAR].values!!) {
    if (year < startTime.year) {
      continue;
    }

    newTime = setTime(newTime, {year});

    for (let month of newExpr[FLD_MONTH].values!!) {
      if (year === startTime.year && month < startTime.month) {
        continue;
      }

      newTime = setTime(newTime, {month});

      for (let day of newExpr[FLD_DAY_OF_MONTH].values!!) {
        if (year === startTime.year && month === startTime.month && day < startTime.day) {
          continue;
        }

        if (day > newTime.daysInMonth) {
          continue;
        }

        newTime = setTime(newTime, {day});

        for (let hour of newExpr[FLD_HOUR].values!!) {
          if (year === startTime.year && month === startTime.month && day === startTime.day && hour < startTime.hour) {
            continue;
          }

          newTime = setTime(newTime, {hour});

          for (let minute of newExpr[FLD_MINUTE].values!!) {
            newTime = setTime(newTime, {minute});

            for (let second of newExpr[FLD_SECOND].values!!) {
              newTime = setTime(newTime, {second});

              if (!startTimeReached) {
                if (newTime.toMillis() >= startMillis) {
                  startTimeReached = true;
                }
              }

              if (startTimeReached) {
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

function getLastWorkDay(time: DateTime) {
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

function isFieldMatches(expr: CronExpr, field: string, timeValue: number) {
  const value = expr[field];
  if (!value || value.all) {
    return true;
  }

  return value.values && value.values.includes(timeValue);
}

function isDayOfMonthMatches(expr: CronExpr, field: string, time: DateTime) {
  const info = expr[field];
  if (info.omit) {
    return false;
  }

  // Last week day of month
  if (info.last && info.weekday) {
    return time.day === getLastWorkDay(time);
  }

  // last day of month
  if (info.last) {
    return time.day === getLastDay(time);
  }

  if (info.weekday && !isValuesEmpty(info)) {
    return isNearestWeekDay(time, info.values!![0]);
  }

  // finally we will do usual values check
  return isFieldMatches(expr, field, time.day);
}

function isValuesEmpty(info: CronField) {
  return !info.values || info.values.length === 0;
}

function isDayOfWeekMatches(expr: CronExpr, field: string, time: DateTime) {
  const info = expr[field];
  if (info.omit) {
    return false;
  }

  // last
  if (info.last) {
    // last day of week by itself
    if (isValuesEmpty(info)) {
      return getWeekDay(time) === DAY_SAT;
    }

    // Last day of kind
    return time.day === getLastDay(time, info.values!![0]);
  }

  // nth day
  if (info.nth && info.nth >= 0 && !isValuesEmpty(info)) {
    const days = getDaysOfType(time, info.values!![0]);
    return days.length > info.nth && days[info.nth - 1] === time.day;
  }

  // finally we will do usual values check
  return isFieldMatches(expr, field, getWeekDay(time));
}

function isExprMatches(expr: CronExpr, startTime: DateTime) {
  for (const field of FIELDS_SANS_DAY_LIST_REVERSE) {
    // @ts-ignore
    if (!isFieldMatches(expr, field, startTime[field])) {
      return false;
    }
  }

  // Now all all easy part of the date matches, now is the time to evaluate complicated day field
  return isDayOfMonthMatches(expr, FLD_DAY_OF_MONTH, startTime) || isDayOfWeekMatches(expr, FLD_DAY_OF_WEEK, startTime);
}

function getOutputTime(newTime: DateTime, options: EvalOptions) {
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
export function getFutureMatches(expr: CronExpr, options: EvalOptions = {}): string[] {
  const dtoptions = {zone: options.timezone || TZ_UTC};
  const startTime = DateTime.fromISO(options.startAt ? options.startAt : new Date().toISOString(), dtoptions);
  const endTime = options.endAt ? DateTime.fromISO(options.endAt, dtoptions) : undefined;
  const count = options.count || 5;
  const nextTimes: string[] = [];
  const timeSeries = getTimeSeries(expr, startTime);

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

    if (isExprMatches(expr, newTime)) {
      nextTimes.push(getOutputTime(newTime, options));
    }

    if (nextTimes.length >= count) {
      break;
    }
  }

  return nextTimes;
}

export function isTimeMatches(expr: CronExpr, time: string, timezone?: string): boolean {
  let startTime = DateTime.fromISO(time, {zone: timezone || TZ_UTC});
  return isExprMatches(expr, startTime) || false;
}
