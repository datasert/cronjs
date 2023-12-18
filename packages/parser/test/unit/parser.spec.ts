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

function expectExpr(expr: string, expected: any) {
  for (const field of FIELDS_LIST) {
    if (expected[field]) {
      continue;
    }

    if (field === FLD_SECOND) {
      expected[field] = {omit: true};
    } else if (field === FLD_DAY_OF_WEEK) {
      expected[field] = {omit: true};
    } else {
      expected[field] = {all: true};
    }
  }

  const output = subject.parse(expr);
  delete (output as Partial<subject.CronExprs>).pattern;
  // console.log(`####### output [${expr}]`, JSON.stringify(output));
  expect(output).toEqual({expressions: [expected]});
}

describe('valid expressions', () => {
  it('every minute', () => {
    expectExpr('* * * *', {});
  });

  it('minute: range', () => {
    expectExpr('0-12 * * *', {
      minute: {ranges: [{from: 0, to: 12}]},
    });
  });

  it('minute: multiple ranges', () => {
    expectExpr('0-12,20-30 * * *', {
      minute: {
        ranges: [
          {from: 0, to: 12},
          {from: 20, to: 30},
        ],
      },
    });
  });

  it('minute: multiple ranges out of order', () => {
    expectExpr('20-30,0-12 * * *', {
      minute: {
        ranges: [
          {from: 20, to: 30},
          {from: 0, to: 12},
        ],
      },
    });
  });

  it('minute: multiple ranges deduped', () => {
    expectExpr('20-30,0-12,0-12,20-30 * * *', {
      minute: {
        ranges: [
          {from: 20, to: 30},
          {from: 0, to: 12},
        ],
      },
    });
  });

  it('minute: multiple ranges along with single values', () => {
    expectExpr('20-30,0-12,55,56 * * *', {
      minute: {
        ranges: [
          {from: 20, to: 30},
          {from: 0, to: 12},
        ],
        values: [55, 56],
      },
    });
  });

  it('minute: steps', () => {
    expectExpr('0/5 * * *', {
      minute: {steps: [{from: 0, to: 59, step: 5}]},
    });
  });

  it('minute: steps with * as starting value', () => {
    expectExpr('*/5 * * *', {
      minute: {steps: [{from: 0, to: 59, step: 5}]},
    });
  });

  it('minute: range steps', () => {
    expectExpr('0-17/5 * * *', {
      minute: {steps: [{from: 0, to: 17, step: 5}]},
    });
  });

  it('minute: range steps mid start', () => {
    expectExpr('10-17/5 * * *', {
      minute: {steps: [{from: 10, to: 17, step: 5}]},
    });
  });

  it('minute: multiple steps', () => {
    expectExpr('0/5,1/5 * * *', {
      minute: {
        steps: [
          {from: 0, to: 59, step: 5},
          {from: 1, to: 59, step: 5},
        ],
      },
    });
  });

  it('minute: multiple range steps', () => {
    expectExpr('0-17/5,20-30/2 * * *', {
      minute: {
        steps: [
          {from: 0, to: 17, step: 5},
          {from: 20, to: 30, step: 2},
        ],
      },
    });
  });

  it('minute: odd steps', () => {
    expectExpr('0/17 * * *', {
      minute: {
        steps: [{from: 0, to: 59, step: 17}],
      },
    });
  });

  it('day of month: last day of month', () => {
    expectExpr('* * L *', {
      day_of_month: {lastDay: true},
    });
  });

  it('day of month: last weekday of month', () => {
    expectExpr('* * LW *', {
      day_of_month: {lastWeekday: true},
    });
  });

  it('day of month: last weekday of month (case insensitive)', () => {
    expectExpr('* * lw *', {
      day_of_month: {lastWeekday: true},
    });
  });

  it('day of month: range', () => {
    expectExpr('* * 1-5 *', {
      day_of_month: {ranges: [{from: 1, to: 5}]},
    });
  });

  it('day of month: multiple ranges', () => {
    expectExpr('* * 1-5,9-15 *', {
      day_of_month: {
        ranges: [
          {from: 1, to: 5},
          {from: 9, to: 15},
        ],
      },
    });
  });

  it('day of month: steps', () => {
    expectExpr('* * 3/7 *', {
      day_of_month: {
        steps: [{from: 3, to: 31, step: 7}],
      },
    });
  });

  it('day of month: values', () => {
    expectExpr('* * 3,5 *', {
      day_of_month: {values: [3, 5]},
    });
  });

  it('day of month: values with steps', () => {
    expectExpr('* * 3,5,1/3 *', {
      day_of_month: {
        steps: [{from: 1, to: 31, step: 3}],
        values: [3, 5],
      },
    });
  });

  it('day of month: weekday near to 20th', () => {
    expectExpr('* * 20W *', {
      day_of_month: {nearestWeekdays: [20]},
    });
  });

  it('month: alias', () => {
    expectExpr('* * * jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec', {
      month: {values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]},
    });
  });

  it('month: alias range', () => {
    expectExpr('* * * jan-dec', {
      month: {ranges: [{from: 1, to: 12}]},
    });
  });

  it('month: alias range and alias value', () => {
    expectExpr('* * * jan-mar,dec', {
      month: {values: [12], ranges: [{from: 1, to: 3}]},
    });
  });

  it('month: value', () => {
    expectExpr('* * * 1,2', {
      month: {values: [1, 2]},
    });
  });

  it('month: value range', () => {
    expectExpr('* * * 1-3', {
      month: {ranges: [{from: 1, to: 3}]},
    });
  });

  it('month: value ranges', () => {
    expectExpr('* * * 1-3,7-9', {
      month: {
        ranges: [
          {from: 1, to: 3},
          {from: 7, to: 9},
        ],
      },
    });
  });

  it('month: alias steps', () => {
    expectExpr('* * * jan/3', {
      month: {steps: [{from: 1, to: 12, step: 3}]},
    });
  });

  it('month: alias mixed case', () => {
    expectExpr('* * * jan,FEB,mAR', {
      month: {values: [1, 2, 3]},
    });
  });

  it('day of week: omit', () => {
    expectExpr('* * * * ?', {
      day_of_week: {omit: true},
    });
  });

  it('day of week: all', () => {
    expectExpr('* * * * *', {
      day_of_week: {all: true},
    });
  });

  it('day of week: nth day of month', () => {
    expectExpr('* * * * sun#2', {
      day_of_week: {nthDays: [{day_of_week: 0, instance: 2}]},
    });
  });

  it('day of week: alias mixed case', () => {
    expectExpr('* * ? * Mon,TUE,wEd', {
      day_of_month: {omit: true},
      day_of_week: {values: [1, 2, 3]},
    });
  });

  it('day of week: 0 or 7 for Sun', () => {
    expectExpr('* * ? * sun', {
      day_of_month: {omit: true},
      day_of_week: {values: [0]},
    });
    expectExpr('* * ? * 0', {
      day_of_month: {omit: true},
      day_of_week: {values: [0]},
    });
    expectExpr('* * ? * 7', {
      day_of_month: {omit: true},
      day_of_week: {values: [0]},
    });
    expectExpr('* * ? * 7,0', {
      day_of_month: {omit: true},
      day_of_week: {values: [0]},
    });
  });

  it('day of week: last sun of month', () => {
    expectExpr('* * * * sunl', {
      day_of_week: {lastDays: [0]},
    });
  });

  it('day of week: Sun is decoded as 0', () => {
    expectExpr('* * * * SUN,sun,Sun', {
      day_of_week: {values: [0]},
    });
  });

  it('day of week: First sun', () => {
    expectExpr('* * ? * 0#1', {
      day_of_month: {omit: true},
      day_of_week: {nthDays: [{day_of_week: 0, instance: 1}]},
    });
  });

  it('day of week: 5th Mon', () => {
    expectExpr('* * ? * 1#5', {
      day_of_month: {omit: true},
      day_of_week: {nthDays: [{day_of_week: 1, instance: 5}]},
    });
  });

  it('day of week: last sat of month', () => {
    expectExpr('* * ? * 6L', {
      day_of_month: {omit: true},
      day_of_week: {lastDays: [6]},
    });
  });

  it('day of week: first mon of year', () => {
    expectExpr('0 0 ? jan 1#1', {
      minute: {values: [0]},
      hour: {values: [0]},
      day_of_month: {omit: true},
      month: {values: [1]},
      day_of_week: {nthDays: [{day_of_week: 1, instance: 1}]},
    });
  });

  it('day of week: steps', () => {
    expectExpr('30 12 * * */0', {
      minute: {values: [30]},
      hour: {values: [12]},
      day_of_week: {
        steps: [{from: 0, to: 7, step: 0}],
      },
    });

    expectExpr('30 12 * * */1', {
      minute: {values: [30]},
      hour: {values: [12]},
      day_of_week: {
        steps: [{from: 0, to: 7, step: 1}],
      },
    });

    expectExpr('30 12 * * */4', {
      minute: {values: [30]},
      hour: {values: [12]},
      day_of_week: {
        steps: [{from: 0, to: 7, step: 4}],
      },
    });
  });

  it('day of week and day of month: 15th or Sun', () => {
    expectExpr('* * 15 * sun', {
      day_of_month: {values: [15]},
      day_of_week: {values: [0]},
    });
  });

  it('day of week and day of month: omit day of month', () => {
    expectExpr('* * ? * sun', {
      day_of_month: {omit: true},
      day_of_week: {values: [0]},
    });
  });
});

