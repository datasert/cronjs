import {parse} from '@datasert/cronjs-parser';
import * as subject from '../../src/matcher';
import {MatchOptions} from '../../src/matcher';

function expectFutureMatches(expr: string, runTimes: string[], evalOptions?: MatchOptions) {
  const output = subject.getFutureMatches(
    expr,
    Object.assign({}, {startAt: '2020-01-01T00:00:00Z', count: runTimes.length}, evalOptions)
  );
  // console.log(`####### output [${expr}]`, JSON.stringify(output));
  expect(output).toEqual(runTimes);
  return output;
}

describe('getFutureMatches', () => {
  it('every minute', () => {
    expectFutureMatches('* * * *', ['2020-01-01T00:00:00Z', '2020-01-01T00:01:00Z']);
  });

  it('minute: 0 and 5', () => {
    expectFutureMatches('0,5 * * *', ['2020-01-01T00:00:00Z', '2020-01-01T00:05:00Z']);
  });

  it('minute: range 1-3', () => {
    expectFutureMatches('1-3 * * *', ['2020-01-01T00:01:00Z', '2020-01-01T00:02:00Z', '2020-01-01T00:03:00Z']);
  });

  it('minute: steps 0/12', () => {
    expectFutureMatches('0/12 * * *', [
      '2020-01-01T00:00:00Z',
      '2020-01-01T00:12:00Z',
      '2020-01-01T00:24:00Z',
      '2020-01-01T00:36:00Z',
      '2020-01-01T00:48:00Z',
    ]);
  });

  it('minute: even minute', () => {
    expectFutureMatches('0/2 * * *', [
      '2020-01-01T00:00:00Z',
      '2020-01-01T00:02:00Z',
      '2020-01-01T00:04:00Z',
      '2020-01-01T00:06:00Z',
      '2020-01-01T00:08:00Z',
    ]);
  });

  it('every uneven minute', () => {
    expectFutureMatches('1/2 * ? * *', [
      '2020-01-01T00:01:00Z',
      '2020-01-01T00:03:00Z',
      '2020-01-01T00:05:00Z',
      '2020-01-01T00:07:00Z',
      '2020-01-01T00:09:00Z',
    ]);
  });

  it('every 3 mins', () => {
    expectFutureMatches('0/3 * * *', [
      '2020-01-01T00:00:00Z',
      '2020-01-01T00:03:00Z',
      '2020-01-01T00:06:00Z',
      '2020-01-01T00:09:00Z',
      '2020-01-01T00:12:00Z',
    ]);
  });

  it('every 4 mins', () => {
    expectFutureMatches('0/4 * * *', [
      '2020-01-01T00:00:00Z',
      '2020-01-01T00:04:00Z',
      '2020-01-01T00:08:00Z',
      '2020-01-01T00:12:00Z',
      '2020-01-01T00:16:00Z',
    ]);
  });

  it('every 5 mins', () => {
    expectFutureMatches('0/5 * * *', [
      '2020-01-01T00:00:00Z',
      '2020-01-01T00:05:00Z',
      '2020-01-01T00:10:00Z',
      '2020-01-01T00:15:00Z',
      '2020-01-01T00:20:00Z',
    ]);
  });

  it('Every hour at minutes 15, 30 and 45', () => {
    expectFutureMatches('15,30,45 * ? * *', [
      '2020-01-01T00:15:00Z',
      '2020-01-01T00:30:00Z',
      '2020-01-01T00:45:00Z',
      '2020-01-01T01:15:00Z',
      '2020-01-01T01:30:00Z',
    ]);
  });

  it('Every hour', () => {
    expectFutureMatches('0 * ? * *', [
      '2020-01-01T00:00:00Z',
      '2020-01-01T01:00:00Z',
      '2020-01-01T02:00:00Z',
      '2020-01-01T03:00:00Z',
      '2020-01-01T04:00:00Z',
    ]);
  });

  it('Every even hour', () => {
    expectFutureMatches('0 0/2 ? * *', [
      '2020-01-01T00:00:00Z',
      '2020-01-01T02:00:00Z',
      '2020-01-01T04:00:00Z',
      '2020-01-01T06:00:00Z',
      '2020-01-01T08:00:00Z',
    ]);
  });

  it('Every odd hour', () => {
    expectFutureMatches('0 1/2 ? * *', [
      '2020-01-01T01:00:00Z',
      '2020-01-01T03:00:00Z',
      '2020-01-01T05:00:00Z',
      '2020-01-01T07:00:00Z',
      '2020-01-01T09:00:00Z',
    ]);
  });

  it('Jan 1st', () => {
    expectFutureMatches('0 0 1 jan', [
      '2020-01-01T00:00:00Z',
      '2021-01-01T00:00:00Z',
      '2022-01-01T00:00:00Z',
      '2023-01-01T00:00:00Z',
      '2024-01-01T00:00:00Z',
    ]);
  });

  it('Every leap year day', () => {
    expectFutureMatches('0 0 29 feb', [
      '2020-02-29T00:00:00Z',
      '2024-02-29T00:00:00Z',
      '2028-02-29T00:00:00Z',
      '2032-02-29T00:00:00Z',
      '2036-02-29T00:00:00Z',
    ]);
  });

  it('Every last day of month', () => {
    expectFutureMatches('0 0 l *', [
      '2020-01-31T00:00:00Z',
      '2020-02-29T00:00:00Z',
      '2020-03-31T00:00:00Z',
      '2020-04-30T00:00:00Z',
      '2020-05-31T00:00:00Z',
      '2020-06-30T00:00:00Z',
      '2020-07-31T00:00:00Z',
      '2020-08-31T00:00:00Z',
      '2020-09-30T00:00:00Z',
      '2020-10-31T00:00:00Z',
      '2020-11-30T00:00:00Z',
      '2020-12-31T00:00:00Z',
    ]);
  });

  it('Every last day of month and last weekday of month', () => {
    expectFutureMatches('0 0 l,lw *', [
      '2020-01-31T00:00:00Z',
      '2020-02-28T00:00:00Z',
      '2020-02-29T00:00:00Z',
      '2020-03-31T00:00:00Z',
      '2020-04-30T00:00:00Z',
      '2020-05-29T00:00:00Z',
      '2020-05-31T00:00:00Z',
      '2020-06-30T00:00:00Z',
      '2020-07-31T00:00:00Z',
      '2020-08-31T00:00:00Z',
      '2020-09-30T00:00:00Z',
      '2020-10-30T00:00:00Z',
    ]);
  });

  it('Every last workday of month', () => {
    expectFutureMatches('0 0 lw *', [
      '2020-01-31T00:00:00Z',
      '2020-02-28T00:00:00Z',
      '2020-03-31T00:00:00Z',
      '2020-04-30T00:00:00Z',
      '2020-05-29T00:00:00Z',
      '2020-06-30T00:00:00Z',
      '2020-07-31T00:00:00Z',
      '2020-08-31T00:00:00Z',
      '2020-09-30T00:00:00Z',
      '2020-10-30T00:00:00Z',
      '2020-11-30T00:00:00Z',
      '2020-12-31T00:00:00Z',
    ]);
  });

  it('Last sat and last sun of month', () => {
    expectFutureMatches('0 0 ? * 0l,6l', [
      '2020-01-25T00:00:00Z',
      '2020-01-26T00:00:00Z',
      '2020-02-23T00:00:00Z',
      '2020-02-29T00:00:00Z',
      '2020-03-28T00:00:00Z',
      '2020-03-29T00:00:00Z',
      '2020-04-25T00:00:00Z',
      '2020-04-26T00:00:00Z',
      '2020-05-30T00:00:00Z',
      '2020-05-31T00:00:00Z',
      '2020-06-27T00:00:00Z',
      '2020-06-28T00:00:00Z',
    ]);
  });

  it('Mon to Fri at 1am', () => {
    expectFutureMatches('0 1 ? * mon-fri', [
      '2020-01-01T01:00:00Z',
      '2020-01-02T01:00:00Z',
      '2020-01-03T01:00:00Z',
      '2020-01-06T01:00:00Z',
      '2020-01-07T01:00:00Z',
      '2020-01-08T01:00:00Z',
      '2020-01-09T01:00:00Z',
      '2020-01-10T01:00:00Z',
      '2020-01-13T01:00:00Z',
      '2020-01-14T01:00:00Z',
      '2020-01-15T01:00:00Z',
      '2020-01-16T01:00:00Z',
    ]);
  });

  it('Every day at midnight - 12am', () => {
    expectFutureMatches('0 0 * * ?', [
      '2020-01-01T00:00:00Z',
      '2020-01-02T00:00:00Z',
      '2020-01-03T00:00:00Z',
      '2020-01-04T00:00:00Z',
      '2020-01-05T00:00:00Z',
      '2020-01-06T00:00:00Z',
      '2020-01-07T00:00:00Z',
      '2020-01-08T00:00:00Z',
      '2020-01-09T00:00:00Z',
      '2020-01-10T00:00:00Z',
      '2020-01-11T00:00:00Z',
      '2020-01-12T00:00:00Z',
    ]);
  });

  it('Every day at 6am', () => {
    expectFutureMatches('0 6 * * ?', [
      '2020-01-01T06:00:00Z',
      '2020-01-02T06:00:00Z',
      '2020-01-03T06:00:00Z',
      '2020-01-04T06:00:00Z',
      '2020-01-05T06:00:00Z',
    ]);
  });

  it('Mon-fri at 6am', () => {
    expectFutureMatches('0 6 ? * mon-fri', [
      '2020-01-01T06:00:00Z',
      '2020-01-02T06:00:00Z',
      '2020-01-03T06:00:00Z',
      '2020-01-06T06:00:00Z',
      '2020-01-07T06:00:00Z',
    ]);
  });

  it('Sat-Sun at 6am', () => {
    expectFutureMatches('0 6 ? * sat,sun', [
      '2020-01-04T06:00:00Z',
      '2020-01-05T06:00:00Z',
      '2020-01-11T06:00:00Z',
      '2020-01-12T06:00:00Z',
      '2020-01-18T06:00:00Z',
    ]);
  });

  it('Every day at noon - 12pm', () => {
    expectFutureMatches('0 12 * *', [
      '2020-01-01T12:00:00Z',
      '2020-01-02T12:00:00Z',
      '2020-01-03T12:00:00Z',
      '2020-01-04T12:00:00Z',
      '2020-01-05T12:00:00Z',
    ]);
  });

  it('Every day at noon between September and December', () => {
    expectFutureMatches('0 12 ? 9-12 *', [
      '2020-09-01T12:00:00Z',
      '2020-09-02T12:00:00Z',
      '2020-09-03T12:00:00Z',
      '2020-09-04T12:00:00Z',
      '2020-09-05T12:00:00Z',
    ]);
  });

  it('Every month on the last Friday, at noon', () => {
    expectFutureMatches('0 12 ? * 6L', [
      '2020-01-25T12:00:00Z',
      '2020-02-29T12:00:00Z',
      '2020-03-28T12:00:00Z',
      '2020-04-25T12:00:00Z',
      '2020-05-30T12:00:00Z',
    ]);
  });

  it('Last fri of year', () => {
    expectFutureMatches('0 0 LW DEC', [
      '2020-12-31T00:00:00Z',
      '2021-12-31T00:00:00Z',
      '2022-12-30T00:00:00Z',
      '2023-12-29T00:00:00Z',
      '2024-12-31T00:00:00Z',
    ]);
  });

  it('First mon of each month', () => {
    expectFutureMatches('0 0 ? * 1#1', [
      '2020-01-06T00:00:00Z',
      '2020-02-03T00:00:00Z',
      '2020-03-02T00:00:00Z',
      '2020-04-06T00:00:00Z',
      '2020-05-04T00:00:00Z',
    ]);
  });

  it('First mon of jan', () => {
    expectFutureMatches('0 0 ? jan 1#1', [
      '2020-01-06T00:00:00Z',
      '2021-01-04T00:00:00Z',
      '2022-01-03T00:00:00Z',
      '2023-01-02T00:00:00Z',
      '2024-01-01T00:00:00Z',
    ]);
  });

  it('Weekday near to 18th of Month', () => {
    expectFutureMatches('0 0 18W *', [
      '2020-01-17T00:00:00Z',
      '2020-02-18T00:00:00Z',
      '2020-03-18T00:00:00Z',
      '2020-04-17T00:00:00Z',
      '2020-05-18T00:00:00Z',
    ]);
  });

  it('Nearest Weekday: 1st', () => {
    expectFutureMatches('0 0 1W *', [
      '2020-01-01T00:00:00Z',
      '2020-02-03T00:00:00Z',
      '2020-03-02T00:00:00Z',
      '2020-04-01T00:00:00Z',
      '2020-05-01T00:00:00Z',
      '2020-06-01T00:00:00Z',
      '2020-07-01T00:00:00Z',
      '2020-08-03T00:00:00Z',
    ]);
  });

  it('Nearest Weekday: 2nd', () => {
    expectFutureMatches('0 0 2W *', [
      '2020-01-02T00:00:00Z',
      '2020-02-03T00:00:00Z',
      '2020-03-02T00:00:00Z',
      '2020-04-02T00:00:00Z',
      '2020-05-01T00:00:00Z',
      '2020-06-02T00:00:00Z',
      '2020-07-02T00:00:00Z',
      '2020-08-03T00:00:00Z',
    ]);
  });

  it('Nearest Weekday: 3rd', () => {
    expectFutureMatches('0 0 3W *', [
      '2020-01-03T00:00:00Z',
      '2020-02-03T00:00:00Z',
      '2020-03-03T00:00:00Z',
      '2020-04-03T00:00:00Z',
      '2020-05-04T00:00:00Z',
      '2020-06-03T00:00:00Z',
      '2020-07-03T00:00:00Z',
      '2020-08-03T00:00:00Z',
    ]);
  });

  it('Nearest Weekday: 4th', () => {
    expectFutureMatches('0 0 4W *', [
      '2020-01-03T00:00:00Z',
      '2020-02-04T00:00:00Z',
      '2020-03-04T00:00:00Z',
      '2020-04-03T00:00:00Z',
      '2020-05-04T00:00:00Z',
      '2020-06-04T00:00:00Z',
      '2020-07-03T00:00:00Z',
      '2020-08-04T00:00:00Z',
    ]);
  });

  it('Nearest Weekday: 5th', () => {
    expectFutureMatches('0 0 5W *', [
      '2020-01-06T00:00:00Z',
      '2020-02-05T00:00:00Z',
      '2020-03-05T00:00:00Z',
      '2020-04-06T00:00:00Z',
      '2020-05-05T00:00:00Z',
      '2020-06-05T00:00:00Z',
      '2020-07-06T00:00:00Z',
      '2020-08-05T00:00:00Z',
    ]);
  });

  it('Nearest Weekday: 28th', () => {
    expectFutureMatches('0 0 28W *', [
      '2020-01-28T00:00:00Z',
      '2020-02-28T00:00:00Z',
      '2020-03-27T00:00:00Z',
      '2020-04-28T00:00:00Z',
      '2020-05-28T00:00:00Z',
      '2020-06-29T00:00:00Z',
      '2020-07-28T00:00:00Z',
      '2020-08-28T00:00:00Z',
    ]);
  });

  it('Nearest Weekday: 29th', () => {
    expectFutureMatches('0 0 29W *', [
      '2020-01-29T00:00:00Z',
      '2020-02-28T00:00:00Z',
      '2020-03-30T00:00:00Z',
      '2020-04-29T00:00:00Z',
      '2020-05-29T00:00:00Z',
      '2020-06-29T00:00:00Z',
      '2020-07-29T00:00:00Z',
      '2020-08-28T00:00:00Z',
    ]);
  });

  it('Nearest Weekday: 30th', () => {
    expectFutureMatches('0 0 30W *', [
      '2020-01-30T00:00:00Z',
      '2020-02-28T00:00:00Z',
      '2020-03-30T00:00:00Z',
      '2020-04-30T00:00:00Z',
      '2020-05-29T00:00:00Z',
      '2020-06-30T00:00:00Z',
      '2020-07-30T00:00:00Z',
      '2020-08-31T00:00:00Z',
    ]);
  });

  it('Nearest Weekday: 31st', () => {
    expectFutureMatches('0 0 31W *', [
      '2020-01-31T00:00:00Z',
      '2020-02-28T00:00:00Z',
      '2020-03-31T00:00:00Z',
      '2020-04-30T00:00:00Z',
      '2020-05-29T00:00:00Z',
      '2020-06-30T00:00:00Z',
      '2020-07-31T00:00:00Z',
      '2020-08-31T00:00:00Z',
      '2020-09-30T00:00:00Z',
    ]);
  });
});

