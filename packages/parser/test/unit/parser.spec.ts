import * as subject from '../../src/parser';

// Some expr generator
// https://freeformatter.com/cron-expression-generator-quartz.html

const FLD_SECOND = 'second';
const FLD_MINUTE = 'minute';
const FLD_HOUR = 'hour';
const FLD_DAY_OF_MONTH = 'day_of_month';
const FLD_MONTH = 'month';
const FLD_DAY_OF_WEEK = 'day_of_week';
const FLD_YEAR = 'year';

const FIELDS_LIST = [FLD_SECOND, FLD_MINUTE, FLD_HOUR, FLD_DAY_OF_MONTH, FLD_MONTH, FLD_DAY_OF_WEEK, FLD_YEAR];

function parseError(expr: string, msg: string) {
  expect(() => subject.parse(expr)).toThrow(msg);
}

function parse(expr: string, expected: any) {
  for (const field of FIELDS_LIST) {
    if (expected[field]) {
      continue;
    }

    if (field === FLD_SECOND) {
      expected[field] = {values: [0]};
    } else if (field === FLD_DAY_OF_WEEK) {
      expected[field] = {omit: true};
    } else {
      expected[field] = {all: true};
    }
  }

  const output = subject.parse(expr);
  // console.log(`####### output [${expr}]`, JSON.stringify(output));
  expect(output).toEqual(expected);
}

