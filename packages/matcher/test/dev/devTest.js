const {getFutureMatches} = require('../../dist');

function test() {
  return getFutureMatches('0 2 * * 0', {
    startAt: '2022-03-16T02:00:00.486Z',
  });
}

console.log(test());