describe('getFutureMatches with timezones', () => {
  it('1 am every day in pacific', () => {
    expectFutureMatches('0 1 * *', ['2020-01-01T09:00:00Z', '2020-01-02T09:00:00Z'], {timezone: 'America/Los_Angeles'});
  });

  it('10 pm every day in pacific', () => {
    expectFutureMatches('0 22 * *', ['2020-01-02T06:00:00Z', '2020-01-03T06:00:00Z'], {
      timezone: 'America/Los_Angeles',
    });
  });

  it('10 pm every day in pacific with output in pacific', () => {
    expectFutureMatches('0 22 * *', ['2020-01-01T22:00:00-08:00', '2020-01-02T22:00:00-08:00'], {
      timezone: 'America/Los_Angeles',
      formatInTimezone: true,
    });
  });

  it('1 am every day in new york', () => {
    expectFutureMatches('0 1 * *', ['2020-01-01T06:00:00Z', '2020-01-02T06:00:00Z'], {timezone: 'America/New_York'});
  });
});

function checkPerformance(expr: string, count: number = 1000) {
  const parsed = parse(expr);
  for (let i = 0; i < count; i++) {
    subject.getFutureMatches(parsed);
  }
}
describe('getFutureMatches - performance (1000 evals)', () => {
  it('cron: every min', () => checkPerformance('* * * * ?'));
  it('cron: every 10 mins', () => checkPerformance('0/10 * * * ?'));
  it('cron: every hour', () => checkPerformance('0 * * * ?'));
  it('cron: every 6 hours', () => checkPerformance('0 0/6 * * ?'));
  it('cron: every 12 hours', () => checkPerformance('0 0/12 * * ?'));
  it('cron: every day', () => checkPerformance('0 0 * * ?'));
  it('cron: every month', () => checkPerformance('0 0 1 * ?'));
  it('cron: every year', () => checkPerformance('0 0 1 1 ?'));
});