describe('pre-defined expressions', () => {
  it('@yearly', () => {
    expectExpr('@yearly', {
      minute: {values: [0]},
      hour: {values: [0]},
      day_of_month: {values: [1]},
      month: {values: [1]},
    });
  });

  it('@monthly', () => {
    expectExpr('@monthly', {
      minute: {values: [0]},
      hour: {values: [0]},
      day_of_month: {values: [1]},
    });
  });

  it('@weekly', () => {
    expectExpr('@weekly', {
      minute: {values: [0]},
      hour: {values: [0]},
      day_of_month: {omit: true},
      day_of_week: {values: [0]},
    });
  });

  it('@daily', () => {
    expectExpr('@daily', {
      minute: {values: [0]},
      hour: {values: [0]},
      day_of_month: {all: true},
    });
  });

  it('@hourly', () => {
    expectExpr('@hourly', {
      minute: {values: [0]},
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

describe('multi cron expressions', () => {
  it('multiple separated by |', () => {
    expect(subject.parse('* 0-1,0-5/2 l,lw jan-dec 6#1|0,5 0-1,0-5/2 l,lw jan-dec 6#1')).toEqual({
      pattern: '* 0-1,0-5/2 l,lw jan-dec 6#1|0,5 0-1,0-5/2 l,lw jan-dec 6#1',
      expressions: [
        {
          second: {omit: true},
          minute: {all: true},
          hour: {ranges: [{from: 0, to: 1}], steps: [{from: 0, to: 5, step: 2}]},
          day_of_month: {lastDay: true, lastWeekday: true},
          month: {ranges: [{from: 1, to: 12}]},
          day_of_week: {nthDays: [{day_of_week: 6, instance: 1}]},
          year: {all: true},
        },
        {
          second: {omit: true},
          minute: {values: [0, 5]},
          hour: {ranges: [{from: 0, to: 1}], steps: [{from: 0, to: 5, step: 2}]},
          day_of_month: {lastDay: true, lastWeekday: true},
          month: {ranges: [{from: 1, to: 12}]},
          day_of_week: {nthDays: [{day_of_week: 6, instance: 1}]},
          year: {all: true},
        },
      ],
    });
  });
});

describe('parsing performance (10000 parses)', () => {
  it('time to parse', () => {
    for (let i = 0; i < 10000; i++) {
      subject.parse('* 0-1,0-5/2 l,lw jan-dec 6#1');
    }
  });
});
