const parser = require('@datasert/cron-parser');
const subject = require('../../dist/evaluator');

const parsed = parser.parse('0/10 * * * ?');
for (let i = 0; i < 100; i++) {
  const st = new Date().getTime();
  console.log('####### subject.getFutureMatches(parsed)', subject.getFutureMatches(parsed));
  console.log(`Time taken ${i}: `, new Date().getTime() - st);
}
