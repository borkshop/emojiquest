import test from 'ava';
import { ternym } from '../topology/daia/toponym.js';

export const arrows = [
  ['nw', 'nn', 'ne'],
  ['ww', 'cc', 'ee'],
  ['sw', 'ss', 'se'],
];

test('twos', t => {
  t.deepEqual(['nw'], ternym(2, 0, 0, arrows));
  t.deepEqual(['nw', 'nw'], ternym(4, 0, 0, arrows));
  t.deepEqual(['nw', 'nw', 'nw'], ternym(8, 0, 0, arrows));

  t.deepEqual(['se'], ternym(2, 1, 1, arrows));
  t.deepEqual(['se', 'se'], ternym(4, 3, 3, arrows));
  t.deepEqual(['se', 'se', 'se'], ternym(8, 7, 7, arrows));
});

test('threes', t => {
  t.deepEqual(['nw'], ternym(3, 0, 0, arrows));
  t.deepEqual(['nw', 'nw'], ternym(9, 0, 0, arrows));
  t.deepEqual(['nw', 'nw', 'nw'], ternym(27, 0, 0, arrows));

  t.deepEqual(['se'], ternym(3, 2, 2, arrows));
  t.deepEqual(['se', 'se'], ternym(9, 8, 8, arrows));
  t.deepEqual(['se', 'se', 'se'], ternym(27, 26, 26, arrows));

  t.deepEqual(['cc'], ternym(3, 1, 1, arrows));
  t.deepEqual(['cc', 'cc'], ternym(9, 4, 4, arrows));
  t.deepEqual(['cc', 'cc', 'cc'], ternym(27, 13, 13, arrows));
});

test('fives', t => {
  t.deepEqual(['(2/5, 0/5)'], ternym(5, 2, 0, arrows));
});

test('sixes', t => {
  t.deepEqual(['nw', 'nw'], ternym(6, 0, 0, arrows));
  t.deepEqual(['nw', 'nn'], ternym(6, 1, 0, arrows));
  t.deepEqual(['nw', 'ne'], ternym(6, 2, 0, arrows));
  t.deepEqual(['ne', 'nw'], ternym(6, 3, 0, arrows));
  t.deepEqual(['ne', 'nn'], ternym(6, 4, 0, arrows));
  t.deepEqual(['ne', 'ne'], ternym(6, 5, 0, arrows));
});

test('sevens', t => {
  t.deepEqual(['(3/7, 0/7)'], ternym(7, 3, 0, arrows));
});

test('tens', t => {
  t.deepEqual(['nw', '(2/5, 0/5)'], ternym(10, 2, 0, arrows));
  t.deepEqual(['ne', '(2/5, 0/5)'], ternym(10, 7, 0, arrows));
});

test('twelves', t => {
  t.deepEqual(['nw', 'nw', 'nw'], ternym(12, 0, 0, arrows));
  t.deepEqual(['nw', 'nw', 'nn'], ternym(12, 1, 0, arrows));
  t.deepEqual(['nw', 'nw', 'ne'], ternym(12, 2, 0, arrows));
  t.deepEqual(['nw', 'ne', 'nw'], ternym(12, 3, 0, arrows));
  t.deepEqual(['nw', 'ne', 'nn'], ternym(12, 4, 0, arrows));
  t.deepEqual(['nw', 'ne', 'ne'], ternym(12, 5, 0, arrows));
  t.deepEqual(['ne', 'nw', 'nw'], ternym(12, 6, 0, arrows));
  t.deepEqual(['ne', 'nw', 'nn'], ternym(12, 7, 0, arrows));
  t.deepEqual(['ne', 'nw', 'ne'], ternym(12, 8, 0, arrows));
  t.deepEqual(['ne', 'ne', 'nw'], ternym(12, 9, 0, arrows));
  t.deepEqual(['ne', 'ne', 'nn'], ternym(12, 10, 0, arrows));
  t.deepEqual(['ne', 'ne', 'ne'], ternym(12, 11, 0, arrows));
});