describe('valid expressions', () => {
  it('every minute', () => {
    parse('* * * *', {});
  });

  it('minute: range', () => {
    parse('0-12 * * *', {
      minute: {values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]},
    });
  });

  it('minute: multiple ranges', () => {
    parse('0-12,20-30 * * *', {
      minute: {values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]},
    });
  });

  it('minute: multiple ranges out of order', () => {
    parse('20-30,0-12 * * *', {
      minute: {values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]},
    });
  });

  it('minute: multiple ranges along with single values', () => {
    parse('20-30,0-12,55,56 * * *', {
      minute: {values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 55, 56]},
    });
  });

  it('minute: steps', () => {
    parse('0/5 * * *', {
      minute: {values: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]},
    });
  });

  it('minute: steps with * as starting value', () => {
    parse('*/5 * * *', {
      minute: {values: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]},
    });
  });

  it('minute: range steps', () => {
    parse('0-17/5 * * *', {
      minute: {values: [0, 5, 10, 15]},
    });
  });

  it('minute: multiple steps', () => {
    parse('0/5,1/5 * * *', {
      minute: {values: [0, 1, 5, 6, 10, 11, 15, 16, 20, 21, 25, 26, 30, 31, 35, 36, 40, 41, 45, 46, 50, 51, 55, 56]},
    });
  });

  it('minute: multiple range steps', () => {
    parse('0-17/5,20-30/2 * * *', {
      minute: {values: [0, 5, 10, 15, 20, 22, 24, 26, 28, 30]},
    });
  });

  it('minute: odd steps1', () => {
    parse('0/11 * * *', {
      minute: {values: [0, 11, 22, 33, 44, 55]},
    });
  });

  it('minute: odd steps2', () => {
    parse('0/17 * * *', {
      minute: {values: [0, 17, 34, 51]},
    });
  });

  it('day of month: last day of month', () => {
    parse('* * L *', {
      day_of_month: {last: true},
    });
  });

  it('day of month: last weekday of month', () => {
    parse('* * LW *', {
      day_of_month: {last: true, weekday: true},
    });
  });

  it('day of month: weekday of month', () => {
    parse('* * w *', {
      day_of_month: {weekday: true},
    });
  });

  it('day of month: range', () => {
    parse('* * 1-5 *', {
      day_of_month: {values: [1, 2, 3, 4, 5]},
    });
  });

  it('day of month: multiple ranges', () => {
    parse('* * 1-5,9-15 *', {
      day_of_month: {values: [1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 15]},
    });
  });

  it('day of month: steps', () => {
    parse('* * 3/7 *', {
      day_of_month: {values: [3, 10, 17, 24, 31]},
    });
  });

  it('day of month: values', () => {
    parse('* * 3,5 *', {
      day_of_month: {values: [3, 5]},
    });
  });

  it('day of month: values with steps', () => {
    parse('* * 3,5,1/3 *', {
      day_of_month: {values: [1, 3, 4, 5, 7, 10, 13, 16, 19, 22, 25, 28, 31]},
    });
  });

  it('day of month: weekday near to 20th', () => {
    parse('* * 20W *', {
      day_of_month: {values: [20], weekday: true},
    });
  });

  it('month: alias', () => {
    parse('* * * jan', {
      month: {values: [1]},
    });
  });

  it('month: alias range', () => {
    parse('* * * jan-mar', {
      month: {values: [1, 2, 3]},
    });
  });

  it('month: alias range and alias value', () => {
    parse('* * * jan-mar,dec', {
      month: {values: [1, 2, 3, 12]},
    });
  });

  it('month: alias range and alias value', () => {
    parse('* * * jan-mar,dec', {
      month: {values: [1, 2, 3, 12]},
    });
  });

  it('month: value', () => {
    parse('* * * 1,2', {
      month: {values: [1, 2]},
    });
  });

  it('month: value range', () => {
    parse('* * * 1-3', {
      month: {values: [1, 2, 3]},
    });
  });

  it('month: value ranges', () => {
    parse('* * * 1-3,7-9', {
      month: {values: [1, 2, 3, 7, 8, 9]},
    });
  });

  it('month: alias value steps', () => {
    parse('* * * jan/3', {
      month: {values: [1, 4, 7, 10]},
    });
  });

  it('month: alias mixed case', () => {
    parse('* * * jan,FEB,mAR', {
      month: {values: [1, 2, 3]},
    });
  });

  it('day of week: omit', () => {
    parse('* * * * ?', {
      day_of_week: {omit: true},
    });
  });

  it('day of week: all', () => {
    parse('* * * * *', {
      day_of_week: {all: true},
    });
  });

  it('day of week: nth day of month', () => {
    parse('* * * * sun#2', {
      day_of_week: {values: [0], nth: 2},
    });
  });

  it('day of week: alias mixed case', () => {
    parse('* * * * Mon,TUE,wEd', {
      day_of_week: {values: [1, 2, 3]},
    });
  });

  it('day of week: 0 or 7 for Sun', () => {
    parse('* * * * sun', {
      day_of_week: {values: [0]},
    });
    parse('* * * * 0', {
      day_of_week: {values: [0]},
    });
    parse('* * * * 7', {
      day_of_week: {values: [0]},
    });
    parse('* * * * 7,0', {
      day_of_week: {values: [0]},
    });
  });

  it('day of week: last sun of month', () => {
    parse('* * * * sunl', {
      day_of_week: {values: [0], last: true},
    });
  });

  it('day of week: Sun is decoded as 0', () => {
    parse('* * * * SUN,sun,Sun', {
      day_of_week: {values: [0]},
    });
  });

  it('day of week: First sun', () => {
    parse('* * ? * 0#1', {
      day_of_month: {omit: true},
      day_of_week: {values: [0], nth: 1},
    });
  });

  it('day of week: 5th Mon', () => {
    parse('* * ? * 1#5', {
      day_of_month: {omit: true},
      day_of_week: {values: [1], nth: 5},
    });
  });

  it('day of week: 5th Mon', () => {
    parse('* * ? * 1#5', {
      day_of_month: {omit: true},
      day_of_week: {values: [1], nth: 5},
    });
  });

  it('day of week: last sat of month', () => {
    parse('* * ? * 6L', {
      day_of_month: {omit: true},
      day_of_week: {values: [6], last: true},
    });
  });

  it('day of week: first mon of year', () => {
    parse('0 0 ? jan 1#1', {
      second: {values: [0]},
      minute: {values: [0]},
      hour: {values: [0]},
      day_of_month: {omit: true},
      month: {values: [1]},
      day_of_week: {values: [1], nth: 1},
    });
  });

  it('day of week and day of month: 15th or Sun', () => {
    parse('* * 15 * sun', {
      day_of_month: {values: [15]},
      day_of_week: {values: [0]},
    });
  });

  it('day of week and day of month: omit day of month', () => {
    parse('* * ? * sun', {
      day_of_month: {omit: true},
      day_of_week: {values: [0]},
    });
  });

  it('day of week and day of month: 15th or Sun', () => {
    parse('* * 15 * sun', {
      day_of_month: {values: [15]},
      day_of_week: {values: [0]},
    });
  });
});

describe('invalid expressions', () => {
  it('blank expr', () => {
    // @ts-ignore
    expect(() => subject.parse()).toThrow('Cron expression cannot be blank');
  });

  it('less number of fields', () => {
    expect(() => subject.parse('*')).toThrow(
      'Invalid cron expression [*]. Expected [4 to 6] fields but found [1] fields.'
    );

    expect(() => subject.parse('* * *')).toThrow(
      'Invalid cron expression [* * *]. Expected [4 to 6] fields but found [3] fields.'
    );
  });

  it('second out of range', () => {
    expect(() => subject.parse('60 * * ? * *', {hasSeconds: true})).toThrow(
      'Invalid cron expression [60 * * ? * *]. Value [60] out of range for field [second]. It must be less than or equals to [59].'
    );
  });

  it('minute out of range', () => {
    parseError(
      '60 * ? * *',
      'Invalid cron expression [60 * ? * *]. Value [60] out of range for field [minute]. It must be less than or equals to [59].'
    );
  });
});
